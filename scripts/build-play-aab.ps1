# Build a Play Store–ready signed Android App Bundle (Windows).
$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
$AppDir = Join-Path $Root "app"
$KeyProps = Join-Path $AppDir "android\key.properties"
$Keystore = Join-Path $AppDir "android\upload-keystore.jks"

if (-not (Test-Path $KeyProps) -or -not (Test-Path $Keystore)) {
  Write-Error "Release signing files missing (key.properties / upload-keystore.jks)."
}

Set-Location $AppDir
flutter pub get
flutter build appbundle --release

$Out = Join-Path $AppDir "build\app\outputs\bundle\release\app-release.aab"
Write-Host ""
Write-Host "AAB ready: $Out"
Write-Host "Upload in Play Console → Production (or Internal testing)."
Write-Host "After first upload, add Play App Signing SHA to Firebase + GCP dayfax-app-login."
