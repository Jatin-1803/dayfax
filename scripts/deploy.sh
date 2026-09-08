#!/usr/bin/env bash
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/dayfax}"
BRANCH="${DEPLOY_BRANCH:-main}"
TOKEN_FILE="${HOME}/.config/dayfax/github_token"
REPO_URL="${REPO_URL:-https://github.com/Jatin-1803/dayfax.git}"
BACKEND_DIR="${APP_DIR}/backend"
PM2_APP_NAME="${PM2_APP_NAME:-dayfax-api}"

cd "$APP_DIR"

echo "==> Deploy started ($(date -u +%Y-%m-%dT%H:%M:%SZ))"

if [ ! -d .git ]; then
  echo "ERROR: $APP_DIR is not a git repo. Run scripts/server-git-init.sh first."
  exit 1
fi

if [ ! -f "$BACKEND_DIR/.env" ]; then
  echo "ERROR: .env missing in $BACKEND_DIR"
  exit 1
fi

cleanup() {
  git remote set-url origin "$REPO_URL" 2>/dev/null || true
}
trap cleanup EXIT

if [ -f "$TOKEN_FILE" ]; then
  TOKEN="$(tr -d '\r\n' < "$TOKEN_FILE")"
  git remote set-url origin "https://x-access-token:${TOKEN}@github.com/Jatin-1803/dayfax.git"
else
  git remote set-url origin "$REPO_URL"
fi

PREV_SHA="$(git rev-parse --short HEAD)"
BACKUP_BRANCH="backup/$(date -u +%Y%m%d-%H%M%S)-${PREV_SHA}"
echo "==> Creating backup branch ${BACKUP_BRANCH}"
git branch "$BACKUP_BRANCH"
git for-each-ref --sort=-creatordate --format='%(refname:short)' refs/heads/backup/ \
  | tail -n +11 \
  | while read -r old; do git branch -D "$old" || true; done

echo "==> git fetch origin ${BRANCH}"
git checkout "$BRANCH"
# Line-ending noise and leftover copies must not block deploy.
# reset --hard to origin keeps ignored secrets such as backend/.env.
GIT_TERMINAL_PROMPT=0 git fetch origin "$BRANCH"
git reset --hard "origin/${BRANCH}"
git clean -fd -e backend/.env
git remote set-url origin "$REPO_URL"
echo "BACKUP_BRANCH=${BACKUP_BRANCH}"

echo "==> Backend install + build"
cd "$BACKEND_DIR"
npm ci
npm run build
mkdir -p dist/common/database/migrations
cp -a src/common/database/migrations/. dist/common/database/migrations/

echo "==> Migrations"
node dist/common/database/migrate.js

echo "==> Restart API (PM2)"
if command -v pm2 >/dev/null 2>&1; then
  if pm2 describe "$PM2_APP_NAME" >/dev/null 2>&1; then
    pm2 restart "$PM2_APP_NAME" --update-env
  else
    pm2 start "$APP_DIR/ecosystem.config.cjs"
  fi
  pm2 save
else
  echo "ERROR: pm2 not installed"
  exit 1
fi

echo "==> Admin SPA build"
ADMIN_DIR="$APP_DIR/admin"
ADMIN_DIST="$APP_DIR/admin-dist"
if [ -f "$ADMIN_DIR/package.json" ]; then
  cd "$ADMIN_DIR"
  npm ci
  VITE_API_BASE_URL="${VITE_API_BASE_URL:-https://backend.dayfax.in/api/v1}" npm run build
  sudo mkdir -p "$ADMIN_DIST"
  sudo rsync -a --delete "$ADMIN_DIR/dist/" "$ADMIN_DIST/"
  sudo chown -R ubuntu:www-data "$ADMIN_DIST"
else
  echo "WARN: admin/ missing — skipping admin build"
fi

echo "==> Sync nginx (dayfax only — tatami untouched)"
if [ -f "$APP_DIR/scripts/nginx-dayfax.conf" ]; then
  sudo cp "$APP_DIR/scripts/nginx-dayfax.conf" /etc/nginx/sites-available/dayfax
  sudo ln -sf /etc/nginx/sites-available/dayfax /etc/nginx/sites-enabled/dayfax
  sudo nginx -t
  sudo systemctl reload nginx
fi

echo "==> Deploy finished ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
echo "REVISION=$(git -C "$APP_DIR" rev-parse --short HEAD)"
echo "BACKUP_BRANCH=${BACKUP_BRANCH:-unknown}"
