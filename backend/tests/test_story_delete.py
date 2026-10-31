"""Deletion is tested only in an isolated database with foreign keys enabled."""
from unittest.mock import patch
from uuid import uuid4

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event, func, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool

from app.core.admin_auth import require_admin
from app.core.database import get_session
from app.main import app
from app.models import Base, Chapter, Collection, CollectionStory, Favorite, MediaAsset, ReadingProfile, ReadingProgress, Scene, SceneMedia, Story, User
from app.modules.stories.admin_service import delete_story


@compiles(JSONB, 'sqlite')
def jsonb_for_delete_test(element, compiler, **kw):
    return 'JSON'


@pytest.fixture
def db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    @event.listens_for(engine, 'connect')
    def foreign_keys(connection, _):
        connection.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        asset = MediaAsset(id=uuid4(), storage_provider='frontend', storage_bucket='assets', storage_path='shared.webp', media_type='image', mime_type='image/webp')
        user = User(id=uuid4())
        session.add_all([asset, user]); session.flush()
        profile = ReadingProfile(id=uuid4(), user_id=user.id, display_name='Teste')
        collection = Collection(id=uuid4(), slug='colecao', title='Coleção', status='published', cover_asset_id=asset.id)
        stories = [Story(id=uuid4(), title=title, slug=slug, status='published', cover_asset_id=asset.id) for title, slug in [('História alvo', 'historia-alvo'), ('Outra história', 'outra-historia')]]
        session.add_all([profile, collection, *stories]); session.flush()
        for story in stories:
            chapter = Chapter(id=uuid4(), story_id=story.id, title='Um capítulo', display_order=0)
            session.add(chapter); session.flush()
            scene = Scene(id=uuid4(), chapter_id=chapter.id, narrative_text='Uma narrativa.', display_order=0)
            session.add(scene); session.flush()
            session.add_all([
                SceneMedia(scene_id=scene.id, media_asset_id=asset.id, role='illustration'),
                CollectionStory(collection_id=collection.id, story_id=story.id),
                Favorite(reading_profile_id=profile.id, story_id=story.id),
                ReadingProgress(reading_profile_id=profile.id, story_id=story.id, chapter_id=chapter.id, scene_id=scene.id, completion_percentage=25),
            ])
        session.commit()
        yield session, stories, asset, collection
    engine.dispose()


@pytest.fixture
def client(db):
    app.dependency_overrides[get_session] = lambda: db[0]
    app.dependency_overrides[require_admin] = lambda: object()
    try:
        with TestClient(app) as connection:
            yield connection
    finally:
        app.dependency_overrides.clear()


def test_published_story_delete_removes_only_own_content_and_preserves_shared_assets(db, client):
    session, (story, other), asset, collection = db
    story_id, other_id, asset_id, collection_id = story.id, other.id, asset.id, collection.id
    slug = story.slug
    response = client.request('DELETE', f'/api/v1/admin/stories/{story_id}', json={'confirm': True, 'confirmation_slug': slug})
    assert response.status_code == 204 and response.content == b''
    session.expire_all()
    assert session.get(Story, story_id) is None and session.get(Story, other_id) is not None
    for model in [Chapter, Scene, SceneMedia, Favorite, ReadingProgress, CollectionStory]:
        assert session.scalar(select(func.count()).select_from(model)) == 1
    assert session.get(MediaAsset, asset_id) is not None and session.get(Collection, collection_id) is not None
    assert session.scalar(select(func.count(User.id))) == 1
    assert session.scalar(select(func.count(ReadingProfile.id))) == 1
    assert client.get(f'/api/v1/stories/{slug}/reading').status_code == 404
    assert client.get(f'/api/v1/stories/{other.slug}/reading').status_code == 200


@pytest.mark.parametrize('payload', [None, {}, {'confirm': False, 'confirmation_slug': 'historia-alvo'}, {'confirm': 1, 'confirmation_slug': 'historia-alvo'}, {'confirm': True}])
def test_delete_requires_explicit_confirmation(db, client, payload):
    session, stories, _, _ = db
    assert client.request('DELETE', f'/api/v1/admin/stories/{stories[0].id}', json=payload).status_code == 422
    assert session.scalar(select(func.count(Story.id))) == 2


def test_wrong_slug_and_unknown_story_do_not_delete(db, client):
    session, stories, _, _ = db
    assert client.request('DELETE', f'/api/v1/admin/stories/{stories[0].id}', json={'confirm': True, 'confirmation_slug': 'outra-historia'}).status_code == 409
    assert client.request('DELETE', f'/api/v1/admin/stories/{uuid4()}', json={'confirm': True, 'confirmation_slug': 'historia-alvo'}).status_code == 404
    assert session.scalar(select(func.count(Story.id))) == 2


@pytest.mark.parametrize('code', [401, 403])
def test_delete_requires_admin(db, client, code):
    def denied():
        raise HTTPException(code)
    app.dependency_overrides[require_admin] = denied
    assert client.request('DELETE', f'/api/v1/admin/stories/{db[1][0].id}', json={'confirm': True, 'confirmation_slug': 'historia-alvo'}).status_code == code
    assert db[0].scalar(select(func.count(Story.id))) == 2


def test_failure_rolls_back_progress_and_story_deletion(db):
    session, stories, _, _ = db
    with patch.object(session, 'commit', side_effect=RuntimeError('failure')):
        with pytest.raises(RuntimeError):
            delete_story(session, stories[0].id, stories[0].slug)
    assert session.scalar(select(func.count(Story.id))) == 2
    assert session.scalar(select(func.count(ReadingProgress.id))) == 2
    assert session.scalar(select(func.count(Chapter.id))) == 2


@pytest.mark.parametrize('status', ['draft', 'archived'])
def test_other_editorial_statuses_use_same_confirmation(db, status):
    session, stories, _, _ = db
    story = stories[0]; story.status = status; session.commit(); story_id = story.id
    delete_story(session, story.id, story.slug)
    assert session.get(Story, story_id) is None
