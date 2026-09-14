#!/usr/bin/env python3
"""Register Android signing SHA-1/SHA-256 fingerprints on the Firebase Android app.

Play Store installs are signed with Google Play App Signing — not the upload
keystore. Google Sign-In fails with DEVELOPER_ERROR if that Play SHA is missing.

Usage:
  # Sync all non-empty fingerprints from app/android/signing-fingerprints.json
  python scripts/sync-android-sha-to-firebase.py

  # Register Play App Signing certs once (from Play Console → App integrity)
  python scripts/sync-android-sha-to-firebase.py --sha1 AABBCC... --sha256 DDEEFF... --name play_app_signing

Env:
  FIREBASE_SERVICE_ACCOUNT_PATH  Absolute path to Firebase Admin SDK JSON
                                 (defaults to backend/.env value or common local path)
"""

from __future__ import annotations

import argparse
import json
import os
import re
import sys
from pathlib import Path

try:
    from google.auth.transport.requests import AuthorizedSession
    from google.oauth2 import service_account
except ImportError:
    print("Install deps: pip install google-auth requests", file=sys.stderr)
    sys.exit(1)

ROOT = Path(__file__).resolve().parents[1]
FINGERPRINTS_FILE = ROOT / "app" / "android" / "signing-fingerprints.json"
SCOPES = [
    "https://www.googleapis.com/auth/cloud-platform",
    "https://www.googleapis.com/auth/firebase",
]


def normalize_sha(value: str) -> str:
    cleaned = re.sub(r"[^0-9a-fA-F]", "", value or "")
    return cleaned.lower()


def resolve_service_account() -> Path:
    candidates: list[Path] = []
    env_path = os.environ.get("FIREBASE_SERVICE_ACCOUNT_PATH", "").strip()
    if env_path:
        candidates.append(Path(env_path))

    backend_env = ROOT / "backend" / ".env"
    if backend_env.exists():
        for line in backend_env.read_text(encoding="utf-8").splitlines():
            if line.startswith("FIREBASE_SERVICE_ACCOUNT_PATH="):
                candidates.append(Path(line.split("=", 1)[1].strip()))
                break

    candidates.extend(
        [
            Path.home() / "Downloads" / "dayfax-firebase-adminsdk-fbsvc-87f543fd61.json",
            Path.home() / ".config" / "dayfax" / "firebase-service-account.json",
        ]
    )

    for path in candidates:
        if path and path.is_file():
            return path
    raise SystemExit(
        "Firebase service-account JSON not found. Set FIREBASE_SERVICE_ACCOUNT_PATH."
    )


def load_config() -> dict:
    return json.loads(FINGERPRINTS_FILE.read_text(encoding="utf-8"))


def save_config(data: dict) -> None:
    FINGERPRINTS_FILE.write_text(
        json.dumps(data, indent=2) + "\n",
        encoding="utf-8",
    )


def session_for(sa_path: Path) -> AuthorizedSession:
    creds = service_account.Credentials.from_service_account_file(
        str(sa_path),
        scopes=SCOPES,
    )
    return AuthorizedSession(creds)


def list_sha(session: AuthorizedSession, app_name: str) -> set[str]:
    resp = session.get(f"https://firebase.googleapis.com/v1beta1/{app_name}/sha")
    resp.raise_for_status()
    certs = resp.json().get("certificates") or []
    return {normalize_sha(c.get("shaHash", "")) for c in certs if c.get("shaHash")}


def add_sha(
    session: AuthorizedSession,
    app_name: str,
    digest: str,
    cert_type: str,
    existing: set[str],
) -> str:
    if digest in existing:
        return "exists"
    body = {"shaHash": digest, "certType": cert_type}
    resp = session.post(
        f"https://firebase.googleapis.com/v1beta1/{app_name}/sha",
        json=body,
    )
    if resp.status_code in (409, 400) and (
        "ALREADY_EXISTS" in resp.text or "already exists" in resp.text.lower()
    ):
        existing.add(digest)
        return "exists"
    if resp.status_code >= 400:
        raise SystemExit(f"Failed to add {cert_type} {digest}: {resp.status_code} {resp.text}")
    existing.add(digest)
    return "added"


def sync_pair(
    session: AuthorizedSession,
    app_name: str,
    name: str,
    sha1: str,
    sha256: str,
    existing: set[str],
) -> None:
    sha1_n = normalize_sha(sha1)
    sha256_n = normalize_sha(sha256)
    if sha1_n:
        if len(sha1_n) != 40:
            raise SystemExit(f"{name}: SHA-1 must be 40 hex chars, got {len(sha1_n)}")
        status = add_sha(session, app_name, sha1_n, "SHA_1", existing)
        print(f"{name} SHA_1 {status}: {sha1_n}")
    if sha256_n:
        if len(sha256_n) != 64:
            raise SystemExit(f"{name}: SHA-256 must be 64 hex chars, got {len(sha256_n)}")
        status = add_sha(session, app_name, sha256_n, "SHA_256", existing)
        print(f"{name} SHA_256 {status}: {sha256_n}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--sha1", default="", help="Register one SHA-1 (and optionally update JSON)")
    parser.add_argument("--sha256", default="", help="Register one SHA-256")
    parser.add_argument(
        "--name",
        default="play_app_signing",
        help="Fingerprint name when using --sha1/--sha256 (default: play_app_signing)",
    )
    parser.add_argument(
        "--update-json",
        action="store_true",
        help="Write --sha1/--sha256 into signing-fingerprints.json under --name",
    )
    parser.add_argument("--check", action="store_true", help="Only verify registered SHAs")
    args = parser.parse_args()

    cfg = load_config()
    app_id = cfg["firebaseAndroidAppId"]
    project = cfg["firebaseProjectId"]
    app_name = f"projects/{project}/androidApps/{app_id}"

    sa_path = resolve_service_account()
    session = session_for(sa_path)
    existing = list_sha(session, app_name)

    if args.sha1 or args.sha256:
        sync_pair(session, app_name, args.name, args.sha1, args.sha256, existing)
        if args.update_json:
            found = False
            for item in cfg["fingerprints"]:
                if item.get("name") == args.name:
                    if args.sha1:
                        item["sha1"] = normalize_sha(args.sha1)
                    if args.sha256:
                        item["sha256"] = normalize_sha(args.sha256)
                    found = True
                    break
            if not found:
                cfg["fingerprints"].append(
                    {
                        "name": args.name,
                        "sha1": normalize_sha(args.sha1),
                        "sha256": normalize_sha(args.sha256),
                    }
                )
            save_config(cfg)
            print(f"Updated {FINGERPRINTS_FILE}")
    else:
        for item in cfg.get("fingerprints") or []:
            name = item.get("name") or "unnamed"
            sha1 = item.get("sha1") or ""
            sha256 = item.get("sha256") or ""
            if not sha1 and not sha256:
                print(f"SKIP {name}: empty (fill Play App Signing SHA before production)")
                continue
            if args.check:
                continue
            sync_pair(session, app_name, name, sha1, sha256, existing)

    registered = list_sha(session, app_name)
    print("--- Firebase registered SHA hashes ---")
    for digest in sorted(registered):
        print(digest)

    missing_play = False
    for item in cfg.get("fingerprints") or []:
        if item.get("name") != "play_app_signing":
            continue
        if not normalize_sha(item.get("sha1") or ""):
            missing_play = True

    required = {
        normalize_sha(i.get("sha1") or "")
        for i in cfg.get("fingerprints") or []
        if i.get("sha1")
    }
    missing = sorted(required - registered)
    if missing:
        print("MISSING required SHA-1s:", ", ".join(missing), file=sys.stderr)
        sys.exit(2)

    if missing_play:
        print(
            "WARNING: play_app_signing SHA is empty. "
            "Play Store installs will break Google Sign-In until you add "
            "Play Console -> App integrity -> App signing key certificate SHA-1/SHA-256:\n"
            "  python scripts/sync-android-sha-to-firebase.py "
            "--sha1 <PLAY_SHA1> --sha256 <PLAY_SHA256> --update-json"
        )
        if args.check:
            sys.exit(3)

    print("OK: configured fingerprints are registered on Firebase.")


if __name__ == "__main__":
    main()
