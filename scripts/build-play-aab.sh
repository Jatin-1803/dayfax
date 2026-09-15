#!/usr/bin/env bash
# Build a Play Store–ready signed Android App Bundle from app/
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
APP_DIR="$ROOT/app"
KEY_PROPS="$APP_DIR/android/key.properties"
KEYSTORE="$APP_DIR/android/upload-keystore.jks"

if [ ! -f "$KEY_PROPS" ] || [ ! -f "$KEYSTORE" ]; then
  echo "ERROR: Release signing files missing."
  echo "Need: android/key.properties and android/upload-keystore.jks"
  exit 1
fi

cd "$APP_DIR"
flutter pub get
flutter build appbundle --release

OUT="$APP_DIR/build/app/outputs/bundle/release/app-release.aab"
echo ""
echo "AAB ready: $OUT"
echo "Upload this file in Play Console → Production (or Internal testing)."
echo "After first upload, add Play App Signing SHA to Firebase + GCP dayfax-app-login."
