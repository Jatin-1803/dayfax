#!/usr/bin/env bash
# Run after DNS exists for backend.dayfax.in + admin.dayfax.in
set -euo pipefail
APP_DIR=/var/www/dayfax

sudo certbot certonly --webroot -w /var/www/html \
  -d backend.dayfax.in -d admin.dayfax.in \
  --non-interactive --agree-tos --register-unsafely-without-email \
  --cert-name backend.dayfax.in

sudo cp "$APP_DIR/scripts/nginx-dayfax-ssl-subdomains.conf" /etc/nginx/sites-available/dayfax-ssl-subdomains
sudo ln -sf /etc/nginx/sites-available/dayfax-ssl-subdomains /etc/nginx/sites-enabled/dayfax-ssl-subdomains
sudo nginx -t
sudo systemctl reload nginx

echo "SSL_SUBDOMAINS_OK"
curl -sS https://backend.dayfax.in/api/v1/health
echo
curl -sS -o /dev/null -w "admin=%{http_code}\n" https://admin.dayfax.in/
