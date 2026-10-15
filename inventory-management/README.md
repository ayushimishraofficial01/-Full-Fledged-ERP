# StockPilot — Multi-Warehouse Inventory Management

A multi-warehouse inventory system you can deploy. It includes inventory, CRM, and opt-in field sales visits: products, warehouses, per-warehouse stock, stock in, stock out, transfers, a complete movement ledger, low-stock alerts, Excel import/export, reports, and authentication.

- **Frontend:** React 18, Vite 6, Tailwind CSS 4, React Router 6, Axios, lucide icons
- **Backend:** Node.js 18+, Express 4, JWT (httpOnly cookie), bcrypt, Multer, Zod validation, Helmet, rate limiting
- **Database:** MongoDB with Mongoose 8. It uses multi-document transactions when the server supports them.
- **Excel:** SheetJS (`xlsx`)

---

## 1. Architecture

```
Browser (React SPA)
   │  httpOnly JWT cookie, JSON / multipart
   ▼
Express API  ── /api/auth, /products, /warehouses, /inventory, /stock, /reports, /import, /export, /dashboard, /units, /settings, /crm, /sales-visits, /orders
   │  routes → validate (zod) → controllers → services
   │                                   │
   │                      stock.service ── runAtomic() ── MongoDB transaction (replica set / Atlas)
   │                                                      or atomic conditional updates + compensation (standalone)
   ▼
MongoDB  (users, warehouses, products, inventories, stocktransactions, stocktransfers, units, settings)
```

**Layers (server/src):**

| Layer | Responsibility |
|---|---|
| `routes/` | URL → middleware → controller wiring. Every route after `/auth` requires authentication. |
| `validators/` | Zod schemas. They whitelist and coerce input, so unknown fields never reach MongoDB. |
| `controllers/` | HTTP concerns only: status codes and response shape. |
| `services/` | Business logic. All stock rules live in `stock.service.js` and `transaction.service.js`. |
| `models/` | Mongoose schemas and indexes. |
| `middleware/` | Auth, error mapping, sanitising, uploads, rate limits. |

### How stock stays correct

1. **Product ≠ inventory.** The `Product` document never stores quantity. Every product × warehouse pair has its own `Inventory` document, protected by a unique index on `{product, warehouse}`.
2. **Stock out and the source side of a transfer use a conditional atomic update:**
   `findOneAndUpdate({product, warehouse, quantity: {$gte: q}}, {$inc: {quantity: -q}})`.
   If there isn't enough stock, nothing matches, nothing changes, and the API returns `Insufficient stock. Available quantity is 300 PCS.` Because the check and the write are a single operation, two concurrent requests cannot oversell. The test suite fires 10 parallel requests to confirm this.
3. **Transfers:** the source is decremented first, so the operation fails fast. Then the destination is incremented, two ledger lines are written (`TRANSFER_OUT` and `TRANSFER_IN`), and a `StockTransfer` header links them. On a replica set or Atlas this all happens inside one MongoDB transaction. On a standalone mongod, every step registers a compensating action, and those run in reverse if a later step fails.
4. **Every movement writes an immutable `StockTransaction`** recording `balanceAfter`, `performedBy` and the business `date`.
5. **Decimal quantities** (for example 12.345 KG) are rounded to 3 decimals, and floating-point drift is cleaned after each update.

---

## 2. Database design

| Collection | Key fields | Indexes |
|---|---|---|
| **users** | name, email, password (bcrypt, `select:false`), role, status, tokenVersion, passwordResetToken (sha256), passwordResetExpires | email unique |
| **warehouses** | name, code, location, address, city, state, pincode, contactPerson, contactNumber, status, isArchived, createdBy/updatedBy | code unique, name, {isArchived,status} |
| **products** | name, sku, image, category, brand, hsn, **size**, **unit**, **stockUnit**, minimumStock, description, status, isArchived | sku unique, name, hsn, category |
| **inventories** | product, warehouse, quantity (≥0), unit, lastTransactionAt | {product,warehouse} unique, {warehouse,quantity} |
| **stocktransactions** | product, warehouse, type (STOCK_IN/STOCK_OUT/TRANSFER_IN/TRANSFER_OUT), quantity, unit, balanceAfter, referenceNumber, supplier, reason, notes, transfer, counterpartWarehouse, source, performedBy, date | {date}, {product,date}, {warehouse,date}, {type,date}, {transfer} |
| **stocktransfers** | product, fromWarehouse, toWarehouse, quantity, unit, referenceNumber, notes, outTransaction, inTransaction, performedBy, date | {date}, {product,date}, {from,date}, {to,date} |
| **sales staff** | user reference, office schedule (weekdays, hours, timezone), parent record for sales history | user unique |
| **sales shifts** | salesStaff + user references, consentAt, startedAt/endedAt, latestLocation, bounded location samples | one active shift per sales staff and user |
| **sales visits** | salesStaff + user + shift references, placeName, 150 m geofence, check-in/out locations and times, private photo evidence, bounded customer product requirements with product snapshots | {salesStaff,checkIn.at}, {shift,checkOut.at} |
| **sales orders** | order number, customer contact/address, product and quantity snapshots, status, source, optional sales visit link, creator | order number unique, sales visit unique, {status,orderDate}, {createdBy,orderDate} |
| **units** | name, key (upper-case), label, category, isSystem, isActive | key unique |
| **settings** | key, value | key unique |

Products can optionally store a selling price in INR per stock unit. Prices can be overridden per order item or field-visit requirement; saved orders keep the quoted unit price, line totals, and order total. Sales-visit product requirements are copied into a linked pending sales order at check-in. Existing visit requirements are backfilled when the Orders list is first opened. Orders can also be entered manually and tracked through their statuses; recording an order does not change inventory.

**Size, unit and stock unit.** `size` + `unit` describe the item itself (for example, Product 1 at 250 ML). `stockUnit` is what warehouses count it in (PCS). This settles the spec's two examples ("250 ML" in Excel and "250 | PCS" on the inventory page): a 250 ML product is stocked in PCS, and a 50 KG raw-material sack can be stocked in Bag. Inventory and ledger lines always use `stockUnit`. Once any stock has moved, `stockUnit` is locked so history can't be reinterpreted.

---

## 3. Folder structure

```
inventory-management/
├── package.json              root scripts (dev runs API + web together)
├── docker-compose.yml        local MongoDB replica set (enables transactions)
├── deploy.nginx.conf         example production Nginx site
├── android-sales/            Android WebView and native field-sales app
│   ├── gradlew(.bat)          Gradle wrapper scripts
│   ├── gradle/wrapper/        wrapper JAR and version configuration
│   └── app/src/main/          Android application source and resources
├── server/
│   ├── .env.example
│   ├── ecosystem.config.js   PM2
│   ├── uploads/products/     product images (random filenames)
│   ├── tests/                integration tests (node:test + supertest)
│   └── src/
│       ├── server.js  app.js
│       ├── config/       env.js, db.js
│       ├── models/       User, Warehouse, Product, Inventory, StockTransaction, StockTransfer, Unit, Setting
│       ├── middleware/   auth, errorHandler, validate, sanitize, upload, rateLimit
│       ├── validators/   auth, product, warehouse, stock (zod)
│       ├── controllers/  auth, product, warehouse, inventory, stock, report, excel, dashboard, settings
│       ├── services/     stock, transaction, inventory, product, ledger, dashboard, import, export, unit, email
│       ├── routes/
│       ├── utils/        ApiError, query helpers, stock status, units
│       └── seed/seed.js
└── client/
    ├── vite.config.js    dev proxy /api and /uploads to :5000
    └── src/
        ├── App.jsx  main.jsx  index.css (design tokens)
        ├── context/      AuthContext, ToastContext, MetaContext (units, warehouses, categories, settings)
        ├── hooks/        useFetch, useListParams (table state in URL), useDebounce
        ├── services/     api.js (axios, error parsing, downloads), index.js (endpoints)
        ├── layouts/      AppLayout (sidebar/drawer), AuthLayout, navigation.js
        ├── components/
        │   ├── ui/        Button, Field/Input/Select, DataTable, Pagination, Modal, ConfirmDialog, Badge, StatCard,
        │   │              EmptyState/ErrorState, SearchInput, FilterBar, DateRange, ExportButton, ProductPicker, …
        │   ├── inventory/ InventoryTable, InventoryFilters, SummaryTiles, UnitSelect, ImageUpload, DeleteProductDialog
        │   └── stock/     StockWidgets, TransactionTimeline, ProductFilter, useStockPrefill
        └── pages/        auth/*, Dashboard, products/*, warehouses/*, inventory/*, stock/*, reports/Reports,
                          ExcelCenter, Settings, Profile, NotFound
```

---

## 4. Getting started (local)

Requirements: **Node 18.18+** and **MongoDB 6+**. MongoDB can be local, Docker or Atlas.

```bash
# 1. install
npm run install:all

# 2. MongoDB. Pick one:
docker compose up -d          # replica set, transactions ON
#   MONGO_URI=mongodb://127.0.0.1:27017/inventory_management?replicaSet=rs0&directConnection=true
# or use a plain local mongod (transactions OFF, compensation mode) or a free Atlas cluster (transactions ON)

# 3. configure
cp server/.env.example server/.env      # set MONGO_URI and a long JWT_SECRET

# 4. demo data (1 user, 3 warehouses, 5 products, 21 stock movements)
npm run seed:reset
#   login: demo@inventory.local / Demo@1234

# 5. run API (:5000) + web (:5173)
npm run dev
```

## Field sales visits

Under **Settings → User & Access → Roles & Permissions**, admins can create custom roles, select granular permissions, and assign those roles when creating or updating users. System roles remain protected from deletion, and assigned custom roles cannot be deleted until users are reassigned.

Admins can create users with the **Sales** role under **Settings → User & Access**, set weekdays, start/end times, and an IANA timezone (default example: Asia/Kolkata). Login/profile data stays in `User`; each sales profile, its office schedule, and its history are connected through `SalesStaff`. Shifts and visits remain separate bounded records linked to that sales profile (avoiding unbounded history arrays on one document). Existing user schedules and shift/visit links are migrated into `SalesStaff` when the server starts. Those office hours gate working-hour start and location sampling. The **Sales Visits → Team Overview** screen filters by sales user, pages through shifts, and shows visit times, duration, recent GPS samples, and private photo evidence.

Sales users with the `sales_visits.track` permission can start working hours and check in/out at a location with a 150 metre geofence. Checking out requires a photo; visit evidence is stored outside the public uploads directory and served only to the visit owner or a user with `sales_visits.view`. Admin and Manager system roles receive tracking and team-view permissions. The Sales and standard User roles receive tracking permission; custom roles can be granted these permissions in User & Access.

Sales users can submit dated expenses with an amount and notes from **Sales → My Expenses**. Each entry is tied to the signed-in user and the expense list only returns that user's records.

Admins can review all sales expenses, orders, and field visits from **Sales → Sales Overview**, with shared date and employee filters and totals for each record type.

At check-in, staff can add up to 50 customer product requirements from the active catalog, choose an active unit (for example PCS, KG, or a company-defined unit), and enter a positive requested quantity and optional note. The chosen unit is recorded as entered; no unit conversion is performed. Product name, SKU, and unit are snapshotted on the visit, so the employee's history and manager Team Overview retain what was requested even if the catalog entry later changes.

The employee captures their visit photo from **Sales Visits → My Field Visits** after checking in; the phone's **Take photo** button opens the rear camera and shows a preview before check-out. **Team Overview** is for managers to review the saved photo evidence.

**Android app:** the project in [`android-sales/`](./android-sales/) combines a secure WebView for the existing inventory/CRM screens with native Sales visit and background-location features. Set the deployed HTTPS web-app origin to use the portal; the native tracking section also needs the public HTTPS API origin. These are server addresses, not API keys. The app requires Android Studio/JDK 17/Android SDK 35 to build. Background tracking requires staff consent and precise/background location permissions; Android Force Stop, revoked permissions, shutdown, network/location loss, and battery controls can interrupt it. GPS can be inaccurate or spoofed. Use HTTPS for deployed sites.

The browser/PWA continues to record GPS only while open and online; use the native Android Sales service for locked-screen location tracking.

Open http://localhost:5173. Vite proxies `/api` and `/uploads` to the API, so the auth cookie works with no CORS setup.

The server logs whether transactions are on: `MongoDB transactions: enabled (replica set)`.

---

## 5. Tests

```bash
TEST_MONGO_URI=mongodb://127.0.0.1:27017/ims_test npm test   # the database is dropped
```

The suite has 35 integration tests covering:

- auth, hashing, logout, reset password
- unique SKU and warehouse code
- HSN and image validation, including magic-byte checks
- the section-41 scenario (1000 + 500 − 200 − 300 → Kanpur 1000, Lucknow 300), with a full ledger and `balanceAfter` values
- the negative-stock message, same-warehouse transfer, and oversized transfer (nothing changes)
- 10 concurrent stock-outs (exactly 6 succeed)
- decimal quantities (0.1 + 0.2 − 0.3 = 0)
- inventory status, dashboard, report totals, and all Excel exports (parsed back)
- Excel import: preview without writes, row errors, commit of valid rows, 422 on invalid commits, missing columns
- delete and archive rules, locked stock unit, operator-injection and regex-injection guards
- working-hours consent, foreground location sampling, geofence boundaries, check-in/out, photo validation and private evidence access

---

## 6. API reference

All responses have the shape `{ success, message?, ... }`. Errors have the shape `{ success:false, message, errors?: [{field, message}] }`, with the status set to 400, 401, 403, 404, 409, 422 or 500 as appropriate. Internal errors are logged on the server and never sent to the client.

| Area | Endpoints |
|---|---|
| Auth | `POST /api/auth/register` · `POST /login` · `POST /logout` · `POST /logout-all` · `GET /me` · `POST /forgot-password` · `POST /reset-password/:token` · `PUT /profile` · `PUT /password` |
| Products | `GET /api/products` (search, category, unit, stockStatus, status, archived, sort, order, page, limit) · `GET /categories` · `GET /:id` · `POST /` (multipart, optional `image`) · `PUT /:id` · `DELETE /:id` (delete or archive) · `PATCH /:id/restore` |
| Warehouses | `GET /api/warehouses` (`?all=true` for dropdowns) · `GET /:id` · `POST /` · `PUT /:id` · `DELETE /:id` · `PATCH /:id/restore` |
| Inventory | `GET /api/inventory` (warehouse, product, category, unit, stockStatus incl. `LOW_OR_OUT`, search, withSummary) · `GET /warehouse/:warehouseId` · `GET /product/:productId` · `GET /low-stock` · `GET /available?product=&warehouse=` |
| Stock | `POST /api/stock/in` · `POST /out` · `POST /transfer` · `GET /transactions` (type, warehouse, product, from, to, search, withTotals) · `GET /transfers` |
| Reports | `GET /api/reports/inventory` · `/stock-in` · `/stock-out` · `/transfers` (all paginated, with totals by unit) |
| Excel | `GET /api/import/template` · `POST /api/import/products/preview` (multipart `file`) · `POST /api/import/products` (confirmed rows, re-validated) · `GET /api/export/products` · `/inventory` · `/transactions` (`type=STOCK_IN` or `STOCK_OUT`) · `/transfers` · `/warehouses` (all accept the list filters) |
| Dashboard | `GET /api/dashboard/summary?from=&to=` (client sends its local "today") |
| Settings | `GET/PUT /api/settings` · `GET/POST /api/units` · `PATCH /api/units/:id/toggle` · `DELETE /api/units/:id` |
| Sales visits | `GET /api/sales-visits/current` · `POST /shifts/start` · `POST /shifts/location` · `POST /shifts/end` · `POST /visits/check-in` · `POST /visits/:id/check-out` (multipart `image`) · `GET /history` · `GET /team` · `GET /visits/:id/photo` |

---

## 7. Business rules (as implemented)

| Rule | Behaviour |
|---|---|
| Stock never negative | Conditional atomic decrement; returns 400 `Insufficient stock. Available quantity is X <unit>.` |
| Transfer | Same warehouse → 400. Insufficient source → 400, and neither side changes. Destination must be active. |
| Stock status | `qty = 0` → OUT_OF_STOCK · `qty < minimumStock` → LOW_STOCK · otherwise IN_STOCK. Applied per warehouse record, and to the product total on the product list. |
| Delete product | Has stock → 409 (move it first). Has history → archived (hidden, restorable, ledger kept). Otherwise hard-deleted along with its image. |
| Delete warehouse | Same pattern: stock → 409, history → archived, otherwise deleted. |
| Inactive product | Can't receive Stock In. Existing stock can still go out or be transferred. |
| Inactive warehouse | Can't receive stock, including as a transfer destination. |
| Unit | Must equal the product's `stockUnit` (the UI locks it). Units are data: add them in **Settings → Units**. |
| Excel import | Upload → parse → validate → preview (nothing written) → confirm → **server re-validates** → atomic write. Existing SKUs get stock added. Details are only overwritten when "Update existing product details" is ticked. The same SKU with different name, size, unit or stock unit in one file is an error. The same SKU and warehouse twice is an error. Quantities are posted as `STOCK_IN` with reference `IMP-yyyymmddhhmmss`. |
| Audit | `performedBy`, `createdBy` and `updatedBy` are recorded on every write. |

---

## 8. Security

- Passwords are hashed with bcrypt (12 rounds) and never returned.
- JWTs are HS256 and stored in an **httpOnly, SameSite** cookie (`Secure` in production). `tokenVersion` revokes all sessions on logout-all, password change and password reset.
- Rate limits: auth endpoints allow 20 requests per 15 minutes; the API overall allows 600 per minute.
- Zod whitelists every body. A sanitiser strips `$` and `.` keys. Query values are flattened to strings. Search input is regex-escaped.
- Image uploads check extension, MIME type and magic bytes, and are stored under random names with a 2 MB limit. Excel uploads are held in memory with limits on size (10 MB) and rows (10,000).
- Helmet, a strict CORS allow-list (`CLIENT_URL`), and no secrets in source. Production refuses to start without a 32+ character `JWT_SECRET`.
- Password reset tokens are 32 random bytes, stored as SHA-256, expire after 30 minutes and are single-use. The response is the same whether or not the email exists.
- Set `ALLOW_REGISTRATION=false` after creating your accounts. All registered users share one workspace (see section 11).

---

## 9. Deployment

### Option A: single VPS (Ubuntu) with Nginx + PM2

```bash
git clone <repo> /var/www/inventory-management && cd /var/www/inventory-management
npm run install:all && npm run build                 # client/dist
cp server/.env.example server/.env                   # NODE_ENV=production, Atlas MONGO_URI, JWT_SECRET,
                                                     # CLIENT_URL=https://inventory.example.com, COOKIE_SECURE=true, TRUST_PROXY=1
npm i -g pm2 && cd server && pm2 start ecosystem.config.js --env production && pm2 save
sudo cp ../deploy.nginx.conf /etc/nginx/sites-available/inventory && sudo ln -s ../sites-available/inventory /etc/nginx/sites-enabled/
sudo certbot --nginx -d inventory.example.com        # HTTPS
```

Back up `server/uploads/`, or mount it on persistent storage.

### Option B: one Node process serves everything

Set `SERVE_CLIENT=true` and the API serves `client/dist` on the same origin. This works on Render, Railway, or any host that builds with `npm run install:all && npm run build` and starts with `npm start`. Use a persistent disk for `uploads/`.

### Option C: separate frontend host (Vercel or Netlify) and API host

- Client: set `VITE_API_URL=https://api.example.com`, then build.
- Server: `CLIENT_URL=https://app.example.com`, `COOKIE_SAMESITE=none`, `COOKIE_SECURE=true`.

**Database:** MongoDB Atlas is recommended. It is always a replica set, so transfers and imports run as true transactions.

---

## 10. Extending later

The codebase is built to accept these without a rewrite:

- **Roles and permissions:** `User.role` already exists, and `authorize('admin')` middleware is ready to put on routes.
- **Suppliers and purchases:** `StockTransaction.supplier` and `referenceNumber` already exist. Add a `Supplier` model, then call `stockService.stockIn()` from a purchase-receipt service.
- **Sales:** call `stockService.stockOut()` from an order-fulfilment service. The stock rules stay in one place.
- **Barcode/QR:** add a `barcode` field and index to Product. The ProductPicker already searches server-side.
- **Notifications and alerts (email, WhatsApp):** `email.service.js` exists. Low-stock detection is a single query (`listInventory({stockStatus:'LOW_OR_OUT'})`) that can run on a cron.
- **Multiple companies:** add `organization` to each model and to the auth token, then filter in the services. Every query already goes through a service function.
- **Audit logs:** the ledger is already immutable. Add a generic `AuditLog` for master-data edits.

---

## 11. Assumptions and known limitations

- **Transactions were verified in fallback mode only.** The build environment had no real MongoDB, so the test suite ran against FerretDB 2.7 (the MongoDB wire protocol on PostgreSQL/DocumentDB), which doesn't support multi-document transactions. The replica-set transaction path (`session.withTransaction`) is standard Mongoose code but hasn't been executed here. Run `npm test` once against `docker compose` or Atlas before going live.
- **Shared workspace.** Every logged-in user sees the same warehouses and stock, as in a single company. That's why `ALLOW_REGISTRATION` exists. Per-company isolation is in section 10.
- **Total stock across units.** The dashboard's "Total Current Stock" adds numbers across units, as the spec asked. The UI shows a per-unit breakdown and a note so the figure isn't misread.
- **No unit conversion.** Stock is entered in the product's stock unit; 2 Dozen is not converted to 24 PCS.
- **SheetJS advisory.** The npm `xlsx@0.18.5` has two published advisories (prototype pollution and ReDoS when parsing untrusted files). The fixed builds are only on SheetJS's own CDN, which this build environment couldn't reach. It's mitigated here (authenticated users only, 10 MB and 10,000-row limits, first sheet only, keys sanitised), but before production run:
  `npm i --prefix server https://cdn.sheetjs.com/xlsx-0.20.3/xlsx-0.20.3.tgz` (same API).
- **Dates** are shown in the browser's timezone. Excel exports use `APP_TIMEZONE` (default Asia/Kolkata).
- **Email:** without SMTP settings, reset links are printed to the server log. In development they are also shown on screen.
