"""Atomic import into the same models/services consumed by the editorial reader."""
from math import ceil
from uuid import uuid4

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from app.api.v1.admin_schemas import AdminStoryCreate, AdminStoryOut
from app.models import Chapter, Collection, CollectionStory, Scene
from app.modules.stories import admin_service
from app.modules.stories.import_schema import ImportPreview, StoryImport

LABELS = {
    'author': 'Autor', 'literary_origin': 'Origem literária',
    'reference_work': 'Obra de referência', 'reference_version': 'Versão de referência',
    'editorial_notes': 'Observações editoriais', 'copyright_notes': 'Direitos autorais',
}


def narration_seconds(document: StoryImport) -> int | None:
    if document.story.estimated_narration_seconds is not None:
        return document.story.estimated_narration_seconds
    pages = [page for chapter in document.chapters for page in chapter.pages]
    # A partial sum must not be presented as an estimate for the complete story.
    return sum(page.estimated_narration_seconds for page in pages) if all(page.estimated_narration_seconds is not None for page in pages) else None


def editorial_description(document: StoryImport) -> str:
    """No new DB column: readable, editable metadata in the existing description."""
    sections = [document.story.description.strip()]
    sections.extend(f'{LABELS[key]}:\n{value.strip()}' for key, value in document.story.editorial.model_dump().items() if value and value.strip())
    duration = narration_seconds(document)
    if duration is not None:
        sections.append(f'Duração estimada de narração: {duration} segundos.')
    return '\n\n'.join(section for section in sections if section)


def validate_import(session: Session, document: StoryImport) -> ImportPreview:
    collection = session.scalar(select(Collection).where(Collection.slug == document.story.collection_slug))
    if collection is None:
        raise HTTPException(422, detail='story.collection_slug: esta coleção não existe. Use o slug de uma coleção cadastrada.')
    admin_service.ensure_available_slug(session, document.story.slug)
    warnings = ['A história será criada como rascunho, sem capa, ilustrações ou áudios. Os campos literários complementares serão preservados na descrição editorial; essa descrição pode ser exibida publicamente após a publicação.']
    if collection.status != 'published':
        warnings.append('A coleção selecionada não está publicada.')
    return ImportPreview(document=document, collection_title=collection.title,
                         chapter_count=len(document.chapters), page_count=sum(len(c.pages) for c in document.chapters),
                         estimated_narration_seconds=narration_seconds(document), warnings=warnings)


def import_story(session: Session, document: StoryImport) -> AdminStoryOut:
    try:
        # Recheck database-dependent validation at confirmation; preview is never authority.
        validate_import(session, document)
        collection = session.scalar(select(Collection).where(Collection.slug == document.story.collection_slug))
        if collection is None:
            raise HTTPException(422, detail='story.collection_slug: a coleção foi removida. Valide o arquivo novamente.')
        duration = narration_seconds(document)
        payload = AdminStoryCreate(
            title=document.story.title, slug=document.story.slug, synopsis=document.story.synopsis,
            description=editorial_description(document), minimum_age=document.story.minimum_age,
            maximum_age=document.story.maximum_age, language=document.story.language,
            estimated_reading_minutes=max(1, ceil(duration / 60)) if duration is not None else None,
            status='draft',
        )
        story = admin_service.prepare_new_story(session, payload)
        story.id = uuid4()
        session.flush()
        session.add(CollectionStory(collection_id=collection.id, story_id=story.id, display_order=0))
        for chapter_data in document.chapters:
            chapter = Chapter(id=uuid4(), story_id=story.id, title=chapter_data.title, display_order=chapter_data.order - 1)
            session.add(chapter)
            session.flush()
            for page in chapter_data.pages:
                config = {'editorial': {'illustration_description': page.illustration_description}} if page.illustration_description is not None else {}
                session.add(Scene(id=uuid4(), chapter_id=chapter.id, display_order=page.order - 1,
                                  title=page.title, narrative_text=page.text,
                                  estimated_duration_seconds=page.estimated_narration_seconds,
                                  text_animation='fade', transition_type='fade', presentation_config=config))
        session.flush()
        result = admin_service.get_story(session, story.id)
        session.commit()
        return result
    except IntegrityError:
        session.rollback()
        raise HTTPException(409, detail='Conflito de slug ou de coleção durante a importação. Nenhum registro desta tentativa foi criado. Confira o catálogo antes de repetir.') from None
    except Exception:
        session.rollback()
        raise
