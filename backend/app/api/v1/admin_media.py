from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, Form, Query, Response, UploadFile, status
from sqlalchemy.orm import Session

from app.api.v1.admin_schemas import AdminMediaDetail, AdminMediaPage, AdminMediaUpdate, MediaUsage, AdminMediaSummary
from app.api.v1.schemas import MediaOut
from app.core.admin_auth import require_admin
from app.core.database import get_session
from app.modules.stories import media_service
from app.models import Story, Chapter, Collection
from sqlalchemy import select

router = APIRouter(prefix='/api/v1/admin/media', tags=['admin-media'], dependencies=[Depends(require_admin)])
DB = Annotated[Session, Depends(get_session)]

@router.get('', response_model=AdminMediaPage)
def list_media(session: DB, limit: Annotated[int, Query(ge=1, le=100)] = 50, offset: Annotated[int, Query(ge=0)] = 0, q: Annotated[str, Query(max_length=120)] = '', media_type: Annotated[str | None, Query(pattern='^(image|video|audio|animation)$')] = None, story_id: UUID | None = None, chapter_id: UUID | None = None, scene_id: UUID | None = None, unlinked: bool = False, collection_id: UUID | None = None):
    items = []
    for asset in media_service.list_assets(session, limit, offset, q, media_type, story_id, chapter_id, scene_id, unlinked, collection_id):
        _, references = media_service.usage(session, asset.id)
        items.append(AdminMediaSummary(**media_service.media_out(asset).model_dump(), story_count=len({r['story_id'] for r in references if r.get('story_id')})))
    return {'items': items, 'limit': limit, 'offset': offset}

@router.post('/upload', response_model=MediaOut, status_code=status.HTTP_201_CREATED)
def upload_media(session: DB, file: UploadFile = File(...), title: str | None = Form(None), description: str | None = Form(None), story_id: UUID | None = Form(None)):
    return media_service.media_out(media_service.upload(session, file, title, description, story_id))

@router.get('/context')
def media_context(session: DB):
    return {
        'stories': [{'id': s.id, 'title': s.title} for s in session.scalars(select(Story).order_by(Story.title)).all()],
        'chapters': [{'id': c.id, 'story_id': c.story_id, 'title': c.title} for c in session.scalars(select(Chapter).order_by(Chapter.display_order)).all()],
        'collections': [{'id': c.id, 'title': c.title} for c in session.scalars(select(Collection).order_by(Collection.display_order)).all()],
    }

@router.get('/{asset_id}', response_model=AdminMediaDetail)
def media_detail(asset_id: UUID, session: DB):
    asset, usage = media_service.usage(session, asset_id)
    return AdminMediaDetail(**media_service.media_out(asset).model_dump(), usage=[MediaUsage(**item) for item in usage])

@router.patch('/{asset_id}', response_model=MediaOut)
def update_media(asset_id: UUID, payload: AdminMediaUpdate, session: DB):
    return media_service.media_out(media_service.update_metadata(session, asset_id, payload.title, payload.description))

@router.delete('/{asset_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_media(asset_id: UUID, confirm: bool = Query(False), session: DB = None):
    if not confirm: return Response(status_code=400, content='Confirmação necessária.')
    media_service.delete_asset(session, asset_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
