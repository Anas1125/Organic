"""Seed categories, the first admin and (optionally) demo data.

    python -m app.seed            # categories + admin
    python -m app.seed --demo     # also demo sellers, products and a buyer

Admin credentials come from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD.
Demo accounts use SEED_DEMO_PASSWORD. Safe to run more than once.
"""

import os
import sys
from datetime import date, timedelta
from decimal import Decimal

from sqlalchemy import select

from app.core.config import settings
from app.core.security import hash_password
from app.db import SessionLocal
from app.models import (
    BulkPriceTier,
    Category,
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
    if settings.seed_admin_email and settings.seed_admin_password:
        get_or_create_user(
            db,
            settings.seed_admin_email.lower(),
            password_hash=hash_password(settings.seed_admin_password),
            full_name="Platform Admin",
            role=Role.ADMIN,
        )
    else:
        print("SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD not set — no admin created")
    db.commit()


def seed_demo(db):
    password = os.environ.get("SEED_DEMO_PASSWORD") or settings.seed_admin_password
    if not password:
        print("Set SEED_DEMO_PASSWORD to create demo accounts")
        return
    pw = hash_password(password)
    cats = {c.slug: c for c in db.scalars(select(Category))}

    get_or_create_user(
        db, "buyer@example.com", password_hash=pw, full_name="Priya Raman", role=Role.BUYER
    )
    get_or_create_user(
        db,
        "wholesale@example.com",
        password_hash=pw,
        full_name="Chennai Fresh Mart",
        role=Role.BUYER,
        buyer_type="wholesale",
    )

    sellers = [
        dict(
            email="farmer@example.com",
            name="Murugan K",
            business="Cauvery Delta Organics",
            desc="Third-generation paddy farmers in Thanjavur growing traditional rice and millets "
            "without chemicals.",
            city="Thanjavur",
            cert=True,
            products=[
                ("Mappillai Samba Rice", "rice-grains", 140, "kg", 200, 1, "Thanjavur, Tamil Nadu",
                 "Red traditional rice known for strength and stamina. Hand-pounded, unpolished.",
                 [(1, 5, 140), (6, 25, 128), (26, None, 115)]),
                ("Karuppu Kavuni Black Rice", "rice-grains", 220, "kg", 80, 1, "Thanjavur, Tamil Nadu",
                 "Heritage black rice rich in antioxidants. Ideal for kheer and porridge.", []),
                ("Organic Ponni Rice", "rice-grains", 100, "kg", 500, 5, "Kumbakonam, Tamil Nadu",
                 "Everyday soft-cooking rice, grown organically. Sold in 5 kg minimum.",
                 [(5, 5, 100), (6, 25, 90), (26, 100, 80)]),
                ("Ragi (Finger Millet)", "millets", 85, "kg", 150, 1, "Krishnagiri, Tamil Nadu",
                 "Whole finger millet, cleaned and sun-dried. High in calcium.", [(10, None, 75)]),
                ("Thinai (Foxtail Millet)", "millets", 120, "kg", 90, 1, "Dharmapuri, Tamil Nadu",
                 "Foxtail millet for upma, pongal and dosa.", []),
            ],
        ),
        dict(
            email="karuvadu@example.com",
            name="Selvi A",
            business="Rameswaram Sea Harvest",
            desc="Women-led fishing collective sun-drying karuvadu the traditional way on the "
            "Rameswaram coast.",
            city="Rameswaram",
            cert=False,
            products=[
                ("Nethili Karuvadu (Dried Anchovy)", "dried-fish", 450, "kg", 40, 1,
                 "Rameswaram, Tamil Nadu", "Salt-cured and sun-dried anchovies. Clean, sand-free.",
                 [(1, 4, 450), (5, None, 410)]),
                ("Vanjaram Karuvadu (Seer Fish)", "dried-fish", 1200, "kg", 15, 1,
                 "Rameswaram, Tamil Nadu", "Premium dried seer fish slices.", []),
                ("Sura Karuvadu (Shark)", "dried-fish", 380, "packet", 60, 1, "Pamban, Tamil Nadu",
                 "250 g packet. Traditional favourite for kuzhambu.", []),
            ],
        ),
        dict(
            email="spices@example.com",
            name="Anitha Joseph",
            business="Malabar Spice Collective",
            desc="Smallholder spice growers from Idukki and Wayanad.",
            city="Idukki",
            cert=True,
            gi=True,
            products=[
                ("Alleppey Green Cardamom", "spices", 320, "packet", 120, 1, "Idukki, Kerala",
                 "100 g packet of bold 8 mm green cardamom.", [(10, 49, 300), (50, None, 280)]),
                ("Malabar Black Pepper", "spices", 90, "packet", 300, 1, "Wayanad, Kerala",
                 "100 g packet of sun-dried whole black pepper.", []),
                ("Cold-Pressed Coconut Oil", "oils-ghee", 380, "litre", 70, 1, "Kozhikode, Kerala",
                 "Wood-pressed (chekku) coconut oil from sun-dried copra.", []),
                ("Manga Inji Pickle", "homemade-foods", 160, "packet", 45, 1, "Thrissur, Kerala",
                 "Mango-ginger pickle in gingelly oil. 250 g jar.", []),
            ],
        ),
    ]

    for sd in sellers:
        user = get_or_create_user(
            db, sd["email"], password_hash=pw, full_name=sd["name"], role=Role.SELLER
        )
        sp = db.scalar(select(SellerProfile).where(SellerProfile.user_id == user.id))
        if sp:
            continue
        sp = SellerProfile(
            user_id=user.id,
            business_name=sd["business"],
            description=sd["desc"],
            city=sd["city"],
            state="Kerala" if sd["city"] == "Idukki" else "Tamil Nadu",
            status=ReviewStatus.APPROVED,
        )
        db.add(sp)
        db.flush()

        cert = None
        if sd.get("cert"):
            cert = OrganicCertification(
                seller_id=sp.id,
                certification_type="NPOP (India Organic)",
                certification_number=f"NPOP/DEMO/{sp.id:04d}",
                issuing_authority="Demo Certification Body",
                issue_date=date.today() - timedelta(days=200),
                expiry_date=date.today() + timedelta(days=165),
                status=ReviewStatus.APPROVED,
                admin_notes="Demo data",
            )
            db.add(cert)
        gi = None
        if sd.get("gi"):
            gi = GIRecord(
                seller_id=sp.id,
                record_type="authorised_user",
                gi_product_name="Alleppey Green Cardamom",
                registration_number="DEMO-GI-0001",
                geographical_region="Idukki, Kerala",
                applicant_association="Demo Cardamom Growers Association",
                application_status="Registered",
                verification_status=GIVerification.VERIFIED,
                admin_notes="Demo data",
            )
            db.add(gi)
        db.flush()

        for name, cat, price, unit, stock, moq, origin, desc, tiers in sd["products"]:
            p = Product(
                seller_id=sp.id,
                category_id=cats[cat].id,
                name=name,
                description=desc,
                price=Decimal(price),
                unit=unit,
                stock=stock,
                min_order_qty=moq,
                origin=origin,
                status=ReviewStatus.APPROVED,
                organic_certification_id=cert.id if cert and cat != "homemade-foods" else None,
                gi_record_id=gi.id if gi and "Cardamom" in name else None,
            )
            p.price_tiers = [
                BulkPriceTier(min_qty=a, max_qty=b, unit_price=Decimal(c)) for a, b, c in tiers
            ]
            db.add(p)
    db.commit()
    print("Demo data ready (password: SEED_DEMO_PASSWORD from .env)")


if __name__ == "__main__":
    with SessionLocal() as db:
        seed_base(db)
        if "--demo" in sys.argv:
            seed_demo(db)
    print("Seed complete")
