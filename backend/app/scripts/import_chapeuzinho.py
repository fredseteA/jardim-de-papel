from __future__ import annotations
import json
import mimetypes
import re
from pathlib import Path
from typing import Any, Literal
from uuid import UUID, uuid5
from pydantic import BaseModel, ConfigDict, Field, model_validator
from sqlalchemy import select, text
from sqlalchemy.orm import Session
from app.core.database import get_engine
from app.core.config import get_settings
from sqlalchemy.engine import make_url
from app.models import Chapter, Collection, CollectionStory, MediaAsset, Scene, SceneMedia, Story

ROOT = Path(__file__).resolve().parents[3]
PUBLIC = ROOT / 'frontend' / 'public'
SOURCE = ROOT / 'backend' / 'content' / 'chapeuzinho-vermelho.json'
NAMESPACE = UUID('b8789daa-a048-5af4-bbee-c26b5e8d9a4b')
PROJECT_REF = 'ijxpesqxcscyrsnibbly'

def stable_id(kind: str, local_id: str) -> UUID:
    return uuid5(NAMESPACE, f'{kind}:{local_id}')

class Strict(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)

class Illustration(Strict):
    src: str
    alt: str
    demonstrative: bool | None = None
    spritePosition: Literal['top-left', 'top-right', 'bottom-left', 'bottom-right'] | None = None

class Animation(Strict):
    src: str
    poster: Illustration | None = None
    loop: bool
    muted: bool
    playbackBehavior: Literal['manual', 'on-page-enter', 'with-narration'] | None = None

class Narration(Strict):
    src: str
    duration: int | None = Field(default=None, gt=0)

class Music(Strict):
    src: str
    loop: bool

class Presentation(Strict):
    textAlignment: Literal['start','center','end'] | None = None
    textSize: Literal['default','large'] | None = None
    textPosition: Literal['top-left','top-center','top-right','bottom-left','bottom-center','bottom-right'] | None = None
    textEffect: Literal['words','fade','rise','none'] | None = None
    motion: Literal['drift','zoom','breathe','none'] | None = None

class Page(Strict):
    id: str = Field(min_length=1)
    order: int = Field(ge=0)
    text: str = Field(min_length=1)
    illustration: Illustration | None = None
    animation: Animation | None = None
    narration: Narration | None = None
    music: Music | None = None
    presentation: Presentation | None = None
    visualDescription: str | None = None
    readingSeconds: int | None = Field(default=None, gt=0)

class ChapterInput(Strict):
    id: str = Field(min_length=1)
    slug: str = Field(min_length=1)
    title: str = Field(min_length=1)
    order: int = Field(ge=0)
    pages: list[Page] = Field(min_length=1)

class Covers(Strict):
    desktop: Illustration
    mobile: Illustration | None = None

class PresentationMedia(Strict):
    trailer: Animation | None = None
    previewImages: list[Illustration] = Field(default_factory=list)

class Audio(Strict):
    backgroundMusic: Music | None = None

class StoryInput(Strict):
    id: str = Field(min_length=1)
    slug: str = Field(min_length=1)
    title: str = Field(min_length=1)
    description: str
    synopsis: str
    collectionId: str
    collectionDescription: str
    ageRange: str
    language: str
    status: Literal['draft','published']
    featured: bool | None = None
    coverImage: Covers
    presentationMedia: PresentationMedia | None = None
    audio: Audio | None = None
    chapters: list[ChapterInput] = Field(min_length=1)

class CollectionInput(Strict):
    id: str
    slug: str
    title: str
    description: str
    image: str

class Inventory(Strict):
    version: Literal[1]
    story: StoryInput
    collection: CollectionInput

    @model_validator(mode='after')
    def check_ids_and_order(self):
        if self.story.id != 'story-chapeuzinho-vermelho' or self.story.slug != 'chapeuzinho-vermelho': raise ValueError('História fora do escopo autorizado')
        if self.collection.id != self.story.collectionId or self.collection.slug != self.collection.id: raise ValueError('Coleção incompatível')
        def unique(values, label):
            if len(values) != len(set(values)): raise ValueError(f'{label} duplicado')
        unique([c.id for c in self.story.chapters], 'ID de capítulo')
        unique([c.order for c in self.story.chapters], 'Ordem de capítulo')
        unique([p.id for c in self.story.chapters for p in c.pages], 'ID de cena')
        for c in self.story.chapters: unique([p.order for p in c.pages], 'Ordem de cena')
        for asset in all_media(self): validate_asset(asset)
        def require_type(src, prefix):
            if not validate_asset(src)[1].startswith(prefix): raise ValueError(f'Tipo de mídia incompatível: {src}')
        require_type(self.collection.image, 'image/')
        require_type(self.story.coverImage.desktop.src, 'image/')
        if self.story.coverImage.mobile: require_type(self.story.coverImage.mobile.src, 'image/')
        if self.story.presentationMedia:
            for image in self.story.presentationMedia.previewImages: require_type(image.src, 'image/')
        for chapter in self.story.chapters:
            for page in chapter.pages:
                if not page.text.strip(): raise ValueError('Cena sem texto')
                if page.illustration: require_type(page.illustration.src, 'image/')
                if page.animation: require_type(page.animation.src, 'video/')
                if page.narration: require_type(page.narration.src, 'audio/')
                if page.music: require_type(page.music.src, 'audio/')
        return self

def all_media(data: Inventory) -> list[str]:
    story = data.story
    media = [data.collection.image, story.coverImage.desktop.src]
    if story.coverImage.mobile: media.append(story.coverImage.mobile.src)
    if story.presentationMedia:
        media.extend(i.src for i in story.presentationMedia.previewImages)
        if story.presentationMedia.trailer:
            media.append(story.presentationMedia.trailer.src)
            if story.presentationMedia.trailer.poster: media.append(story.presentationMedia.trailer.poster.src)
    if story.audio and story.audio.backgroundMusic: media.append(story.audio.backgroundMusic.src)
    for chapter in story.chapters:
        for page in chapter.pages:
            for obj in (page.illustration, page.animation, page.narration, page.music):
                if obj: media.append(obj.src)
            if page.animation and page.animation.poster: media.append(page.animation.poster.src)
    return media

def validate_asset(src: str) -> tuple[str, str, int]:
    if not src.startswith('/assets/') or '\\' in src or '?' in src or '#' in src: raise ValueError(f'Caminho de asset inválido: {src}')
    path = (PUBLIC / src.lstrip('/')).resolve()
    if not path.is_relative_to(PUBLIC.resolve()) or not path.is_file(): raise ValueError(f'Asset inexistente ou fora de public: {src}')
    mime = {'.webp': 'image/webp', '.gif': 'image/gif', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.mp4': 'video/mp4', '.webm': 'video/webm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav'}.get(path.suffix.lower()) or mimetypes.guess_type(src)[0]
    if not mime or not mime.startswith(('image/', 'audio/', 'video/')): raise ValueError(f'MIME desconhecido: {src}')
    return src.lstrip('/'), mime, path.stat().st_size

def load_inventory(path: Path = SOURCE) -> Inventory:
    return Inventory.model_validate_json(path.read_text(encoding='utf-8'))

def require_owned(session: Session, cls: Any, key: UUID, **ownership: Any):
    obj = session.get(cls, key)
    if obj and any(getattr(obj, name) != value for name, value in ownership.items()):
        raise ValueError(f'Conflito de propriedade em {cls.__name__}')
    return obj

def import_content(session: Session, data: Inventory) -> dict[str, int]:
    story = data.story
    story_id = stable_id('story', story.id)
    collection_id = stable_id('collection', data.collection.id)
    collision = session.scalar(select(Story).where(Story.slug == story.slug, Story.id != story_id))
    if collision: raise ValueError('Slug de história pertence a outro registro')
    collection_collision = session.scalar(select(Collection).where(Collection.slug == data.collection.slug, Collection.id != collection_id))
    if collection_collision: raise ValueError('Slug de coleção pertence a outro registro')
    def asset(src: str, extra: dict[str, Any] | None = None) -> UUID:
        path, mime, size = validate_asset(src)
        key = stable_id('media', story.id + ':' + path)
        item = require_owned(session, MediaAsset, key, storage_provider='frontend', storage_bucket='public', storage_path=path)
        if not item:
            item = MediaAsset(id=key, storage_provider='frontend', storage_bucket='public', storage_path=path, media_type='image' if mime.startswith('image/') else 'video' if mime.startswith('video/') else 'audio', mime_type=mime, file_size=size, asset_metadata={})
            session.add(item)
        if extra: item.asset_metadata = {**item.asset_metadata, **extra}
        return key
    # Validate all files before writing anything; cached by UUID in the session.
    for src in dict.fromkeys(all_media(data)): asset(src)
    session.flush()
    cover_id = stable_id('media', story.id + ':' + story.coverImage.desktop.src.lstrip('/'))
    cover = session.get(MediaAsset, cover_id)
    if cover is None: raise ValueError('Capa indisponível')
    # The existing schema lacks story metadata and chapter slugs. Keep them namespaced
    # and expose them through the cover asset and each scene presentation config.
    story_extra = story.model_dump(exclude={'chapters'}, exclude_none=True)
    cover.asset_metadata = {**cover.asset_metadata, 'jdp_import_v1': story_extra}
    existing_collection = session.get(Collection, collection_id)
    if not existing_collection:
        session.add(Collection(id=collection_id, slug=data.collection.slug, title=data.collection.title, description=data.collection.description, cover_asset_id=asset(data.collection.image), display_order=0, status='published'))
    existing_story = session.get(Story, story_id)
    age = re.fullmatch(r'(\d+)[–-](\d+) anos', story.ageRange)
    if not age and story.ageRange: raise ValueError('Faixa etária não reconhecida')
    if age and int(age.group(1)) > int(age.group(2)): raise ValueError('Faixa etária inválida')
    words = sum(len(p.text.split()) for c in story.chapters for p in c.pages)
    pages = sum(len(c.pages) for c in story.chapters)
    import math
    values = dict(slug=story.slug, title=story.title, synopsis=story.synopsis, description=story.description, cover_asset_id=cover_id, hero_asset_id=cover_id, minimum_age=int(age.group(1)) if age else None, maximum_age=int(age.group(2)) if age else None, estimated_reading_minutes=max(1, math.ceil(words / 100 + pages * 2 / 60)), language=story.language, status='draft')
    if existing_story:
        for k, v in values.items(): setattr(existing_story, k, v)
    else:
        existing_story = Story(id=story_id, **values); session.add(existing_story)
    session.flush()
    if not session.get(CollectionStory, (collection_id, story_id)):
        session.add(CollectionStory(collection_id=collection_id, story_id=story_id, display_order=0))
    for chapter in story.chapters:
        chapter_id = stable_id('chapter', chapter.id)
        obj = require_owned(session, Chapter, chapter_id, story_id=story_id)
        if not obj: obj = Chapter(id=chapter_id, story_id=story_id, title=chapter.title, display_order=chapter.order); session.add(obj)
        else: obj.title = chapter.title; obj.display_order = chapter.order
        session.flush()
        for page in chapter.pages:
            page_id = stable_id('scene', page.id)
            scene = require_owned(session, Scene, page_id, chapter_id=chapter_id)
            config = page.presentation.model_dump(exclude_none=True) if page.presentation else {}
            config['jdp_import_v1'] = {'legacyPageId': page.id, 'legacyChapterId': chapter.id, 'legacyChapterSlug': chapter.slug, 'visualDescription': page.visualDescription}
            params = dict(display_order=page.order, narrative_text=page.text, estimated_duration_seconds=page.readingSeconds, text_position=page.presentation.textPosition if page.presentation else None, text_animation=page.presentation.textEffect if page.presentation else None, presentation_config=config)
            if not scene: scene = Scene(id=page_id, chapter_id=chapter_id, **params); session.add(scene)
            else:
                for k, v in params.items(): setattr(scene, k, v)
            session.flush()
            for role, obj in (('illustration',page.illustration),('animation',page.animation),('narration',page.narration),('ambient_music',page.music)):
                if not obj: continue
                media_id = asset(obj.src)
                link_id = stable_id('scene_media', page.id + ':' + role)
                link = require_owned(session, SceneMedia, link_id, scene_id=page_id)
                cfg = obj.model_dump(exclude={'src'}, exclude_none=True)
                if not link: session.add(SceneMedia(id=link_id, scene_id=page_id, media_asset_id=media_id, role=role, display_order=0, configuration=cfg))
                else: link.media_asset_id = media_id; link.role = role; link.configuration = cfg
    session.flush()
    existing_story.status = story.status
    session.flush()
    return {'collections': 1, 'stories': 1, 'chapters': len(story.chapters), 'scenes': pages, 'media_assets': len(set(all_media(data))), 'scene_media': sum(bool(o) for c in story.chapters for p in c.pages for o in (p.illustration,p.animation,p.narration,p.music)), 'collection_stories': 1}

def main():
    data = load_inventory()
    url = make_url(get_settings().sqlalchemy_url())
    if not ((url.username or '').endswith('.' + PROJECT_REF) and (url.host or '').endswith('.pooler.supabase.com') and url.query.get('sslmode') in ('require','verify-ca','verify-full')): raise RuntimeError('Projeto de desenvolvimento não confirmado')
    with Session(get_engine()) as session, session.begin():
        if session.scalar(text('select current_schema()')) != 'public' or list(session.scalars(text('select version_num from public.alembic_version'))) != ['0001_initial']: raise RuntimeError('Schema incompatível')
        session.execute(text("select pg_advisory_xact_lock(hashtext('jdp-import-chapeuzinho-v1'))"))
        counts = import_content(session, data)
    print('Importação concluída:', json.dumps(counts, ensure_ascii=False))

if __name__ == '__main__':
    try: main()
    except Exception as error:
        # Driver errors may contain credentials; print validation errors only.
        if isinstance(error, ValueError): print('Importação cancelada:', str(error))
        else: print('Importação cancelada; tipo do erro:', type(error).__name__)
        raise SystemExit(1)
