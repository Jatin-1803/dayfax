# DayFax Architecture

Production-ready local quick-commerce for small towns and villages in India.

**Product name:** DayFax  
**Design source:** `design/` (Stitch export; branded LocalDash in mockups — UI uses DayFax)  
**Customer visual system:** `design/premium_lifestyle_quick_commerce/DESIGN.md`  
**Delivery partner visual system:** `design/logistics_core/DESIGN.md` (future app; shared auth/API)

## Repository layout

```
dayfax/
  app/               Single Flutter app (customer + delivery partner)
  admin/             Web admin SPA (Vite + React + TypeScript)
  backend/           Node.js + TypeScript REST API
  design/            UI source of truth (HTML + PNG + DESIGN.md)
  docs/              Architecture and delivery plan
  website/           Marketing / legal static site
```

No Docker. Local stack: Flutter + Node.js + MySQL (WAMP) + admin SPA on Vite.

## Principles

1. Simple for today’s single-town launch.
2. Schema and modules ready for multi-town, multi-store, role-specific surfaces.
3. Design fidelity first; reusable Flutter components; feature-based modules.
4. Backend is source of truth for authz, prices, inventory, and order status.
5. **One mobile binary** — customer and delivery partner share auth/network; UI themes stay separated.

## Mobile app (Flutter)

- **Pattern:** MVVM + Repository
- **State:** Riverpod (`AsyncValue` / sealed UI states — avoid boolean soup)
- **Routing:** go_router with auth redirects + role home paths
- **Structure:** `lib/core`, `lib/shared`, `lib/features/<feature>/{data,domain,presentation}`

### Themes (separate folders)

| Role | Folder | Design source |
|------|--------|----------------|
| Customer | `lib/core/theme/customer/` | `design/premium_lifestyle_quick_commerce/DESIGN.md` |
| Delivery partner | `lib/core/theme/delivery/` | `design/logistics_core/DESIGN.md` |

`AppTheme.forRole(AppRole)` switches ThemeData. Do not mix token classes across surfaces.

### Customer screens (from design)

| Flow | Design folders |
|------|----------------|
| Auth | `login`, `otp_verification_1`, `otp_verification_2` |
| Home | `home_dashboard_1` |
| Category | `modern_grocery_category` |
| Product | `product_details` |
| Cart | `your_cart` |
| Addresses | `saved_addresses` |
| Checkout | `checkout_payment` |
| Orders | `orders_history`, `order_confirmed`, `track_order` |
| Profile | `profile_dashboard` |

### Delivery partner screens (from design)

`partner_login`, `home_dashboard_2`, `deliveries_list`, `delivery_details`, `navigation_map`, `confirm_delivery`, `delivery_success` — same app, `features/delivery/` + delivery theme.

## Backend (Node.js)

```
Routes → Controllers → Services → Repositories → MySQL
```

- TypeScript, Express, Zod validation, JWT access + refresh
- Versioned REST: `/api/v1/...`
- Central errors, structured logging (no OTP/tokens in logs)
- Env-based config: development / staging / production

### Modules

`auth`, `users`, `locations`, `stores`, `categories`, `products`, `cart`, `addresses`, `orders`, `payments`, `delivery`, `notifications`

## Multi-town / multi-store (V1-ready schema)

Even with one town and one store seeded:

- `locations` → geographic places
- `service_areas` → operable delivery footprints
- `delivery_zones` → zone rules / fees
- `stores` → merchants in a service area
- Products and inventory are **store-scoped** (`store_products`, `inventory`)

No hardcoded city/area names in business logic.

## Auth & roles

Phone → OTP → verify → profile → roles from backend.

Roles: `CUSTOMER`, `DELIVERY_PARTNER`, `ADMIN`  
Customer app only exposes customer features; never trust client for authorization.

### Admin web

Separate Vite + React SPA in `admin/`. Auth is **email + password** against the `admin_users` table (`POST /api/v1/admin/auth/login`). JWT includes `principal: 'admin'` and `roles: ['ADMIN']`. Manages stores, catalog, orders, partners, users, zones, i18n strings, and search ops via `/api/v1/admin/*`.

## Order lifecycle

```
PENDING → CONFIRMED → PREPARING → READY_FOR_PICKUP
  → PICKED_UP → OUT_FOR_DELIVERY → DELIVERED
CANCELLED (validated transitions only)
```

Status changes only via backend services with transition rules.

## Tracking

V1: status + partner summary + ETA via REST.  
Interfaces reserved for later WebSocket GPS / live ETA without rewriting order domain.

## Data identifiers

UUIDs (`CHAR(36)`) for public IDs; timestamps + soft delete where appropriate; indexes for real query patterns (user, store, status, category, service area).
