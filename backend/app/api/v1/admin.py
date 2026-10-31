from fastapi import APIRouter, Depends
from pydantic import BaseModel
from app.core.admin_auth import require_admin

router = APIRouter(prefix='/api/v1/admin', tags=['admin'])


class AdminIdentity(BaseModel):
    id: str
    email: str | None = None
    role: str


@router.get('/me', response_model=AdminIdentity)
def admin_me(admin: dict = Depends(require_admin)):
    return admin
