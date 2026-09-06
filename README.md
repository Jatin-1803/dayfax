# Dailyfax

Local quick-commerce for small towns and villages in India.

| Layer | Stack |
|-------|--------|
| Mobile app | **One Flutter app** — customer + delivery partner |
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

```bash
cd app
flutter pub get
flutter run --dart-define=ENV=development --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

After OTP login, backend roles decide the surface:

- `CUSTOMER` → customer home + customer theme
- `DELIVERY_PARTNER` → partner home + delivery theme

## Repository

```
app/            Single Flutter app (customer + delivery)
backend/        REST API
design/         Screen designs + design systems
docs/           Architecture and plan
```

## Theme split

```
app/lib/core/theme/
  customer/     Premium lifestyle tokens (customer UI)
  delivery/     Logistics core tokens (delivery boy UI)
  app_theme.dart   Picks ThemeData from active AppRole
```
