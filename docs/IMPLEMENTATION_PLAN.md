# Implementation Plan — DayFax

Phased delivery. Each phase must meet Definition of Done (UI + API + loading/empty/error + tests + analyzer clean) before the next feature expands.

## Phase 0 — Foundation (current)

- [x] Inspect design system and screens
- [x] Copy designs into `design/`
- [x] Document architecture
- [x] Backend scaffold (Express TS, config, errors, logger, DB)
- [x] MySQL migrations + seed (one service area, one store)
- [x] Flutter feature folders, theme tokens, core network/storage/routing
- [x] Shared UI primitives (button, text field, search, empty/error/loading)

## Phase 1 — Authentication

- [x] Phone + OTP request/verify APIs
- [x] Secure token storage
- [x] Auth guard routing
- [x] Login + OTP screens matching design (DayFax branding)
- [ ] Token refresh interceptor polish + logout UX

## Phase 2 — Catalog

- [x] Categories + products + variants (paginated list + detail)
- [x] Home, category browse, product details wired to API
- [x] Debounced search API (`q`, 350ms client debounce)
- [ ] Locations/service areas resolution (address-driven; deferred with Phase 3 addresses)

## Phase 3 — Cart & addresses

- Server cart with optimistic UI
- Address CRUD
- Price/inventory validation on mutate

## Phase 4 — Checkout & orders

- [x] Checkout + payment stub (COD first; gateway-ready)
- [x] Order create + history + detail
- [x] Status timeline for tracking
- [ ] Partner status transitions (Phase 5)

## Phase 5 — Delivery interfaces

- Assignment + status history APIs
- Customer track screen (REST)
- Partner app deferred; shared role-ready auth

## Phase 6 — Hardening

- Offline/cache polish, image sizing, performance pass
- Integration tests for critical flows
- Staging/production env configs

## Local development (no Docker)

### MySQL (WAMP)

```bash
# Example path — adjust to installed MySQL under WAMP
c:\wamp64\bin\mysql\mysql8.4.7\bin\mysql.exe -u root -e "CREATE DATABASE IF NOT EXISTS dailyfax CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
```

### Backend

```bash
cd backend
cp .env.example .env
npm install
npm run migrate
npm run seed
npm run dev
```

API default: `http://localhost:3000/api/v1`

### Flutter

```bash
cd app
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:3000/api/v1
```

Use machine LAN IP for physical devices instead of `10.0.2.2`.

## Assumptions (documented)

1. **Brand:** Product name is **DayFax** (design mockups say LocalDash).
2. **Currency:** INR (₹); design $ amounts treated as placeholders.
3. **OTP:** Dev mode returns/logs a fixed or console OTP; production SMS provider via env.
4. **Payments V1:** Cash on delivery + payment records table; online gateway later.
5. **Pharmacy/Meat** on home design are optional categories — seeded only if product strategy includes them; core V1 is Food, Grocery, Vegetables.
6. **Single service area** seeded for launch; schema supports many.
