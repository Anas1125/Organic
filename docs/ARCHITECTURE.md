# Terralens Marketplace — Architecture & Plan

A multi-vendor marketplace for organic and traditional Indian food products
(organic rice, millets, karuvadu, spices, homemade foods…). Kept deliberately
simple: one FastAPI service, one PostgreSQL database, one React SPA.

---

## 1. System architecture

```
┌──────────────────────────┐        HTTPS / JSON (JWT bearer)        ┌───────────────────────────┐
│  React SPA (Vite)        │  ───────────────────────────────────▶   │  FastAPI  (/api/v1)        │
│  Tailwind · React Router │                                          │  routers → services → ORM  │
│  Axios client + AuthCtx  │  ◀───────────────────────────────────   │  Pydantic validation       │
└──────────────────────────┘        /media/* (product images)        └─────────────┬─────────────┘
                                                                                     │ SQLAlchemy 2
                                                     ┌───────────────────────────────┼──────────────┐
                                                     │ PostgreSQL (Alembic migrations)│  Storage     │
                                                     └───────────────────────────────┘  local / S3  │
                                                                                     └──────────────┘
```

* **Frontend** (`frontend/`): React 18 + Vite, Tailwind CSS v4, React Router, Axios.
  Role-aware layouts: public site, buyer account, seller dashboard, admin dashboard.
  Mobile gets a bottom tab bar (Home · Shop · Cart · Account) like the reference design.
* **Backend** (`backend/`): FastAPI + SQLAlchemy 2 + Alembic. JWT auth (PyJWT),
  bcrypt password hashing, role dependencies (`require_role("seller")`).
* **Files**: a small `Storage` interface. `LocalStorage` in development
  (`backend/uploads/`), `S3Storage` (any S3-compatible bucket) when `STORAGE_BACKEND=s3`.
  Product images are public (`/media/...`). Certification/GI documents are **private** —
  only the owning seller and admins can download them through an authenticated endpoint.
* **Payments**: Cash on Delivery only for v1. `payment_method` column leaves room for
  online payments later.

### Trust rules (important)
* A product shows the **Organic** badge only if it is linked to an organic certification
  that an admin has **approved** and which has **not expired**.
* A product shows the **GI** badge only if it is linked to a GI record that an admin has
  **verified**.
* Uploading a document never grants a badge by itself.
* Products are hidden from buyers until an admin approves them, and only while the seller
  account is approved and active.

---

## 2. Database schema

| Table | Key columns |
|---|---|
| `users` | id, email (unique), password_hash, full_name, phone, role (`admin`/`seller`/`buyer`), buyer_type (`individual`/`wholesale`), is_active, created_at |
| `seller_profiles` | id, user_id → users (1:1), business_name, description, address, city, state, pincode, phone, status (`pending`/`approved`/`rejected`), rejection_reason |
| `categories` | id, name (unique), slug (unique), description, is_active |
| `products` | id, seller_id → seller_profiles, category_id → categories, name, description, price, unit, stock, min_order_qty, origin, status (`pending`/`approved`/`rejected`), rejection_reason, is_active, organic_certification_id → organic_certifications (nullable), gi_record_id → gi_records (nullable) |
| `product_images` | id, product_id, path, sort_order |
| `bulk_price_tiers` | id, product_id, min_qty, max_qty (nullable = and above), unit_price |
| `organic_certifications` | id, seller_id, certification_type, certification_number, issuing_authority, issue_date, expiry_date, document_path, status (`pending`/`approved`/`rejected`), admin_notes, reviewed_at |
| `gi_records` | id, seller_id, record_type (`registered_product`/`application`/`authorised_user`), gi_product_name, registration_number, geographical_region, applicant_association, application_status, document_path, verification_status (`pending`/`verified`/`rejected`), admin_notes, reviewed_at |
| `cart_items` | id, buyer_id, product_id, quantity — unique(buyer_id, product_id) |
| `orders` | id, order_number, checkout_ref (groups orders from one checkout), buyer_id, seller_id, status, payment_method, payment_status, subtotal, total, shipping_* fields, notes |
| `order_items` | id, order_id, product_id, product_name, unit, quantity, unit_price, line_total (snapshots — prices never change after ordering) |
| `contact_messages` | id, name, email, subject, message |

Quantities are whole numbers of the product's unit (1 kg, 1 packet, 1 litre…).
Money uses `NUMERIC(12,2)`.

**Order status flow:** `pending → confirmed → packed → shipped → delivered`, or
`cancelled` (before shipping). Cancelling restores stock.

---

## 3. Backend API (`/api/v1`) — full interactive docs at `/docs`

| Area | Endpoints |
|---|---|
| Auth | `POST /auth/register`, `POST /auth/login`, `GET/PATCH /auth/me` |
| Public catalogue | `GET /categories`, `GET /products` (search, category, organic, gi, price range, sort, pagination), `GET /products/{id}`, `GET /sellers/{id}`, `POST /contact` |
| Buyer | `GET /cart`, `POST /cart/items`, `PATCH/DELETE /cart/items/{id}`, `POST /orders/checkout`, `GET /orders`, `GET /orders/{id}`, `POST /orders/{id}/cancel` |
| Seller | `GET/PUT /seller/profile`, `GET/POST /seller/products`, `GET/PATCH/DELETE /seller/products/{id}`, `POST/DELETE /seller/products/{id}/images`, `GET /seller/orders`, `PATCH /seller/orders/{id}/status`, `GET /seller/stats`, `GET/POST/DELETE /seller/certifications`, `GET/POST/DELETE /seller/gi-records` |
| Documents | `GET /documents/certifications/{id}`, `GET /documents/gi-records/{id}` (owner or admin) |
| Admin | `GET /admin/stats`, `GET/PATCH /admin/users`, `GET /admin/sellers`, `PATCH /admin/sellers/{id}/status`, `GET /admin/products`, `PATCH /admin/products/{id}/status`, `GET/POST/PATCH/DELETE /admin/categories`, `GET/PATCH /admin/certifications`, `GET/PATCH /admin/gi-records`, `GET /admin/orders`, `PATCH /admin/orders/{id}/status`, `GET /admin/messages` |

---

## 4. Frontend page structure

```
/                         Home (hero, categories, popular products)
/shop                     Marketplace (search + filters)
/products/:id             Product details (bulk price table, live price calc, certs)
/sellers/:id              Seller storefront
/about  /contact  /login  /register

/account                  Buyer profile
/cart                     Cart + checkout (split per seller)
/orders  /orders/:id      Order history & tracking

/seller                   Overview
/seller/products          My products
/seller/products/new      Add product   (/seller/products/:id/edit)
/seller/inventory         Quick stock & price editing
/seller/orders            Received orders
/seller/certifications    Organic certificates + GI records
/seller/sales             Sales overview
/seller/profile           Profile settings

/admin                    Overview stats
/admin/users  /admin/sellers  /admin/products  /admin/categories
/admin/gi  /admin/organic  /admin/orders  /admin/messages
```

---

## 5. Milestones

1. Project setup, config, database, migrations
2. Authentication & roles (JWT, bcrypt, RBAC dependencies)
3. Buyer & seller registration (seller approval workflow)
4. Seller dashboard shell + profile
5. Product management (images, tiers, min order qty, stock)
6. Organic certification & GI management (upload, review)
7. Buyer marketplace (search, filters, product & seller pages)
8. Cart & bulk pricing
9. Order management (split by seller, stock locking, status flow)
10. Admin dashboard
11. Tests, seed data, deployment notes
