"""Isolated persistence + public serialization tests. Never opens Supabase."""
from io import BytesIO
from uuid import uuid4
from unittest.mock import Mock, patch

import pytest
from fastapi import HTTPException, UploadFile
from sqlalchemy import create_engine, select
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Session
from sqlalchemy.pool import StaticPool
from fastapi.testclient import TestClient
from app.main import app
from app.core.database import get_session
from app.core.admin_auth import require_admin
from starlette.datastructures import Headers

from app.models import Base, Story, Chapter, Scene, MediaAsset, SceneMedia
from app.api.v1.admin_schemas import SceneMediaCreate
from app.api.v1.router import story_reading, public_media
from app.modules.stories import chapter_scene_service as content, media_service as media


@compiles(JSONB, 'sqlite')
def jsonb_for_isolated_test(element, compiler, **kw):
    return 'JSON'


@pytest.fixture
def db():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    with Session(engine) as session:
        story = Story(id=uuid4(), slug='teste', title='Teste', status='published')
        session.add(story); session.flush()
        chapter = Chapter(id=uuid4(), story_id=story.id, title='Um', display_order=0)
        session.add(chapter); session.flush()
        scene = Scene(id=uuid4(), chapter_id=chapter.id, narrative_text='Texto', display_order=0)
        first = MediaAsset(id=uuid4(), storage_provider='frontend', storage_bucket='assets', storage_path='assets/um.webp', media_type='image', mime_type='image/webp')
        second = MediaAsset(id=uuid4(), storage_provider='supabase', storage_bucket='editorial-media', storage_path='dois.webp', media_type='image', mime_type='image/webp')
        session.add_all([scene, first, second]); session.commit()
        yield session, story, chapter, scene, first, second
    engine.dispose()


def test_associate_reload_replace_public_reader_and_detach(db):
    session, story, chapter, scene, first, second = db
    link = content.add_scene_media(session, story.id, chapter.id, scene.id, SceneMediaCreate(media_asset_id=first.id, role='illustration'))
    session.expire_all()
    assert content.list_scenes(session, story.id, chapter.id)[0].media[0].asset.id == first.id
    with patch.object(media, 'resolved_url', return_value='https://example.test/signed'):
        replacement = content.add_scene_media(session, story.id, chapter.id, scene.id, SceneMediaCreate(media_asset_id=second.id, role='illustration'))
    assert replacement.id == link.id
    session.expire_all()
    assert len(session.scalars(select(SceneMedia)).all()) == 1
    response = story_reading(story.slug, session)
    asset = response['chapters'][0].scenes[0].media[0].asset
    assert asset.id == second.id
    assert asset.resolved_url == f'/api/v1/media/{second.id}/content'
    with pytest.raises(HTTPException) as blocked:
        media.delete_asset(session, second.id)
    assert blocked.value.status_code == 409
    content.remove_scene_media(session, story.id, chapter.id, scene.id, link.id)
    assert session.get(MediaAsset, second.id) is not None
    assert content.list_scenes(session, story.id, chapter.id)[0].media == []
    media.delete_asset(session, first.id)
    assert session.get(MediaAsset, first.id) is None


def test_public_delivery_checks_publication_on_every_request(db):
    session, story, chapter, scene, first, second = db
    with patch.object(media, 'resolved_url', return_value='https://example.test/signed'):
        content.add_scene_media(session, story.id, chapter.id, scene.id, SceneMediaCreate(media_asset_id=second.id, role='background'))
        assert public_media(second.id, session).status_code == 307
        story.status = 'draft'; session.commit()
        with pytest.raises(HTTPException) as denied:
            public_media(second.id, session)
        assert denied.value.status_code == 404


@pytest.mark.parametrize('filename,mime,data', [
    ('foto.jpeg', 'image/jpeg', b'\xff\xd8\xffdata'),
    ('foto.png', 'image/png', b'\x89PNG\r\n\x1a\ndata'),
    ('foto.webp', 'image/webp', b'RIFF0000WEBPdata'),
])
def test_static_upload_formats(filename, mime, data):
    file = UploadFile(filename=filename, file=BytesIO(data), headers=Headers({'content-type': mime}))
    assert media._validate_file(file, data)[1] == 'image'


@pytest.mark.parametrize('mime,name', [('image/gif','x.gif'), ('video/mp4','x.mp4'), ('video/webm','x.webm')])
def test_retired_formats_rejected(mime, name):
    with pytest.raises(HTTPException):
        media._validate_file(UploadFile(filename=name, file=BytesIO(), headers=Headers({'content-type': mime})), b'data')


def test_signed_url_uses_asset_bucket_and_safe_path_and_renews(db):
    _, _, _, _, _, asset = db
    asset.storage_path = 'cena com espaço.webp'
    with patch.object(media, '_storage_config', return_value=('https://example.test', 'secret-not-logged', 'other-bucket')), patch.object(media.httpx, 'post', return_value=Mock(status_code=200, json=lambda: {'signedURL': '/object/sign/editorial-media/test?token=temporary'})) as request:
        media.resolved_url(asset); media.resolved_url(asset)
        assert request.call_count == 2
        assert '/editorial-media/cena%20com%20espa%C3%A7o.webp' in request.call_args.args[0]


def test_http_association_reload_and_reader_contract(db):
    session, story, chapter, scene, first, _ = db
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[require_admin] = lambda: object()
    path = f'/api/v1/admin/stories/{story.id}/chapters/{chapter.id}/scenes/{scene.id}/media'
    try:
        with TestClient(app) as client:
            response = client.post(path, json={'media_asset_id': str(first.id), 'role': 'illustration'})
            assert response.status_code == 201
            session.expire_all()
            persisted = client.get(f'/api/v1/admin/stories/{story.id}/chapters/{chapter.id}/scenes').json()
            assert persisted[0]['media'][0]['media_asset_id'] == str(first.id)
            reader = client.get(f'/api/v1/stories/{story.slug}/reading').json()
            assert reader['chapters'][0]['scenes'][0]['media'][0]['asset']['resolved_url'] == '/assets/um.webp'
            removed = client.delete(f'{path}/{response.json()["id"]}')
            assert removed.status_code == 204 and removed.content == b''
            assert session.get(MediaAsset, first.id) is not None
    finally:
        app.dependency_overrides.clear()


def test_upload_cover_save_metadata_and_read_public_story_without_touching_scenes(db):
    session, story, chapter, scene, first, _ = db
    story.cover_asset_id = first.id
    session.commit()
    narrative = scene.narrative_text
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[require_admin] = lambda: object()
    try:
        with patch.object(media, '_storage_config', return_value=('https://storage.example.test', 'test-only-key', 'editorial-media')), patch.object(media.httpx, 'post', return_value=Mock(status_code=200)), patch.object(media, 'resolved_url', return_value='https://example.test/signed-cover.webp'), TestClient(app) as client:
            response = client.post('/api/v1/admin/media/upload', files={'file': ('cover.webp', b'RIFF0000WEBPdata', 'image/webp')}, data={'story_id': str(story.id), 'title': 'Capa enviada'})
            assert response.status_code == 201
            uploaded_id = response.json()['id']
            session.refresh(story)
            assert story.cover_asset_id == first.id  # Upload alone does not replace the cover.
            saved = client.patch(f'/api/v1/admin/stories/{story.id}', json={'cover_asset_id': uploaded_id})
            assert saved.status_code == 200
            assert saved.json()['cover_asset']['resolved_url'] == 'https://example.test/signed-cover.webp'
            session.expire_all()
            public = client.get(f'/api/v1/stories/{story.slug}')
            assert public.status_code == 200
            assert public.json()['cover_asset']['id'] == uploaded_id
            assert public.json()['cover_asset']['resolved_url'] == f'/api/v1/media/{uploaded_id}/content'
            assert session.get(Scene, scene.id).narrative_text == narrative
            assert session.get(Chapter, chapter.id).story_id == story.id
            assert session.get(MediaAsset, first.id) is not None
    finally:
        app.dependency_overrides.clear()
