"""Brand settings (site name, tagline, logo) — public read, admin-only write."""

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, EmailStr, Field, field_validator
from sqlalchemy.orm import Session

from app.core.deps import require_admin
from app.db import get_db
from app.models import SiteSettings
from app.services.storage import get_storage, media_url, save_upload

router = APIRouter(tags=["Site settings"])

DEFAULT_TAGLINE = (
    "Organic and traditional food straight from farmers, fishing families and home kitchens. "
    "Every organic and GI badge is checked by our team."
)


class SiteSettingsOut(BaseModel):
    site_name: str
    tagline: str | None
    logo_url: str | None
    contact_email: str | None
    contact_phone: str | None
    contact_hours: str | None
    locations: list[str]


def _blank_to_none(v):
    return v.strip() or None if isinstance(v, str) else v


class SiteSettingsIn(BaseModel):
    site_name: str = Field(min_length=1, max_length=60)
    tagline: str | None = Field(default=None, max_length=300)
    contact_email: EmailStr | None = None
    contact_phone: str | None = Field(default=None, pattern=r"^[0-9+\-() ]{7,30}$")
    contact_hours: str | None = Field(default=None, max_length=120)
    locations: list[str] = Field(default_factory=list, max_length=10)

    _blank = field_validator(
        "tagline", "contact_email", "contact_phone", "contact_hours", mode="before"
    )(_blank_to_none)

    @field_validator("locations")
    @classmethod
    def clean_locations(cls, v: list[str]) -> list[str]:
        out = [loc.strip() for loc in v if loc and loc.strip()]
        if any(len(loc) > 200 for loc in out):
            raise ValueError("Each location must be 200 characters or fewer")
        return out


def get_settings_row(db: Session) -> SiteSettings:
    row = db.get(SiteSettings, 1)
    if not row:
        row = SiteSettings(id=1, site_name="Terralens", tagline=DEFAULT_TAGLINE)
        db.add(row)
        db.commit()
        db.refresh(row)
    return row


def _out(row: SiteSettings) -> SiteSettingsOut:
    return SiteSettingsOut(
        site_name=row.site_name,
        tagline=row.tagline,
        logo_url=media_url(row.logo_path),
        contact_email=row.contact_email,
        contact_phone=row.contact_phone,
        contact_hours=row.contact_hours,
        locations=row.locations or [],
    )


@router.get("/site-settings", response_model=SiteSettingsOut)
def read_settings(db: Session = Depends(get_db)):
    return _out(get_settings_row(db))


@router.put(
    "/admin/site-settings", response_model=SiteSettingsOut, dependencies=[Depends(require_admin)]
)
def update_settings(body: SiteSettingsIn, db: Session = Depends(get_db)):
    row = get_settings_row(db)
    row.site_name = body.site_name.strip()
    row.tagline = body.tagline
    row.contact_email = body.contact_email
    row.contact_phone = body.contact_phone
    row.contact_hours = body.contact_hours
    row.locations = body.locations
    db.commit()
    db.refresh(row)
    return _out(row)


@router.post(
    "/admin/site-settings/logo",
    response_model=SiteSettingsOut,
    dependencies=[Depends(require_admin)],
)
async def upload_logo(file: UploadFile = File(...), db: Session = Depends(get_db)):
    # PNG/JPG/WebP only. SVG is refused because it can carry scripts.
    key = await save_upload(file, "site", kind="image")
    row = get_settings_row(db)
    old, row.logo_path = row.logo_path, key
    db.commit()
    db.refresh(row)
    if old:
        get_storage().delete(old)
    return _out(row)


@router.delete(
    "/admin/site-settings/logo",
    response_model=SiteSettingsOut,
    dependencies=[Depends(require_admin)],
)
def remove_logo(db: Session = Depends(get_db)):
    """Go back to the built-in leaf logo."""
    row = get_settings_row(db)
    old, row.logo_path = row.logo_path, None
    db.commit()
    db.refresh(row)
    if old:
        get_storage().delete(old)
    return _out(row)
