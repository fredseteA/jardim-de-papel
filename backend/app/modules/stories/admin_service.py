from datetime import datetime, timezone
from uuid import UUID

from fastapi import HTTPException, status
from sqlalchemy import delete, func, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.admin_schemas import AdminStoryCreate, AdminStoryOut, AdminStoryUpdate
from app.models import Chapter, Collection, CollectionStory, MediaAsset, ReadingProgress, Story
from app.modules.stories.media_service import media_out


def _not_found() -> HTTPException:
    return HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail='História não encontrada.')


def _conflict() -> HTTPException:
    return HTTPException(status_code=status.HTTP_409_CONFLICT, detail='Este slug já está em uso. Escolha outro.')


def _validate_assets(session: Session, cover_asset_id: UUID | None, hero_asset_id: UUID | None) -> None:
    for asset_id in {asset_id for asset_id in (cover_asset_id, hero_asset_id) if asset_id}:
        if session.get(MediaAsset, asset_id) is None:
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='A mídia informada não existe.')


def _serialize(session: Session, story: Story, chapter_count: int | None = None) -> AdminStoryOut:
    if chapter_count is None:
        chapter_count = session.scalar(select(func.count(Chapter.id)).where(Chapter.story_id == story.id)) or 0
    cover = session.get(MediaAsset, story.cover_asset_id) if story.cover_asset_id else None
    collections = session.scalars(
        select(Collection.title)
        .join(CollectionStory, CollectionStory.collection_id == Collection.id)
        .where(CollectionStory.story_id == story.id)
        .order_by(CollectionStory.display_order, Collection.title)
    ).all()
    return AdminStoryOut(
        id=story.id, slug=story.slug, title=story.title, subtitle=story.subtitle,
        synopsis=story.synopsis, description=story.description,
        cover_asset_id=story.cover_asset_id, hero_asset_id=story.hero_asset_id,
        minimum_age=story.minimum_age, maximum_age=story.maximum_age,
        estimated_reading_minutes=story.estimated_reading_minutes, language=story.language,
        status=story.status, published_at=story.published_at, created_at=story.created_at,
        updated_at=story.updated_at, cover_asset=media_out(cover) if cover else None, collections=collections,
        chapter_count=chapter_count,
    )


def list_stories(session: Session, *, limit: int, offset: int, query: str = '', story_status: str | None = None) -> list[AdminStoryOut]:
    chapter_count = select(func.count(Chapter.id)).where(Chapter.story_id == Story.id).correlate(Story).scalar_subquery()
    statement = select(Story, chapter_count.label('chapter_count')).order_by(Story.updated_at.desc(), Story.id).limit(limit).offset(offset)
    if query.strip():
        needle = f'%{query.strip()}%'
        statement = statement.where(or_(Story.title.ilike(needle), Story.slug.ilike(needle)))
    if story_status:
        statement = statement.where(Story.status == story_status)
    return [_serialize(session, story, count) for story, count in session.execute(statement).all()]


def get_story(session: Session, story_id: UUID) -> AdminStoryOut:
    story = session.get(Story, story_id)
    if story is None:
        raise _not_found()
    return _serialize(session, story)


def _apply_input(story: Story, values: dict) -> None:
    for key, value in values.items():
        setattr(story, key, value)
    if story.status == 'published' and story.published_at is None:
        story.published_at = datetime.now(timezone.utc)


def ensure_available_slug(session: Session, slug: str) -> None:
    if session.scalar(select(Story.id).where(Story.slug == slug)) is not None:
        raise _conflict()


def prepare_new_story(session: Session, payload: AdminStoryCreate) -> Story:
    """Stage a new story without committing, so imports can share one transaction."""
    values = payload.model_dump()
    _validate_assets(session, values['cover_asset_id'], values['hero_asset_id'])
    ensure_available_slug(session, values['slug'])
    story = Story(**values)
    session.add(story)
    return story


def create_story(session: Session, payload: AdminStoryCreate) -> AdminStoryOut:
    story = prepare_new_story(session, payload)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise _conflict() from None
    session.refresh(story)
    return _serialize(session, story)


def update_story(session: Session, story_id: UUID, payload: AdminStoryUpdate) -> AdminStoryOut:
    story = session.get(Story, story_id)
    if story is None:
        raise _not_found()
    values = payload.model_dump(exclude_unset=True)
    if 'slug' in values and values['slug'] != story.slug:
        existing = session.scalar(select(Story.id).where(Story.slug == values['slug'], Story.id != story.id))
        if existing is not None:
            raise _conflict()
    _validate_assets(session, values.get('cover_asset_id', story.cover_asset_id), values.get('hero_asset_id', story.hero_asset_id))
    minimum = values.get('minimum_age', story.minimum_age)
    maximum = values.get('maximum_age', story.maximum_age)
    if minimum is not None and maximum is not None and maximum < minimum:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail='A idade máxima não pode ser menor que a idade mínima.')
    _apply_input(story, values)
    try:
        session.commit()
    except IntegrityError:
        session.rollback()
        raise _conflict() from None
    session.refresh(story)
    return _serialize(session, story)


def delete_story(session: Session, story_id: UUID, confirmation_slug: str) -> None:
    """Delete only this story's content; preserve assets, files and collections."""
    try:
        story = session.scalar(select(Story).where(Story.id == story_id).with_for_update())
        if story is None:
            raise _not_found()
        if confirmation_slug != story.slug:
            raise HTTPException(409, detail='O slug de confirmação não corresponde à história atual. Confira os dados antes de excluir.')
        # Remove these first: progress also has composite FKs to chapters/scenes.
        session.execute(delete(ReadingProgress).where(ReadingProgress.story_id == story_id))
        # Existing database cascades remove chapters, scenes, media links,
        # collection links and favorites, never MediaAsset or storage objects.
        session.delete(story)
        session.commit()
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, detail='Não foi possível excluir devido a um vínculo de dados. Nenhuma exclusão desta tentativa foi concluída.') from None
    except Exception:
        session.rollback()
        raise
