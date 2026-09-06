#!/usr/bin/env bash
# One-time Dayfax provision on the shared EC2 host.
# Safe for tatami: separate DB, port, nginx vhost, PM2 process, SSL cert.
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/dayfax}"
DOMAIN="${DOMAIN:-dayfax.in}"
API_PORT="${API_PORT:-3010}"
DB_NAME="${DB_NAME:-dayfax}"
DB_USER="${DB_USER:-dayfax}"
EC2_IP="${EC2_IP:-13.200.153.94}"

echo "==> Install PM2 (ubuntu user)"
if ! command -v pm2 >/dev/null 2>&1; then
  sudo npm install -g pm2
fi
pm2 -v

echo "==> MySQL database + user (separate from tatami)"
DB_PASS_FILE="${HOME}/.config/dayfax/db_password"
mkdir -p "$(dirname "$DB_PASS_FILE")"
if [ ! -f "$DB_PASS_FILE" ]; then
  openssl rand -base64 24 | tr -d '\n/+' | head -c 32 > "$DB_PASS_FILE"
  chmod 600 "$DB_PASS_FILE"
fi
DB_PASS="$(tr -d '\r\n' < "$DB_PASS_FILE")"

sudo mysql -e "CREATE DATABASE IF NOT EXISTS \`${DB_NAME}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
sudo mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
sudo mysql -e "ALTER USER '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
sudo mysql -e "GRANT ALL PRIVILEGES ON \`${DB_NAME}\`.* TO '${DB_USER}'@'localhost'; FLUSH PRIVILEGES;"

echo "==> Backend .env"
BACKEND_ENV="${APP_DIR}/backend/.env"
JWT_ACCESS="$(openssl rand -hex 32)"
JWT_REFRESH="$(openssl rand -hex 32)"

if [ ! -f "$BACKEND_ENV" ]; then
  cat > "$BACKEND_ENV" <<EOF
NODE_ENV=production
HOST=127.0.0.1
PORT=${API_PORT}
API_PREFIX=/api/v1

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=${DB_USER}
DB_PASSWORD=${DB_PASS}
DB_NAME=${DB_NAME}

JWT_ACCESS_SECRET=${JWT_ACCESS}
JWT_REFRESH_SECRET=${JWT_REFRESH}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

OTP_LENGTH=4
OTP_EXPIRES_SECONDS=300
OTP_DEV_CODE=1234
OTP_PROVIDER=dev

LOG_LEVEL=info
CORS_ORIGIN=https://${DOMAIN},https://www.${DOMAIN}
EOF
  chmod 600 "$BACKEND_ENV"
else
  echo "Keeping existing $BACKEND_ENV"
fi

echo "==> First install/build/migrate"
cd "${APP_DIR}/backend"
npm ci
npm run build
mkdir -p dist/common/database/migrations
cp -a src/common/database/migrations/. dist/common/database/migrations/
node dist/common/database/migrate.js
npm run seed || true

echo "==> PM2 start"
cd "$APP_DIR"
pm2 delete dayfax-api 2>/dev/null || true
pm2 start ecosystem.config.cjs
pm2 save
sudo env PATH="$PATH" pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -n 1 | bash || true

echo "==> Nginx vhost (dayfax only — tatami untouched)"
if [ -f "$APP_DIR/scripts/nginx-dayfax.conf" ]; then
  # HTTP-only bootstrap if certs are not present yet
  if [ ! -f /etc/letsencrypt/live/${DOMAIN}/fullchain.pem ]; then
    sudo tee /etc/nginx/sites-available/dayfax >/dev/null <<NGINX
server {
    listen 80;
    listen [::]:80;
    server_name www.${DOMAIN};
    return 301 http://${DOMAIN}\$request_uri;
}

server {
    listen 80;
    listen [::]:80;
    server_name ${DOMAIN};
    root ${APP_DIR}/website;
    index index.html;

    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;

    client_max_body_size 10M;

    location /.well-known/acme-challenge/ {
        root /var/www/html;
    }

    location /api/ {
        proxy_pass http://127.0.0.1:${API_PORT};
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 60s;
    }

    location = /health {
        proxy_pass http://127.0.0.1:${API_PORT}/api/v1/health;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    location = /privacy { try_files /privacy.html =404; }
    location = /terms { try_files /terms.html =404; }

    location / {
        try_files \$uri \$uri/ /index.html;
    }

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
NGINX
  else
    sudo cp "$APP_DIR/scripts/nginx-dayfax.conf" /etc/nginx/sites-available/dayfax
  fi
else
  echo "ERROR: missing $APP_DIR/scripts/nginx-dayfax.conf"
  exit 1
fi

sudo ln -sf /etc/nginx/sites-available/dayfax /etc/nginx/sites-enabled/dayfax
# Do NOT remove or edit tatami site
sudo nginx -t
sudo systemctl reload nginx

echo "==> Local checks (Host: ${DOMAIN})"
curl -sS -H "Host: ${DOMAIN}" "http://127.0.0.1/api/v1/health" || true
echo
curl -sS -H "Host: tatamimat.in" -o /dev/null -w "tatami_http=%{http_code}\n" "http://127.0.0.1/" || true

echo "==> SSL via Certbot (requires Cloudflare origin -> ${EC2_IP})"
if sudo certbot --nginx -d "${DOMAIN}" -d "www.${DOMAIN}" --non-interactive --agree-tos --register-unsafely-without-email --redirect; then
  # Re-apply checked-in SSL config with static website root
  if [ -f "$APP_DIR/scripts/nginx-dayfax.conf" ]; then
    sudo cp "$APP_DIR/scripts/nginx-dayfax.conf" /etc/nginx/sites-available/dayfax
    sudo nginx -t
    sudo systemctl reload nginx
  fi
  echo "SSL_OK"
else
  echo "SSL_PENDING: point ${DOMAIN} A/AAAA (Cloudflare) to ${EC2_IP}, then rerun:"
  echo "  sudo certbot --nginx -d ${DOMAIN} -d www.${DOMAIN} --redirect"
fi

echo "DONE_SETUP domain=${DOMAIN} port=${API_PORT} db=${DB_NAME}"
