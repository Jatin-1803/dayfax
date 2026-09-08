# DayFax

Local quick-commerce for small towns and villages in India.

| Layer | Stack |
|-------|--------|
| Mobile app | **One Flutter app** — customer + delivery partner |
| Admin web | **Vite + React + TypeScript** SPA in `admin/` |
| API | Node.js + TypeScript + REST |
| Database | MySQL 8 (WAMP locally) |

**No Docker.** See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) and [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

UI source of truth: [design/](design/)

## Quick start

### 1. Database

```bash
c:\wamp64\bin\mysql\mysql8.4.7\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS dailyfax CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### 2. Backend

```bash
cd backend
copy .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

### 3. Mobile app

API URL auto-selects from build mode:

| Build | Backend |
|-------|---------|
| `flutter run` / debug | local → `http://10.0.2.2:3000/api/v1` |
| `flutter build apk` / release | live → `https://backend.dayfax.in/api/v1` |

```bash
cd app
flutter pub get
flutter run
```

**Physical phone + local backend** (same Wi‑Fi) — pass your PC LAN IP:

```bash
flutter run -d <device-id> --dart-define=API_BASE_URL=http://192.168.0.108:3000/api/v1
```

**Force live API even in debug:**

```bash
flutter run --dart-define=ENV=production
```

After OTP login, backend roles decide the surface:

- `CUSTOMER` → customer home + customer theme
- `DELIVERY_PARTNER` → partner home + delivery theme

### Admin web app

Ops console is a separate Vite + React app in `admin/` (email + password via `admin_users`).

1. Set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` in `backend/.env` (defaults: `admin@dayfax.in` / `Admin@12345`), then `npm run migrate` and `npm run seed`.
2. Start API: `cd backend && npm run dev`
3. Start admin: `cd admin && npm install && npm run dev` → [http://127.0.0.1:5173](http://127.0.0.1:5173)
4. Sign in with the seeded admin email and password.

Optional: set `CORS_ORIGIN=http://127.0.0.1:5173,http://localhost:5173` in `backend/.env`.

Admin covers stores, catalog, orders, partners, users, zones, translations, and search.

### Production hosts

| Host | Purpose |
|------|---------|
| https://dayfax.in | Marketing + Privacy / Terms |
| https://backend.dayfax.in | API (`/api/v1`) + media |
| https://admin.dayfax.in | Admin SPA |

## Repository

```
app/            Single Flutter app (customer + delivery)
admin/          Web admin SPA (Vite + React + TypeScript)
backend/        REST API
design/         Screen designs + design systems
docs/           Architecture and plan
website/        Marketing site
```

## Search (aliases + Meilisearch)

Product search supports admin-managed synonyms (e.g. `cheeni` → sugar) and optional Meilisearch.

```bash
cd backend
npm run migrate
npm run seed:catalog   # also seeds grocery synonym packs
# Optional Meilisearch: set MEILI_HOST / MEILI_MASTER_KEY in .env, then:
npm run search:reindex
```

Manage search from the admin SPA (**Search** page) or legacy `http://127.0.0.1:3000/admin/search/`.
Seed an admin console user with `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` before `npm run seed`.

## Theme split

```
app/lib/core/theme/
  customer/     Premium lifestyle tokens (customer UI)
  delivery/     Logistics core tokens (delivery boy UI)
  app_theme.dart   Picks ThemeData from active AppRole
```
