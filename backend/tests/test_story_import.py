"""Local, isolated import tests. No connections to Supabase or storage."""
import copy
import json
from pathlib import Path
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.admin_auth import require_admin
from app.core.database import get_session
from app.main import app
from app.models import Base, Chapter, Collection, CollectionStory, MediaAsset, Scene, SceneMedia, Story
from app.modules.stories import chapter_scene_service
from app.modules.stories.import_schema import StoryImport
from app.modules.stories.import_service import import_story, validate_import


@compiles(JSONB, 'sqlite')
def jsonb_for_import_test(element, compiler, **kw):
    return 'JSON'


@pytest.fixture
def document():
    return json.loads((Path(__file__).resolve().parents[2] / 'docs/examples/story-import-v1.json').read_text(encoding='utf-8'))


@pytest.fixture
def db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @event.listens_for(engine, 'connect')
    def enable_foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        session.add(Collection(id=uuid4(), slug='contos-classicos', title='Contos Clássicos', status='published'))
        existing = Story(id=uuid4(), slug='chapeuzinho-vermelho', title='Chapeuzinho Vermelho', status='published')
        session.add(existing); session.flush()
        chapter = Chapter(id=uuid4(), story_id=existing.id, title='Original', display_order=0)
        session.add(chapter); session.flush()
        session.add(Scene(id=uuid4(), chapter_id=chapter.id, narrative_text='Texto original.', display_order=0))
        session.commit()
        yield session
    engine.dispose()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_session] = lambda: db
    app.dependency_overrides[require_admin] = lambda: object()
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()


def test_preview_no_writes_then_import_draft_order_and_editor_compatibility(db, document):
    parsed = StoryImport.model_validate(document)
    preview = validate_import(db, parsed)
    assert (preview.chapter_count, preview.page_count, preview.estimated_narration_seconds) == (2, 4, 120)
    assert db.scalar(select(func.count(Story.id))) == 1
    result = import_story(db, parsed)
    assert result.status == 'draft' and result.published_at is None
    assert result.collections == ['Contos Clássicos'] and result.chapter_count == 2
    assert result.cover_asset_id is None and result.hero_asset_id is None
    assert result.estimated_reading_minutes == 2
    assert 'Direitos autorais:' in result.description and '120 segundos' in result.description
    chapters = chapter_scene_service.list_chapters(db, result.id)
    assert [c.display_order for c in chapters] == [0, 1]
    for index, chapter in enumerate(chapters):
        scenes = chapter_scene_service.list_scenes(db, result.id, chapter.id)
        assert [s.display_order for s in scenes] == [0, 1]
        assert [s.narrative_text for s in scenes] == [p['text'] for p in document['chapters'][index]['pages']]
        assert scenes[0].presentation_config['editorial']['illustration_description']
        assert all(not scene.media for scene in scenes)
    assert db.scalar(select(func.count(MediaAsset.id))) == db.scalar(select(func.count(SceneMedia.id))) == 0
    assert db.scalar(select(Story).where(Story.slug == 'chapeuzinho-vermelho')).status == 'published'
    assert db.scalar(select(Scene).where(Scene.narrative_text == 'Texto original.')) is not None


@pytest.mark.parametrize('mutate', [
    lambda d: d.pop('schema_version'),
    lambda d: d.update(schema_version=2),
    lambda d: d.update(schema_version=True),
    lambda d: d.update(schema_version=1.0),
    lambda d: d['story'].pop('title'),
    lambda d: d['story'].update(title='  '),
    lambda d: d['story'].update(minimum_age=9, maximum_age=4),
    lambda d: d['story'].update(status='published'),
    lambda d: d['story'].update(minimum_age='4'),
    lambda d: d.update(chapters=[]),
    lambda d: d['chapters'][0].update(pages=[]),
    lambda d: d['chapters'][0]['pages'][0].update(text=' \n '),
    lambda d: d['chapters'][0]['pages'][0].update(order=2),
    lambda d: d['chapters'][1].update(order=1),
    lambda d: d['chapters'][0]['pages'][0].update(estimated_narration_seconds=0),
    lambda d: d['chapters'][0]['pages'][0].update(media={'url': 'https://invalid.test'}),
])
def test_invalid_documents_rejected(document, mutate):
    mutate(document)
    with pytest.raises(ValidationError):
        StoryImport.model_validate(document)


def test_missing_collection_and_duplicate_slug_do_not_create_records(db, document):
    missing = copy.deepcopy(document); missing['story']['collection_slug'] = 'inexistente'
    with pytest.raises(HTTPException) as failure:
        import_story(db, StoryImport.model_validate(missing))
    assert failure.value.status_code == 422
    import_story(db, StoryImport.model_validate(document))
    with pytest.raises(HTTPException) as conflict:
        import_story(db, StoryImport.model_validate(document))
    assert conflict.value.status_code == 409
    assert db.scalar(select(func.count(Story.id))) == 2
    assert db.scalar(select(func.count(CollectionStory.story_id))) == 1


def test_failure_after_first_chapter_rolls_back_everything(db, document):
    flush = db.flush
    calls = 0
    def fail_after_chapter(*args, **kwargs):
        nonlocal calls
        calls += 1
        if calls == 5:
            raise RuntimeError('injected persistence failure')
        return flush(*args, **kwargs)
    with patch.object(db, 'flush', side_effect=fail_after_chapter):
        with pytest.raises(RuntimeError):
            import_story(db, StoryImport.model_validate(document))
    assert db.scalar(select(func.count(Story.id))) == 1
    assert db.scalar(select(func.count(Chapter.id))) == 1
    assert db.scalar(select(func.count(Scene.id))) == 1
    assert db.scalar(select(func.count(CollectionStory.story_id))) == 0


def test_commit_constraint_failure_rolls_back_and_reports_conflict(db, document):
    from sqlalchemy.exc import IntegrityError
    with patch.object(db, 'commit', side_effect=IntegrityError('insert', {}, Exception('conflict'))):
        with pytest.raises(HTTPException) as failure:
            import_story(db, StoryImport.model_validate(document))
    assert failure.value.status_code == 409
    assert db.scalar(select(func.count(Story.id))) == 1
    assert db.scalar(select(func.count(Chapter.id))) == 1
    assert db.scalar(select(func.count(Scene.id))) == 1


def test_partial_duration_not_presented_as_complete_estimate(db, document):
    document['story'].pop('estimated_narration_seconds')
    document['chapters'][0]['pages'][0].pop('estimated_narration_seconds')
    preview = validate_import(db, StoryImport.model_validate(document))
    assert preview.estimated_narration_seconds is None
    assert import_story(db, preview.document).estimated_reading_minutes is None


def test_checked_in_schema_matches_contract():
    from app.modules.stories.export_import_schema import official_schema
    stored = json.loads((Path(__file__).resolve().parents[2] / 'docs/schemas/story-import-v1.schema.json').read_text(encoding='utf-8'))
    assert stored == official_schema()


def test_http_preview_import_editor_and_publication_visibility(client, document):
    preview = client.post('/api/v1/admin/stories/import/validate', json=document)
    assert preview.status_code == 200
    response = client.post('/api/v1/admin/stories/import', json=preview.json()['document'])
    assert response.status_code == 201
    story = response.json()
    chapters = client.get(f'/api/v1/admin/stories/{story["id"]}/chapters').json()
    path = f'/api/v1/admin/stories/{story["id"]}/chapters/{chapters[0]["id"]}/scenes'
    scene = client.get(path).json()[0]
    updated = client.patch(f'{path}/{scene["id"]}', json={'narrative_text': 'Texto revisado.'})
    assert updated.status_code == 200 and updated.json()['narrative_text'] == 'Texto revisado.'
    assert updated.json()['presentation_config']['editorial']['illustration_description']
    for suffix in ['', '/chapters', '/reading']:
        assert client.get(f'/api/v1/stories/{story["slug"]}{suffix}').status_code == 404
    assert all(item['id'] != story['id'] for item in client.get('/api/v1/stories').json()['items'])
    assert client.get('/api/v1/stories', params={'collection': 'contos-classicos'}).json()['items'] == []
    assert client.get('/api/v1/stories', params={'q': story['title']}).json()['items'] == []
    assert client.post('/api/v1/admin/stories/import', json=document).status_code == 409


def test_http_invalid_json_field_paths_and_size(client, document):
    for source in ['{', '{"schema_version":1,"schema_version":1}']:
        response = client.post('/api/v1/admin/stories/import/validate', content=source, headers={'Content-Type': 'application/json'})
        assert response.status_code == 422 and 'JSON' in response.json()['detail']
    document['chapters'][0]['pages'][1]['text'] = '   '
    response = client.post('/api/v1/admin/stories/import', json=document)
    assert response.status_code == 422 and 'chapters.0.pages.1.text' in response.json()['detail']
    assert client.post('/api/v1/admin/stories/import', content='{}', headers={'Content-Type': 'text/plain'}).status_code == 415
    assert client.post('/api/v1/admin/stories/import', content=' ' * (2 * 1024 * 1024 + 1), headers={'Content-Type': 'application/json'}).status_code == 413


@pytest.mark.parametrize('status', [401, 403])
def test_both_import_endpoints_require_admin(client, document, status):
    def denied():
        raise HTTPException(status, detail='Acesso negado')
    app.dependency_overrides[require_admin] = denied
    for suffix in ['/import', '/import/validate']:
        assert client.post('/api/v1/admin/stories' + suffix, json=document).status_code == status
