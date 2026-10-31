from typing import Annotated
from uuid import UUID
import json

from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response, status
from pydantic import ValidationError
from sqlalchemy.orm import Session

from app.api.v1.admin_schemas import AdminStoryCreate, AdminStoryDelete, AdminStoryOut, AdminStoryPage, AdminStoryUpdate
from app.core.admin_auth import require_admin
from app.core.database import get_session
from app.modules.stories import admin_service
from app.modules.stories.import_schema import MAX_IMPORT_BYTES, ImportPreview, StoryImport
from app.modules.stories import import_service

router = APIRouter(prefix='/api/v1/admin/stories', tags=['admin-stories'], dependencies=[Depends(require_admin)])
DB = Annotated[Session, Depends(get_session)]


async def import_document(request: Request) -> StoryImport:
    if request.headers.get('content-type', '').split(';')[0].strip().lower() != 'application/json':
        raise HTTPException(415, detail='Envie um documento application/json.')
    content = bytearray()
    async for chunk in request.stream():
        if len(content) + len(chunk) > MAX_IMPORT_BYTES:
            raise HTTPException(413, detail='O arquivo JSON deve ter no máximo 2 MiB.')
        content.extend(chunk)
    def unique_keys(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise ValueError('O JSON contém campos repetidos.')
            result[key] = value
        return result
    try:
        value = json.loads(content.decode('utf-8-sig'), object_pairs_hook=unique_keys)
    except (ValueError, UnicodeError, RecursionError):
        raise HTTPException(422, detail='JSON inválido: confira a sintaxe, a codificação UTF-8 e campos repetidos.') from None
    try:
        return StoryImport.model_validate(value)
    except ValidationError as error:
        messages = ['.'.join(str(part) for part in item['loc']) + ': ' + item['msg'] for item in error.errors(include_input=False)[:10]]
        raise HTTPException(422, detail='Revise o JSON — ' + '; '.join(messages)) from None


Document = Annotated[StoryImport, Depends(import_document)]


@router.post('/import/validate', response_model=ImportPreview)
def preview_story_import(document: Document, session: DB):
    return import_service.validate_import(session, document)


@router.post('/import', response_model=AdminStoryOut, status_code=status.HTTP_201_CREATED)
def confirm_story_import(document: Document, session: DB):
    return import_service.import_story(session, document)


@router.get('', response_model=AdminStoryPage)
def list_admin_stories(
    session: DB,
    limit: Annotated[int, Query(ge=1, le=100)] = 20,
    offset: Annotated[int, Query(ge=0)] = 0,
    q: Annotated[str, Query(max_length=120)] = '',
    story_status: Annotated[str | None, Query(alias='status', pattern='^(draft|published|archived)$')] = None,
):
    return {'items': admin_service.list_stories(session, limit=limit, offset=offset, query=q, story_status=story_status), 'limit': limit, 'offset': offset}


@router.get('/{story_id}', response_model=AdminStoryOut)
def get_admin_story(story_id: UUID, session: DB):
    return admin_service.get_story(session, story_id)


@router.post('', response_model=AdminStoryOut, status_code=status.HTTP_201_CREATED)
def create_admin_story(payload: AdminStoryCreate, session: DB):
    return admin_service.create_story(session, payload)


@router.patch('/{story_id}', response_model=AdminStoryOut)
def update_admin_story(story_id: UUID, payload: AdminStoryUpdate, session: DB):
    return admin_service.update_story(session, story_id, payload)


@router.delete('/{story_id}', status_code=status.HTTP_204_NO_CONTENT)
def delete_admin_story(story_id: UUID, payload: AdminStoryDelete, session: DB):
    admin_service.delete_story(session, story_id, payload.confirmation_slug)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
