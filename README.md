# Terralens — Organic & Traditional Food Marketplace

A multi-vendor marketplace where farmers and traditional food makers sell organic rice, millets,
karuvadu, spices and homemade foods to individual and wholesale buyers.

* **Frontend:** React + Vite, Tailwind CSS v4, React Router, Axios — `frontend/`
* **Backend:** FastAPI, SQLAlchemy 2, Alembic, PostgreSQL, JWT — `backend/`
* **Design & plan:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

## Run it locally

Needs Python 3.12+, Node 20+, PostgreSQL 15+.

```bash
# 1. Backend
cd backend
python3 -m venv .venv && .venv/bin/pip install -r requirements.txt
cp .env.example .env          # then fill in DATABASE_URL, JWT_SECRET, SEED_* values
createdb terralens_marketplace && createdb terralens_marketplace_test
.venv/bin/alembic upgrade head
.venv/bin/python -m app.seed --demo     # categories, admin, demo sellers/products/buyers
.venv/bin/uvicorn app.main:app --reload --port 8000

# 2. Frontend (new terminal)
cd frontend
npm install
npm run dev                   # http://localhost:5173 (proxies /api to :8000)
```

API docs (Swagger): http://localhost:8000/docs

### Demo accounts (after `--demo`)

| Role | Email |
|---|---|
| Admin | value of `SEED_ADMIN_EMAIL` (password: `SEED_ADMIN_PASSWORD`) |
| Buyer | `buyer@example.com` |
| Wholesale buyer | `wholesale@example.com` |
| Sellers | `farmer@example.com`, `karuvadu@example.com`, `spices@example.com` |

Demo buyers and sellers use `SEED_DEMO_PASSWORD` from `backend/.env`.

## Tests

```bash
cd backend && .venv/bin/python -m pytest
```

Covers auth and role guards, seller isolation, product approval, bulk pricing, min order & stock
checks, multi-seller checkout, stock restore on cancel, organic/GI badge verification rules,
file validation and private document access. Tests use `TEST_DATABASE_URL` and wipe it.

## Key rules

* Sellers must be approved by an admin before listing products; products need approval before buyers see them.
* Editing a live product's name, description, category, unit, origin or certificates sends it back for review. Price and stock changes go live immediately.
* **Organic** badge = linked certificate approved by admin and not expired. **GI** badge = linked GI record of type *registered product* or *authorised user* verified by admin. GI *applications* are reviewed but never show the badge. Uploading a document never grants a badge.
* GI review: admins can verify (needs a document), reject (needs a note) or **request more information** (needs a note). The seller then edits the record and resubmits; any seller edit sends it back to pending. Each decision stores who reviewed it and when.
* **Site settings** (Admin → Site settings): logo (PNG/JPG/WebP), site name and footer text, shown across the site.
* The search box shows live suggestions (categories and products) from `GET /api/v1/products/suggest`.
* Certificate and GI documents are private (owner + admin only). Product images are public.
* Checkout splits the cart into one order per seller, locks product rows and reduces stock. Cancelling restores stock. Payment is cash on delivery.
* Order flow: pending → confirmed → packed → shipped → delivered (or cancelled before shipping). Delivered COD orders are marked paid.

## Production notes

* Set `APP_ENV=production`, a long random `JWT_SECRET`, and `CORS_ORIGINS` to your site's URL.
* For object storage set `STORAGE_BACKEND=s3` plus the `S3_*` variables (works with AWS S3, Cloudflare R2, MinIO…) and `pip install boto3`.
* Build the frontend with `npm run build` and serve `frontend/dist/` behind the same domain as the API (or set `VITE_API_URL`).
* Run `alembic upgrade head` on each deploy. Never run `pytest` against the production database.
* Online payments are not built yet — `orders.payment_method` is ready for a gateway to be added.

## Deployment (Vercel + Neon + Cloudflare Pages)

Both deploy automatically when `main` is pushed to GitHub.

**Backend — Vercel** (root directory `backend`, FastAPI preset). Environment variables:
`DATABASE_URL` (Neon; `postgres://` URLs are accepted), `JWT_SECRET`,
`CORS_ORIGINS=https://organic-bt6.pages.dev`, `AUTO_MIGRATE=true`,
`SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`, `PUBLIC_MEDIA_URL=https://<backend>.vercel.app/media`,
optional `SEED_DEMO=true` (demo sellers and 15 products with photos) and `SEED_DEMO_PASSWORD`.
With `AUTO_MIGRATE=true` the app runs `alembic upgrade head` and creates the categories and first admin when it starts.

**Frontend — Cloudflare Pages** (root `frontend`, build `npm run build`, output `dist`).
The API address is in `frontend/.env.production`.

**Uploaded files:** Vercel's disk is temporary, so on Vercel files are stored in Postgres
(`STORAGE_BACKEND=database`, the default there). Images are resized to 1600 px WebP on upload,
and uploads must be under 4 MB (Vercel's request limit). Neon's free plan has 0.5 GB — roughly
a few thousand product photos. For more, switch to `STORAGE_BACKEND=s3`.

Demo photos come from Wikimedia Commons — see `backend/app/seed_images/CREDITS.md`.

## Admin accounts

The first admin is the **main admin** (owner). Only the main admin can add or remove admins
(Admin → Admins) and switch admin accounts on or off. Other admins can do everything else.
Every admin can change their own login email and password under Admin → My account.
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` are used only when no admin exists yet, so changing
the main admin's email later does not bring the seed account back.
