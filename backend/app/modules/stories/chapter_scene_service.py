from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.admin_schemas import (
    AdminChapterCreate, AdminChapterOut, AdminChapterUpdate, AdminSceneCreate,
    AdminSceneMediaOut, AdminSceneOut, AdminSceneUpdate, SceneMediaCreate,
)
from app.models import Chapter, MediaAsset, ReadingProgress, Scene, SceneMedia, Story
from app.modules.stories import media_service


def missing(detail: str = 'Registro não encontrado.') -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=detail)


def conflict(detail: str) -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail=detail)


def story_or_404(session: Session, story_id: UUID) -> Story:
    item = session.get(Story, story_id)
    if item is None:
        raise missing('História não encontrada.')
    return item


def chapter_or_404(session: Session, story_id: UUID, chapter_id: UUID) -> Chapter:
    item = session.get(Chapter, chapter_id)
    if item is None or item.story_id != story_id:
        raise missing('Capítulo não encontrado nesta história.')
    return item


def scene_or_404(session: Session, chapter_id: UUID, scene_id: UUID) -> Scene:
    item = session.get(Scene, scene_id)
    if item is None or item.chapter_id != chapter_id:
        raise missing('Cena não encontrada neste capítulo.')
    return item


def chapter_out(session: Session, chapter: Chapter) -> AdminChapterOut:
    count = session.scalar(select(func.count(Scene.id)).where(Scene.chapter_id == chapter.id)) or 0
    return AdminChapterOut(id=chapter.id, story_id=chapter.story_id, title=chapter.title, description=chapter.description, display_order=chapter.display_order, scene_count=count)


def scene_out(session: Session, scene: Scene) -> AdminSceneOut:
    rows = session.execute(
        select(SceneMedia, MediaAsset)
        .join(MediaAsset, SceneMedia.media_asset_id == MediaAsset.id)
        .where(SceneMedia.scene_id == scene.id)
        .order_by(SceneMedia.display_order, SceneMedia.id)
    ).all()
    media = [AdminSceneMediaOut(id=link.id, scene_id=link.scene_id, media_asset_id=link.media_asset_id, role=link.role, display_order=link.display_order, configuration=link.configuration, asset=media_service.media_out(asset)) for link, asset in rows]
    return AdminSceneOut(id=scene.id, chapter_id=scene.chapter_id, display_order=scene.display_order, title=scene.title, narrative_text=scene.narrative_text, estimated_duration_seconds=scene.estimated_duration_seconds, text_position=scene.text_position, text_animation=scene.text_animation, transition_type=scene.transition_type, presentation_config=scene.presentation_config, media=media)


def list_chapters(session: Session, story_id: UUID) -> list[AdminChapterOut]:
    story_or_404(session, story_id)
    chapters = session.scalars(select(Chapter).where(Chapter.story_id == story_id).order_by(Chapter.display_order, Chapter.id)).all()
    return [chapter_out(session, chapter) for chapter in chapters]


def create_chapter(session: Session, story_id: UUID, payload: AdminChapterCreate) -> AdminChapterOut:
    story_or_404(session, story_id)
    last = session.scalar(select(func.max(Chapter.display_order)).where(Chapter.story_id == story_id))
    chapter = Chapter(story_id=story_id, title=payload.title, description=payload.description, display_order=payload.display_order if payload.display_order is not None else (last + 1 if last is not None else 0))
    session.add(chapter)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise conflict('A posição deste capítulo já está em uso.') from None
    session.refresh(chapter)
    return chapter_out(session, chapter)


def update_chapter(session: Session, story_id: UUID, chapter_id: UUID, payload: AdminChapterUpdate) -> AdminChapterOut:
    chapter = chapter_or_404(session, story_id, chapter_id)
    for key, value in payload.model_dump(exclude_unset=True).items():
        setattr(chapter, key, value)
    session.commit(); session.refresh(chapter)
    return chapter_out(session, chapter)


def reorder_chapters(session: Session, story_id: UUID, ids: list[UUID]) -> list[AdminChapterOut]:
    chapters = session.scalars(select(Chapter).where(Chapter.story_id == story_id).order_by(Chapter.display_order, Chapter.id)).all()
    if len(chapters) != len(ids) or {chapter.id for chapter in chapters} != set(ids):
        raise HTTPException(status_code=422, detail='A nova ordem deve conter todos e somente os capítulos desta história.')
    pivot = (max((chapter.display_order for chapter in chapters), default=0) + len(chapters) + 1)
    by_id = {chapter.id: chapter for chapter in chapters}
    for position, chapter_id in enumerate(ids): by_id[chapter_id].display_order = pivot + position
    session.flush()
    for position, chapter_id in enumerate(ids): by_id[chapter_id].display_order = position
    session.commit()
    return [chapter_out(session, by_id[chapter_id]) for chapter_id in ids]


def delete_chapter(session: Session, story_id: UUID, chapter_id: UUID) -> None:
    chapter = chapter_or_404(session, story_id, chapter_id)
    has_progress = session.scalar(select(ReadingProgress.id).where(ReadingProgress.chapter_id == chapter.id).limit(1))
    if has_progress:
        raise conflict('Este capítulo possui progresso de leitura e não pode ser excluído. Arquive a história ou reposicione o conteúdo.')
    session.delete(chapter); session.commit()


def list_scenes(session: Session, story_id: UUID, chapter_id: UUID) -> list[AdminSceneOut]:
    chapter_or_404(session, story_id, chapter_id)
    scenes = session.scalars(select(Scene).where(Scene.chapter_id == chapter_id).order_by(Scene.display_order, Scene.id)).all()
    return [scene_out(session, scene) for scene in scenes]


def create_scene(session: Session, story_id: UUID, chapter_id: UUID, payload: AdminSceneCreate) -> AdminSceneOut:
    chapter_or_404(session, story_id, chapter_id)
    last = session.scalar(select(func.max(Scene.display_order)).where(Scene.chapter_id == chapter_id))
    scene = Scene(chapter_id=chapter_id, display_order=payload.display_order if payload.display_order is not None else (last + 1 if last is not None else 0), **payload.model_dump(exclude={'display_order'}))
    session.add(scene)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise conflict('A posição desta cena já está em uso.') from None
    session.refresh(scene)
    return scene_out(session, scene)


def update_scene(session: Session, story_id: UUID, chapter_id: UUID, scene_id: UUID, payload: AdminSceneUpdate) -> AdminSceneOut:
    scene = scene_or_404(session, chapter_id, scene_id); chapter_or_404(session, story_id, chapter_id)
    if payload.presentation_config is not None:
        session.scalar(select(Scene.id).where(Scene.id == scene_id).with_for_update())
        session.refresh(scene)
    for key, value in payload.model_dump(exclude_unset=True).items():
        if key == 'presentation_config':
            if value is None: continue
            # Composition has a separate optimistic-locking endpoint. A stale
            # narrative form must never overwrite it or imported metadata.
            value = {**scene.presentation_config, **{k: v for k, v in value.items() if k != 'composition'}}
        setattr(scene, key, value)
    session.commit(); session.refresh(scene)
    return scene_out(session, scene)


def save_composition(session: Session, story_id: UUID, chapter_id: UUID, scene_id: UUID, payload) -> AdminSceneOut:
    from app.modules.stories.composition import Composition
    chapter_or_404(session, story_id, chapter_id)
    scene = session.scalar(select(Scene).where(Scene.id == scene_id, Scene.chapter_id == chapter_id).with_for_update().execution_options(populate_existing=True))
    if scene is None: raise missing('Cena não encontrada neste capítulo.')
    config = dict(scene.presentation_config or {})
    current = Composition.model_validate(config.get('composition') or {})
    if current.revision != payload.expected_revision:
        raise conflict('A composição foi alterada em outra sessão. Reabra a cena antes de salvar novamente.')
    layouts = current.layouts.model_dump(exclude_none=True)
    layouts.update(payload.layouts.model_dump(exclude_none=True))
    config['composition'] = Composition(version=1, revision=current.revision + 1, layouts=layouts).model_dump(exclude_none=True)
    scene.presentation_config = config
    session.commit(); session.refresh(scene)
    return scene_out(session, scene)


def reorder_scenes(session: Session, story_id: UUID, chapter_id: UUID, ids: list[UUID]) -> list[AdminSceneOut]:
    chapter_or_404(session, story_id, chapter_id)
    scenes = session.scalars(select(Scene).where(Scene.chapter_id == chapter_id).order_by(Scene.display_order, Scene.id)).all()
    if len(scenes) != len(ids) or {scene.id for scene in scenes} != set(ids):
        raise HTTPException(status_code=422, detail='A nova ordem deve conter todas e somente as cenas deste capítulo.')
    pivot = max((scene.display_order for scene in scenes), default=0) + len(scenes) + 1; by_id = {scene.id: scene for scene in scenes}
    for position, scene_id in enumerate(ids): by_id[scene_id].display_order = pivot + position
    session.flush()
    for position, scene_id in enumerate(ids): by_id[scene_id].display_order = position
    session.commit()
    return [scene_out(session, by_id[scene_id]) for scene_id in ids]


def delete_scene(session: Session, story_id: UUID, chapter_id: UUID, scene_id: UUID) -> None:
    chapter_or_404(session, story_id, chapter_id); scene = scene_or_404(session, chapter_id, scene_id)
    has_progress = session.scalar(select(ReadingProgress.id).where(ReadingProgress.scene_id == scene.id).limit(1))
    if has_progress: raise conflict('Esta cena possui progresso de leitura e não pode ser excluída.')
    session.delete(scene); session.commit()


def list_media(session: Session, limit: int, offset: int) -> list[MediaAsset]:
    return session.scalars(select(MediaAsset).order_by(MediaAsset.created_at.desc(), MediaAsset.id).limit(limit).offset(offset)).all()


def add_scene_media(session: Session, story_id: UUID, chapter_id: UUID, scene_id: UUID, payload: SceneMediaCreate) -> AdminSceneMediaOut:
    chapter_or_404(session, story_id, chapter_id); scene_or_404(session, chapter_id, scene_id)
    asset = session.get(MediaAsset, payload.media_asset_id)
    if asset is None: raise HTTPException(status_code=422, detail='A mídia selecionada não existe.')
    valid_types = {'background': {'image'}, 'illustration': {'image'}, 'narration': {'audio'}, 'ambient_music': {'audio'}, 'sound_effect': {'audio'}}
    if payload.role not in valid_types or asset.media_type not in valid_types[payload.role]: raise HTTPException(status_code=422, detail='O tipo da mídia não é compatível com este papel na cena.')
    if asset.media_type == 'image' and asset.mime_type not in {'image/jpeg', 'image/png', 'image/webp'}:
        raise HTTPException(status_code=422, detail='Novos vínculos aceitam somente imagens estáticas JPEG, PNG e WebP.')
    # Serialize edits for this scene and replace the selected slot atomically.
    session.scalar(select(Scene).where(Scene.id == scene_id).with_for_update())
    link = session.scalar(select(SceneMedia).where(SceneMedia.scene_id == scene_id, SceneMedia.role == payload.role, SceneMedia.display_order == payload.display_order))
    if link is None:
        link = SceneMedia(scene_id=scene_id, **payload.model_dump())
        session.add(link)
    else:
        link.media_asset_id = payload.media_asset_id
        link.configuration = payload.configuration
    try: session.commit()
    except IntegrityError:
        session.rollback(); raise conflict('Já existe uma mídia com este papel e posição na cena.') from None
    session.refresh(link)
    return AdminSceneMediaOut(id=link.id, scene_id=link.scene_id, media_asset_id=link.media_asset_id, role=link.role, display_order=link.display_order, configuration=link.configuration, asset=media_service.media_out(asset))


def remove_scene_media(session: Session, story_id: UUID, chapter_id: UUID, scene_id: UUID, link_id: UUID) -> None:
    chapter_or_404(session, story_id, chapter_id); scene_or_404(session, chapter_id, scene_id)
    link = session.get(SceneMedia, link_id)
    if link is None or link.scene_id != scene_id: raise missing('Vínculo de mídia não encontrado nesta cena.')
    session.delete(link); session.commit()
