#!/usr/bin/env bash
# One-time: clone /var/www/dayfax from GitHub (does not touch tatami).
set -euo pipefail

APP_DIR="${APP_DIR:-/var/www/dayfax}"
BRANCH="${DEPLOY_BRANCH:-main}"
REPO_URL="${REPO_URL:-https://github.com/Jatin-1803/dayfax.git}"
TOKEN_FILE="${HOME}/.config/dayfax/github_token"
TOKEN="${1:-}"

if [ -n "$TOKEN" ]; then
  mkdir -p "$(dirname "$TOKEN_FILE")"
  printf '%s' "$TOKEN" > "$TOKEN_FILE"
  chmod 600 "$TOKEN_FILE"
fi

if [ ! -f "$TOKEN_FILE" ]; then
  echo "Usage: $0 <github_pat>"
  echo "Or place the token in $TOKEN_FILE first."
  exit 1
fi

TOKEN="$(tr -d '\r\n' < "$TOKEN_FILE")"

if [ -d "$APP_DIR/.git" ]; then
  echo "Git already initialized in $APP_DIR"
  git -C "$APP_DIR" remote set-url origin "$REPO_URL"
  exit 0
fi

echo "==> Preparing $APP_DIR"
sudo mkdir -p "$APP_DIR"
sudo chown ubuntu:ubuntu "$APP_DIR"

if [ "$(ls -A "$APP_DIR" 2>/dev/null | grep -v '^\.env$' || true)" != "" ] && [ ! -d "$APP_DIR/.git" ]; then
  echo "ERROR: $APP_DIR is not empty and is not a git repo. Aborting."
  exit 1
fi

echo "==> Cloning ${REPO_URL} (${BRANCH})"
TMP_DIR="$(mktemp -d)"
git clone --branch "$BRANCH" --single-branch \
  "https://x-access-token:${TOKEN}@github.com/Jatin-1803/dayfax.git" "$TMP_DIR/dayfax"
rsync -a --delete --exclude '.env' --exclude 'backend/.env' "$TMP_DIR/dayfax/" "$APP_DIR/"
rm -rf "$TMP_DIR"

cd "$APP_DIR"
git remote set-url origin "$REPO_URL"

echo "==> Permissions"
sudo chown -R ubuntu:www-data "$APP_DIR"
sudo find "$APP_DIR" -type d -exec chmod 755 {} \;
sudo find "$APP_DIR" -type f -exec chmod 644 {} \;
chmod +x "$APP_DIR"/scripts/*.sh 2>/dev/null || true

echo "DONE_GIT_INIT app=$APP_DIR"
