"""Seed categories, the first admin and (optionally) demo data.

    python -m app.seed            # categories + admin
    python -m app.seed --demo     # also demo sellers, products and a buyer

Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
Demo accounts use SEED_DEMO_PASSWORD. Safe to run more than once.
"""

import os
import secrets
import sys
import uuid
from pathlib import Path
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db import SessionLocal
from app.models import (
    BulkPriceTier,
    Category,
    ProductImage,
    GIRecord,
    OrganicCertification,
    Product,
    SellerProfile,
    User,
)
from app.models.enums import GIVerification, ReviewStatus, Role

CATEGORIES = [
    ("Rice & Grains", "Traditional and organic rice varieties"),
    ("Millets", "Ragi, kambu, thinai, samai and more"),
    ("Vegetables", "Fresh, seasonal vegetables from local farms"),
    ("Fruits", "Seasonal fruits, naturally ripened"),
    ("Dried Fish", "Traditional sun-dried karuvadu from coastal villages"),
    ("Spices", "Whole and ground spices, stone-milled"),
    ("Oils & Ghee", "Cold-pressed oils and traditional ghee"),
    ("Homemade Foods", "Pickles, podis, snacks and sweets made in small batches"),
    ("Regional Specialties", "Region-specific traditional foods"),
    ("Sarees & Handlooms", "GI-tagged silk and cotton sarees, fabrics and weaves"),
    ("Handicrafts", "Paintings, bronzes, carvings, jewellery and traditional crafts"),
    ("Home & Kitchen", "Lamps, cookware, grinders and locks"),
    ("Flowers", "Fresh flowers and garlands"),
]


def slug(name: str) -> str:
    import re

    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def get_or_create_user(db, email, **kw):
    user = db.scalar(select(User).where(User.email == email))
    if not user:
        user = User(email=email, **kw)
        db.add(user)
        db.flush()
    return user


def seed_base(db):
    for name, desc in CATEGORIES:
        if not db.scalar(select(Category).where(Category.slug == slug(name))):
            db.add(Category(name=name, slug=slug(name), description=desc))
    has_admin = db.scalar(select(User.id).where(User.role == Role.ADMIN).limit(1))
    if has_admin:
        # Never re-create the seed admin: the main admin may have changed their email.
        if not db.scalar(select(User.id).where(User.is_owner.is_(True)).limit(1)):
            first = db.scalar(select(User).where(User.role == Role.ADMIN).order_by(User.id))
            first.is_owner = True
    elif settings.seed_admin_email and settings.seed_admin_password:
        get_or_create_user(
            db,
            settings.seed_admin_email.lower(),
            password_hash=hash_password(settings.seed_admin_password),
            full_name="Platform Admin",
            role=Role.ADMIN,
            is_owner=True,
        )
    else:
        print("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — no admin created")
    db.commit()


def seed_demo(db):
    """Load the sample B2B catalog of Tamil Nadu GI products (see app/gi_catalog.py).

    Removes the earlier demo catalog first. Safe to run more than once: sellers that
    already exist are skipped, and products only get a photo if they have none."""
    from app.gi_catalog import OLD_DEMO_EMAILS, SELLERS

    retire_demo_accounts(db, OLD_DEMO_EMAILS + ["buyer@example.com", "wholesale@example.com"])

    password = os.environ.get("SEED_DEMO_PASSWORD") or settings.seed_admin_password
    if not password:
        # Products still appear; the sample seller logins just can't be used.
        print("SEED_DEMO_PASSWORD not set — sample sellers get a random password")
        password = secrets.token_urlsafe(24)
    pw = hash_password(password)
    cats = {c.slug: c for c in db.scalars(select(Category))}

    # One query to find which sample sellers already exist (this runs on every cold start).
    done = set(
        db.scalars(
            select(User.email)
            .join(SellerProfile, SellerProfile.user_id == User.id)
            .where(User.email.in_([sd["email"] for sd in SELLERS]))
        )
    )
    for sd in SELLERS:
        if sd["email"] in done:
            continue
        user = get_or_create_user(
            db, sd["email"], password_hash=pw, full_name=sd["name"], role=Role.SELLER
        )
        sp = SellerProfile(
            user_id=user.id,
            business_name=sd["business"],
            description=sd["desc"],
            city=sd["city"],
            state="Tamil Nadu",
            status=ReviewStatus.APPROVED,
        )
        db.add(sp)
        db.flush()
        for (name, cat, unit, price, moq, stock, tiers, desc, gi_no, _photo) in sd["products"]:
            gi = GIRecord(
                seller_id=sp.id,
                record_type="registered_product",
                gi_product_name=name.split(" (")[0],
                registration_number=f"GI Application No. {gi_no}" if gi_no else None,
                geographical_region=f"{sd['district']} district, Tamil Nadu",
                application_status="Registered",
                verification_status=GIVerification.VERIFIED,
                admin_notes="Sample data — replace with the seller's own GI documents.",
            )
            db.add(gi)
            db.flush()
            p = Product(
                seller_id=sp.id,
                category_id=cats[cat].id,
                name=name,
                description=desc,
                price=Decimal(price),
                unit=unit,
                stock=stock,
                min_order_qty=moq,
                origin=f"{sd['city']}, {sd['district']}",
                status=ReviewStatus.APPROVED,
                gi_record_id=gi.id,
            )
            p.price_tiers = [
                BulkPriceTier(min_qty=a, max_qty=b, unit_price=Decimal(c)) for a, b, c in tiers
            ]
            db.add(p)
    db.commit()
    attach_demo_images(db)
    print(f"Sample GI catalog ready: {len(SELLERS)} sellers")


def retire_demo_accounts(db, emails):
    """Remove earlier demo accounts and everything they listed. Orders already placed are
    kept: a demo seller with orders is switched off instead of deleted."""
    from sqlalchemy import exists

    from app.models import Order
    from app.services.storage import get_storage

    storage = get_storage()
    for user in db.scalars(select(User).where(User.email.in_(emails), User.is_active.is_(True))):
        sp = user.seller_profile
        if sp:
            for product in db.scalars(select(Product).where(Product.seller_id == sp.id)):
                for img in product.images:
                    storage.delete(img.path)
                db.delete(product)
            db.query(GIRecord).filter(GIRecord.seller_id == sp.id).delete()
            db.query(OrganicCertification).filter(OrganicCertification.seller_id == sp.id).delete()
        has_orders = db.scalar(
            select(exists().where((Order.buyer_id == user.id) | (Order.seller_id == (sp.id if sp else -1))))
        )
        if has_orders:
            user.is_active = False
        else:
            if sp:
                db.delete(sp)
            db.delete(user)
    db.commit()


SEED_IMAGES = Path(__file__).parent / "seed_images"


def _photo_plan():
    """Sample product name -> photo files in order, plus a fingerprint of the whole set."""
    import hashlib

    from app.gi_catalog import SELLERS

    plan: dict[str, list[tuple[str, Path]]] = {}
    overall = hashlib.md5()
    for sd in SELLERS:
        for (name, *_rest, stem) in sd["products"]:
            files = [SEED_IMAGES / f"{stem}.webp"] + [SEED_IMAGES / f"{stem}-{n}.webp" for n in range(2, 7)]
            plan[name] = []
            for f in files:
                if f.exists():
                    digest = hashlib.md5(f.read_bytes()).hexdigest()
                    plan[name].append((digest, f))
                    overall.update(f"{name}:{digest};".encode())
    return plan, overall.hexdigest()


def attach_demo_images(db):
    """Keep sample products' photos, video and key points in line with app/seed_images.

    Photos are re-synced only when the sample photo set changes (tracked in app_meta), so
    a photo an admin removes doesn't come back on the next start. Products whose photos
    were uploaded by a seller or admin (stored under products/<id>/) are never touched."""
    from sqlalchemy.orm import selectinload

    from app.gi_catalog import KEY_POINTS, SELLERS, VIDEOS
    from app.models import AppMeta
    from app.services.storage import get_storage

    plan, fingerprint = _photo_plan()
    marker = db.get(AppMeta, "sample_photos")
    resync = marker is None or marker.value != fingerprint

    storage = get_storage()
    products = db.scalars(
        select(Product)
        .join(SellerProfile, Product.seller_id == SellerProfile.id)
        .join(User, SellerProfile.user_id == User.id)
        .where(User.email.in_([sd["email"] for sd in SELLERS]))
        .options(selectinload(Product.images))
    ).all()
    for product in products:
        wanted = plan.get(product.name, [])
        uploaded_by_people = any(img.path.count("/") > 1 for img in product.images)
        if resync and not uploaded_by_people:
            want_keys = [f"products/{digest}.webp" for digest, _ in wanted]
            if [img.path for img in product.images] != want_keys:
                for img in list(product.images):
                    if img.path not in want_keys:
                        storage.delete(img.path)
                    product.images.remove(img)
                db.flush()
                for order, (digest, file) in enumerate(wanted):
                    key = f"products/{digest}.webp"
                    storage.save(key, file.read_bytes(), "image/webp")
                    product.images.append(ProductImage(path=key, sort_order=order))
        if product.key_points is None and product.name in KEY_POINTS:
            product.key_points = KEY_POINTS[product.name]
        if product.video is None and product.name in VIDEOS:
            product.video = VIDEOS[product.name]
    if resync:
        if marker:
            marker.value = fingerprint
        else:
            db.add(AppMeta(key="sample_photos", value=fingerprint))
    db.commit()


if __name__ == "__main__":
    with SessionLocal() as db:
        seed_base(db)
        if "--demo" in sys.argv:
            seed_demo(db)
    print("Seed complete")
