from datetime import datetime, timezone
from uuid import uuid4

import pytest
from pydantic import ValidationError

from app.api.v1 import admin_stories
from app.api.v1.admin_schemas import AdminStoryCreate, AdminStoryUpdate
from app.core.admin_auth import require_admin
from app.models import MediaAsset, Story
from app.modules.stories import admin_service


class ScalarRows:
    def all(self):
        return []


class StorySession:
    def __init__(self):
        self.story: Story | None = None

    def scalar(self, _statement):
        return None

    def scalars(self, _statement):
        return ScalarRows()

    def get(self, model, _identifier):
        if model is Story:
            return self.story
        return None

    def add(self, story):
        now = datetime.now(timezone.utc)
        story.id = uuid4()
        story.created_at = now
        story.updated_at = now
        self.story = story

    def commit(self):
        return None

    def refresh(self, story):
        story.updated_at = datetime.now(timezone.utc)


def test_admin_story_schema_rejects_invalid_slug_and_age_range():
    with pytest.raises(ValidationError):
        AdminStoryCreate(title='Teste', slug='Título inválido')
    with pytest.raises(ValidationError):
        AdminStoryCreate(title='Teste', slug='teste', minimum_age=8, maximum_age=4)


def test_create_story_defaults_to_draft_without_chapters_or_collections():
    session = StorySession()
    created = admin_service.create_story(session, AdminStoryCreate(title='Nova história', slug='nova-historia'))
    assert created.status == 'draft'
    assert created.chapter_count == 0
    assert created.collections == []
    assert session.story is not None and session.story.title == 'Nova história'


def test_update_story_keeps_existing_content_and_publishes_only_metadata():
    session = StorySession()
    admin_service.create_story(session, AdminStoryCreate(title='Nova história', slug='nova-historia'))
    updated = admin_service.update_story(session, session.story.id, AdminStoryUpdate(status='published', description='Metadados atualizados.'))
    assert updated.status == 'published'
    assert updated.published_at is not None
    assert session.story.description == 'Metadados atualizados.'


def test_admin_story_routes_are_protected_by_require_admin():
    for route in admin_stories.router.routes:
        assert any(dependency.call is require_admin for dependency in route.dependant.dependencies)


def test_cover_and_hero_references_use_uploaded_assets_without_changing_chapters(monkeypatch):
    from app.modules.stories import media_service

    session = StorySession()
    original_get = session.get
    asset = MediaAsset(
        id=uuid4(), storage_provider='supabase', storage_bucket='editorial-media',
        storage_path='stories/example/cover.webp', media_type='image', mime_type='image/webp',
        file_size=100, asset_metadata={'title': 'Capa enviada'},
        created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    session.get = lambda model, identifier: asset if model is MediaAsset and identifier == asset.id else original_get(model, identifier)
    monkeypatch.setattr(media_service, 'resolved_url', lambda _: 'https://example.test/signed-cover.webp')
    created = admin_service.create_story(session, AdminStoryCreate(title='Teste', slug='teste'))
    updated = admin_service.update_story(session, created.id, AdminStoryUpdate(cover_asset_id=asset.id, hero_asset_id=asset.id))
    assert updated.cover_asset_id == asset.id
    assert updated.hero_asset_id == asset.id
    assert updated.cover_asset.resolved_url == 'https://example.test/signed-cover.webp'
    assert updated.chapter_count == created.chapter_count
    assert updated.status == 'draft'


def test_cover_preview_failure_does_not_break_story_metadata(monkeypatch):
    from app.modules.stories import media_service
    from fastapi import HTTPException

    session = StorySession()
    original_get = session.get
    asset = MediaAsset(
        id=uuid4(), storage_provider='supabase', storage_bucket='editorial-media',
        storage_path='cover.webp', media_type='image', mime_type='image/webp',
        asset_metadata={}, created_at=datetime.now(timezone.utc), updated_at=datetime.now(timezone.utc),
    )
    session.get = lambda model, identifier: asset if model is MediaAsset and identifier == asset.id else original_get(model, identifier)
    def unavailable(_):
        raise HTTPException(503, detail='Armazenamento indisponível.')
    monkeypatch.setattr(media_service, 'resolved_url', unavailable)
    created = admin_service.create_story(session, AdminStoryCreate(title='Teste', slug='teste', cover_asset_id=asset.id))
    assert created.cover_asset_id == asset.id
    assert created.cover_asset.resolved_url is None
