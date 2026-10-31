from unittest.mock import MagicMock
from uuid import uuid4

import pytest
from fastapi import HTTPException
from pydantic import ValidationError

from app.api.v1 import admin_content
from app.api.v1.admin_schemas import AdminSceneCreate, AdminSceneUpdate, SceneMediaCreate
from app.core.admin_auth import require_admin
from app.models import Chapter, MediaAsset, Scene
from app.modules.stories import chapter_scene_service as service


def test_scene_schema_requires_narrative_and_valid_media_role():
    with pytest.raises(ValidationError):
        AdminSceneCreate(narrative_text='')
    with pytest.raises(ValidationError):
        SceneMediaCreate(media_asset_id=uuid4(), role='invalid')


def test_content_routes_require_admin():
    for route in admin_content.router.routes:
        assert any(dependency.call is require_admin for dependency in route.dependant.dependencies)


def test_scene_update_validates_story_chapter_ownership_and_persists_text():
    story_id, chapter_id, scene_id = uuid4(), uuid4(), uuid4()
    chapter = Chapter(id=chapter_id, story_id=story_id, title='Capítulo', description=None, display_order=0)
    scene = Scene(id=scene_id, chapter_id=chapter_id, display_order=0, title=None, narrative_text='Antes', estimated_duration_seconds=None, text_position=None, text_animation=None, transition_type=None, presentation_config={})
    session = MagicMock()
    session.get.side_effect = lambda model, _id: chapter if model is Chapter else scene if model is Scene else None
    session.execute.return_value.all.return_value = []
    updated = service.update_scene(session, story_id, chapter_id, scene_id, AdminSceneUpdate(narrative_text='Depois'))
    assert updated.narrative_text == 'Depois'
    session.commit.assert_called_once()


def test_scene_reorder_keeps_all_scene_ids_and_uses_stable_positions():
    story_id, chapter_id = uuid4(), uuid4()
    chapter = Chapter(id=chapter_id, story_id=story_id, title='Capítulo', description=None, display_order=0)
    first = Scene(id=uuid4(), chapter_id=chapter_id, display_order=0, title=None, narrative_text='Primeira', estimated_duration_seconds=None, text_position=None, text_animation=None, transition_type=None, presentation_config={})
    second = Scene(id=uuid4(), chapter_id=chapter_id, display_order=1, title=None, narrative_text='Segunda', estimated_duration_seconds=None, text_position=None, text_animation=None, transition_type=None, presentation_config={})
    session = MagicMock(); session.get.return_value = chapter; session.scalars.return_value.all.return_value = [first, second]; session.execute.return_value.all.return_value = []
    result = service.reorder_scenes(session, story_id, chapter_id, [second.id, first.id])
    assert [item.id for item in result] == [second.id, first.id]
    assert (second.display_order, first.display_order) == (0, 1)
    session.flush.assert_called_once(); session.commit.assert_called_once()


def test_media_association_rejects_incompatible_asset_type():
    story_id, chapter_id, scene_id = uuid4(), uuid4(), uuid4()
    chapter = Chapter(id=chapter_id, story_id=story_id, title='Capítulo', description=None, display_order=0)
    scene = Scene(id=scene_id, chapter_id=chapter_id, display_order=0, title=None, narrative_text='Texto', estimated_duration_seconds=None, text_position=None, text_animation=None, transition_type=None, presentation_config={})
    asset = MediaAsset(id=uuid4(), storage_provider='frontend', storage_bucket='assets', storage_path='som.mp3', media_type='audio', mime_type='audio/mpeg', file_size=None, width=None, height=None, duration_seconds=None, asset_metadata={})
    session = MagicMock(); session.get.side_effect = lambda model, _id: chapter if model is Chapter else scene if model is Scene else asset if model is MediaAsset else None
    with pytest.raises(HTTPException) as error:
        service.add_scene_media(session, story_id, chapter_id, scene_id, SceneMediaCreate(media_asset_id=asset.id, role='illustration'))
    assert error.value.status_code == 422
