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

echo "==> git pull origin ${BRANCH}"
git checkout "$BRANCH"
git reset --hard HEAD
GIT_TERMINAL_PROMPT=0 git pull origin "$BRANCH"
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

echo "==> Deploy finished ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
echo "REVISION=$(git -C "$APP_DIR" rev-parse --short HEAD)"
echo "BACKUP_BRANCH=${BACKUP_BRANCH:-unknown}"
