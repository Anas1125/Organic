"""Private certificate documents. Only the owning seller or an admin can download them."""

import mimetypes

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session

from app.core.deps import get_current_user
from app.db import get_db
from app.models import GIRecord, OrganicCertification, User
from app.models.enums import Role
from app.services.storage import get_storage

router = APIRouter(prefix="/documents", tags=["Documents"])


def _serve(record, user: User) -> Response:
    if not record or not record.document_path:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Document not found")
    is_owner = user.seller_profile and user.seller_profile.id == record.seller_id
    if user.role != Role.ADMIN and not is_owner:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "You cannot view this document")
    data = get_storage().read(record.document_path)
    media_type = mimetypes.guess_type(record.document_path)[0] or "application/octet-stream"
    return Response(
        data,
        media_type=media_type,
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/certifications/{cert_id}")
def cert_document(
    cert_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _serve(db.get(OrganicCertification, cert_id), user)


@router.get("/gi-records/{record_id}")
def gi_document(
    record_id: int, user: User = Depends(get_current_user), db: Session = Depends(get_db)
):
    return _serve(db.get(GIRecord, record_id), user)
