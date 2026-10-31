from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response, status
from sqlalchemy.orm import Session

from app.api.v1.admin_schemas import (
    AdminChapterCreate, AdminChapterOut, AdminChapterUpdate,
    AdminSceneCreate, AdminSceneMediaOut, AdminSceneOut, AdminSceneUpdate,
    OrderUpdate, SceneMediaCreate,
)
from app.core.admin_auth import require_admin
from app.core.database import get_session
from app.modules.stories import chapter_scene_service as service
from app.modules.stories.composition import CompositionUpdate

router = APIRouter(prefix='/api/v1/admin', tags=['admin-content'], dependencies=[Depends(require_admin)])
DB = Annotated[Session, Depends(get_session)]

@router.get('/stories/{story_id}/chapters', response_model=list[AdminChapterOut])
def chapters(story_id: UUID, session: DB): return service.list_chapters(session, story_id)

@router.post('/stories/{story_id}/chapters', response_model=AdminChapterOut, status_code=status.HTTP_201_CREATED)
def create_chapter(story_id: UUID, payload: AdminChapterCreate, session: DB): return service.create_chapter(session, story_id, payload)

@router.patch('/stories/{story_id}/chapters/reorder', response_model=list[AdminChapterOut])
def reorder_chapters(story_id: UUID, payload: OrderUpdate, session: DB): return service.reorder_chapters(session, story_id, payload.ids)

@router.patch('/stories/{story_id}/chapters/{chapter_id}', response_model=AdminChapterOut)
def update_chapter(story_id: UUID, chapter_id: UUID, payload: AdminChapterUpdate, session: DB): return service.update_chapter(session, story_id, chapter_id, payload)

@router.delete('/stories/{story_id}/chapters/{chapter_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_chapter(story_id: UUID, chapter_id: UUID, confirm: bool = Query(False), session: DB = None):
    if not confirm: return Response(status_code=status.HTTP_400_BAD_REQUEST, content='Confirmação necessária.')
    service.delete_chapter(session, story_id, chapter_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.get('/stories/{story_id}/chapters/{chapter_id}/scenes', response_model=list[AdminSceneOut])
def scenes(story_id: UUID, chapter_id: UUID, session: DB): return service.list_scenes(session, story_id, chapter_id)

@router.post('/stories/{story_id}/chapters/{chapter_id}/scenes', response_model=AdminSceneOut, status_code=status.HTTP_201_CREATED)
def create_scene(story_id: UUID, chapter_id: UUID, payload: AdminSceneCreate, session: DB): return service.create_scene(session, story_id, chapter_id, payload)

@router.patch('/stories/{story_id}/chapters/{chapter_id}/scenes/reorder', response_model=list[AdminSceneOut])
def reorder_scenes(story_id: UUID, chapter_id: UUID, payload: OrderUpdate, session: DB): return service.reorder_scenes(session, story_id, chapter_id, payload.ids)

@router.patch('/stories/{story_id}/chapters/{chapter_id}/scenes/{scene_id}', response_model=AdminSceneOut)
def update_scene(story_id: UUID, chapter_id: UUID, scene_id: UUID, payload: AdminSceneUpdate, session: DB): return service.update_scene(session, story_id, chapter_id, scene_id, payload)

@router.delete('/stories/{story_id}/chapters/{chapter_id}/scenes/{scene_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_scene(story_id: UUID, chapter_id: UUID, scene_id: UUID, confirm: bool = Query(False), session: DB = None):
    if not confirm: return Response(status_code=status.HTTP_400_BAD_REQUEST, content='Confirmação necessária.')
    service.delete_scene(session, story_id, chapter_id, scene_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)

@router.patch('/stories/{story_id}/chapters/{chapter_id}/scenes/{scene_id}/composition', response_model=AdminSceneOut)
def composition(story_id: UUID, chapter_id: UUID, scene_id: UUID, payload: CompositionUpdate, session: DB):
    return service.save_composition(session, story_id, chapter_id, scene_id, payload)

@router.post('/stories/{story_id}/chapters/{chapter_id}/scenes/{scene_id}/media', response_model=AdminSceneMediaOut, status_code=status.HTTP_201_CREATED)
def add_media(story_id: UUID, chapter_id: UUID, scene_id: UUID, payload: SceneMediaCreate, session: DB): return service.add_scene_media(session, story_id, chapter_id, scene_id, payload)

@router.delete('/stories/{story_id}/chapters/{chapter_id}/scenes/{scene_id}/media/{link_id}', status_code=status.HTTP_204_NO_CONTENT)
def remove_media(story_id: UUID, chapter_id: UUID, scene_id: UUID, link_id: UUID, session: DB):
    service.remove_scene_media(session, story_id, chapter_id, scene_id, link_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
