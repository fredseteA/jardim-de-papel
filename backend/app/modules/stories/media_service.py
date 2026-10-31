import re
from pathlib import Path
from urllib.parse import quote
from uuid import UUID, uuid4

import httpx
from fastapi import HTTPException, UploadFile, status
from sqlalchemy import String, exists, or_, select
from sqlalchemy.orm import Session

from app.models import Chapter, Collection, CollectionStory, MediaAsset, Scene, SceneMedia, Story
from app.core.config import get_settings

ALLOWED = {
    'image/jpeg': ('jpg', 'image', 12 * 1024 * 1024), 'image/png': ('png', 'image', 12 * 1024 * 1024),
    'image/webp': ('webp', 'image', 12 * 1024 * 1024),
    'audio/mpeg': ('mp3', 'audio', 40 * 1024 * 1024), 'audio/wav': ('wav', 'audio', 40 * 1024 * 1024),
    'audio/ogg': ('ogg', 'audio', 40 * 1024 * 1024),
}

def _storage_config():
    settings = get_settings(); base = (settings.supabase_url or '').rstrip('/')
    key = settings.supabase_service_role_key.get_secret_value() if settings.supabase_service_role_key else ''
    if not base or not key: raise HTTPException(status_code=503, detail='O armazenamento editorial não está configurado.')
    return base, key, settings.supabase_storage_bucket

def resolved_url(asset: MediaAsset, expires_in: int | None = None) -> str | None:
    if asset.storage_provider == 'frontend': return f'/{asset.storage_path.lstrip("/")}'
    if asset.storage_provider != 'supabase': return None
    base, key, _ = _storage_config()
    bucket = quote(asset.storage_bucket, safe='')
    path = quote(asset.storage_path.lstrip('/'), safe='/')
    response = httpx.post(f'{base}/storage/v1/object/sign/{bucket}/{path}', json={'expiresIn': expires_in or get_settings().media_signed_url_seconds}, headers={'Authorization': f'Bearer {key}', 'apikey': key}, timeout=10)
    if response.status_code >= 300: return None
    payload = response.json()
    value = payload.get('signedURL') or payload.get('signedUrl')
    if not isinstance(value, str): return None
    if value.startswith('/storage/v1/'): return f'{base}{value}'
    return f'{base}/storage/v1{value}' if value.startswith('/') else value

def media_out(asset: MediaAsset, public: bool = False):
    from app.api.v1.schemas import MediaOut
    try:
        url = f'/api/v1/media/{asset.id}/content' if public and asset.storage_provider == 'supabase' else resolved_url(asset)
    except (HTTPException, httpx.HTTPError, ValueError):
        # Do not fail the administrative list solely because Storage is
        # temporarily unavailable. The UI can render an unavailable preview.
        url = None
    return MediaOut.model_validate(asset).model_copy(update={'resolved_url': url})

def _validate_file(upload: UploadFile, content: bytes) -> tuple[str, str, str]:
    mime = (upload.content_type or '').lower(); suffix = Path(upload.filename or '').suffix.lower().lstrip('.')
    if mime not in ALLOWED or suffix not in ({'jpg', 'jpeg'} if mime == 'image/jpeg' else {ALLOWED[mime][0]}): raise HTTPException(status_code=422, detail='Use imagens JPEG, PNG ou WebP, ou áudio MP3, WAV ou OGG. Vídeos e GIFs não são aceitos.')
    if len(content) > ALLOWED[mime][2]: raise HTTPException(status_code=413, detail='O arquivo excede o limite permitido para este formato.')
    signatures = {'image/jpeg': b'\xff\xd8\xff', 'image/png': b'\x89PNG\r\n\x1a\n', 'image/gif': b'GIF8', 'image/webp': b'RIFF', 'video/webm': b'\x1aE\xdf\xa3', 'audio/wav': b'RIFF', 'audio/ogg': b'OggS'}
    signature = signatures.get(mime)
    if signature and not content.startswith(signature): raise HTTPException(status_code=422, detail='O conteúdo do arquivo não corresponde ao formato informado.')
    if mime == 'image/webp' and content[8:12] != b'WEBP': raise HTTPException(status_code=422, detail='Arquivo WebP inválido.')
    if mime == 'video/mp4' and b'ftyp' not in content[:32]: raise HTTPException(status_code=422, detail='O conteúdo do arquivo não corresponde ao formato MP4.')
    if mime == 'audio/mpeg' and not (content.startswith(b'ID3') or content.startswith(b'\xff\xfb') or content.startswith(b'\xff\xf3')): raise HTTPException(status_code=422, detail='O conteúdo do arquivo não corresponde ao formato MP3.')
    return mime, ALLOWED[mime][1], suffix

def _safe_name(value: str) -> str:
    return re.sub(r'[^a-z0-9-]+', '-', value.lower()).strip('-')[:80] or 'arquivo'

def upload(session: Session, upload_file: UploadFile, title: str | None, description: str | None, story_id: UUID | None) -> MediaAsset:
    if story_id and session.get(Story, story_id) is None: raise HTTPException(status_code=422, detail='A história informada não existe.')
    content = upload_file.file.read(max(value[2] for value in ALLOWED.values()) + 1); mime, media_type, suffix = _validate_file(upload_file, content)
    base, key, bucket = _storage_config(); prefix = f'stories/{story_id}' if story_id else 'library'; path = f'{prefix}/{media_type}/{uuid4()}-{_safe_name(Path(upload_file.filename or '').stem)}.{suffix}'
    response = httpx.post(f'{base}/storage/v1/object/{bucket}/{path}', content=content, headers={'Authorization': f'Bearer {key}', 'apikey': key, 'Content-Type': mime, 'x-upsert': 'false'}, timeout=45)
    if response.status_code >= 300: raise HTTPException(status_code=502, detail='Não foi possível concluir o envio ao armazenamento.')
    asset = MediaAsset(storage_provider='supabase', storage_bucket=bucket, storage_path=path, media_type=media_type, mime_type=mime, file_size=len(content), width=None, height=None, duration_seconds=None, asset_metadata={'title': title or Path(upload_file.filename or '').stem, 'description': description or '', 'original_filename': upload_file.filename or '', 'status': 'available', **({'story_id': str(story_id)} if story_id else {})})
    session.add(asset)
    try: session.commit()
    except Exception:
        session.rollback()
        httpx.delete(f'{base}/storage/v1/object/{bucket}/{path}', headers={'Authorization': f'Bearer {key}', 'apikey': key}, timeout=15)
        raise
    session.refresh(asset); return asset

def list_assets(
    session: Session,
    limit: int,
    offset: int,
    q: str = '',
    media_type: str | None = None,
    story_id: UUID | None = None,
    chapter_id: UUID | None = None,
    scene_id: UUID | None = None,
    unlinked: bool = False,
    collection_id: UUID | None = None,
):
    statement = select(MediaAsset).order_by(MediaAsset.created_at.desc(), MediaAsset.id).limit(limit).offset(offset)
    if q.strip():
        needle = f'%{q.strip()}%'; statement = statement.where(or_(MediaAsset.storage_path.ilike(needle), MediaAsset.asset_metadata['title'].astext.cast(String).ilike(needle), MediaAsset.asset_metadata['description'].astext.cast(String).ilike(needle)))
    if media_type: statement = statement.where(MediaAsset.media_type == media_type)
    if collection_id:
        collection_stories = select(CollectionStory.story_id).where(CollectionStory.collection_id == collection_id)
        collection_media = select(SceneMedia.media_asset_id).join(Scene, Scene.id == SceneMedia.scene_id).join(Chapter, Chapter.id == Scene.chapter_id).where(Chapter.story_id.in_(collection_stories))
        statement = statement.where(or_(MediaAsset.id.in_(collection_media), MediaAsset.id.in_(select(Story.cover_asset_id).where(Story.id.in_(collection_stories))), MediaAsset.id.in_(select(Story.hero_asset_id).where(Story.id.in_(collection_stories)))))
    scene_usage = select(SceneMedia.media_asset_id)
    if scene_id:
        statement = statement.where(MediaAsset.id.in_(scene_usage.where(SceneMedia.scene_id == scene_id)))
    elif chapter_id:
        statement = statement.where(MediaAsset.id.in_(scene_usage.join(Scene, Scene.id == SceneMedia.scene_id).where(Scene.chapter_id == chapter_id)))
    elif story_id:
        story_scene_media = scene_usage.join(Scene, Scene.id == SceneMedia.scene_id).join(Chapter, Chapter.id == Scene.chapter_id).where(Chapter.story_id == story_id)
        contextual_path = f'stories/{story_id}/%'
        statement = statement.where(or_(MediaAsset.id.in_(story_scene_media), MediaAsset.id.in_(select(Story.cover_asset_id).where(Story.id == story_id)), MediaAsset.id.in_(select(Story.hero_asset_id).where(Story.id == story_id)), MediaAsset.asset_metadata['story_id'].astext == str(story_id), MediaAsset.storage_path.like(contextual_path)))
    if unlinked:
        statement = statement.where(~exists(select(SceneMedia.id).where(SceneMedia.media_asset_id == MediaAsset.id))).where(~exists(select(Story.id).where(or_(Story.cover_asset_id == MediaAsset.id, Story.hero_asset_id == MediaAsset.id))))
        statement = statement.where(~exists(select(Collection.id).where(or_(Collection.cover_asset_id == MediaAsset.id, Collection.decorative_asset_id == MediaAsset.id))))
    return session.scalars(statement).all()

def usage(session: Session, asset_id: UUID):
    asset = session.get(MediaAsset, asset_id)
    if asset is None: raise HTTPException(status_code=404, detail='Mídia não encontrada.')
    result = []
    for link, scene, chapter, story in session.execute(select(SceneMedia, Scene, Chapter, Story).join(Scene, Scene.id == SceneMedia.scene_id).join(Chapter, Chapter.id == Scene.chapter_id).join(Story, Story.id == Chapter.story_id).where(SceneMedia.media_asset_id == asset_id)).all(): result.append({'kind': 'scene', 'story_id': story.id, 'story_title': story.title, 'chapter_id': chapter.id, 'scene_id': scene.id, 'role': link.role})
    for story in session.scalars(select(Story).where(Story.cover_asset_id == asset_id)).all(): result.append({'kind': 'story_cover', 'story_id': story.id, 'story_title': story.title})
    for story in session.scalars(select(Story).where(Story.hero_asset_id == asset_id)).all(): result.append({'kind': 'story_hero', 'story_id': story.id, 'story_title': story.title})
    for collection in session.scalars(select(Collection).where(or_(Collection.cover_asset_id == asset_id, Collection.decorative_asset_id == asset_id))).all():
        result.append({'kind': 'collection', 'story_title': collection.title})
    return asset, result

def update_metadata(session: Session, asset_id: UUID, title: str | None, description: str | None):
    asset = session.get(MediaAsset, asset_id)
    if asset is None: raise HTTPException(status_code=404, detail='Mídia não encontrada.')
    metadata = dict(asset.asset_metadata); metadata.update({key: value for key, value in {'title': title, 'description': description}.items() if value is not None}); asset.asset_metadata = metadata; session.commit(); session.refresh(asset); return asset

def delete_asset(session: Session, asset_id: UUID) -> None:
    # A row lock also serializes FK additions while usage and deletion run.
    session.scalar(select(MediaAsset).where(MediaAsset.id == asset_id).with_for_update())
    asset, references = usage(session, asset_id)
    if references: raise HTTPException(status_code=409, detail='Esta mídia está em uso e não pode ser excluída.')
    if asset.storage_provider == 'supabase':
        base, key, _ = _storage_config(); response = httpx.delete(f'{base}/storage/v1/object/{quote(asset.storage_bucket, safe="")}/{quote(asset.storage_path, safe="/")}', headers={'Authorization': f'Bearer {key}', 'apikey': key}, timeout=20)
        if response.status_code >= 300: raise HTTPException(status_code=502, detail='Não foi possível remover o arquivo do armazenamento.')
    session.delete(asset); session.commit()
