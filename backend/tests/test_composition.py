from unittest.mock import patch
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.core.admin_auth import require_admin
from app.core.database import get_session
from app.modules.stories.composition import CompositionUpdate
from pydantic import ValidationError
from tests.test_editorial_media_flow import db  # isolated SQLite fixture


@pytest.mark.parametrize('value', [-1, 101, float('inf')])
def test_rejects_invalid_coordinates(value):
    with pytest.raises(ValidationError):
        CompositionUpdate(expected_revision=0, layouts={'portrait': {'text_x': value}})


def test_rejects_invalid_zoom_and_unknown_format():
    for layouts in [{'landscape': {'zoom': .5}}, {'desktop': {'zoom': 1}}, {}]:
        with pytest.raises(ValidationError):
            CompositionUpdate(expected_revision=0, layouts=layouts)


def test_http_layout_persistence_independence_conflicts_and_text_preservation(db):
    session, story, chapter, scene, _, _ = db
    scene.presentation_config = {'jdp_import_v1': {'legacyPageId': 'old'}, 'motion': 'none'}
    session.commit()
    app.dependency_overrides[get_session] = lambda: session
    app.dependency_overrides[require_admin] = lambda: object()
    path = f'/api/v1/admin/stories/{story.id}/chapters/{chapter.id}/scenes/{scene.id}'
    try:
        with TestClient(app) as client:
            first = client.patch(path + '/composition', json={'expected_revision': 0, 'layouts': {'portrait': {'text_x': 30, 'text_y': 80, 'zoom': 1.5}}})
            assert first.status_code == 200
            assert first.json()['narrative_text'] == 'Texto'
            second = client.patch(path + '/composition', json={'expected_revision': 1, 'layouts': {'landscape': {'text_x': 100, 'text_y': 10, 'zoom': 2}}})
            assert second.status_code == 200
            session.expire_all()
            loaded = client.get(f'/api/v1/admin/stories/{story.id}/chapters/{chapter.id}/scenes').json()[0]
            config = loaded['presentation_config']
            assert config['composition']['layouts']['portrait']['text_y'] == 80
            assert config['composition']['layouts']['landscape']['zoom'] == 2
            assert config['jdp_import_v1']['legacyPageId'] == 'old'
            conflict = client.patch(path + '/composition', json={'expected_revision': 0, 'layouts': {'tablet': {'zoom': 1}}})
            assert conflict.status_code == 409
            # An old text form cannot overwrite the newer composition.
            narrative = client.patch(path, json={'narrative_text': 'Texto atualizado', 'presentation_config': {'composition': {'version': 1, 'revision': 0, 'layouts': {}}}})
            assert narrative.status_code == 200
            assert narrative.json()['presentation_config']['composition']['revision'] == 2
            public = client.get(f'/api/v1/stories/{story.slug}/reading').json()
            result = public['chapters'][0]['scenes'][0]
            assert result['narrative_text'] == 'Texto atualizado'
            assert result['presentation_config']['composition'] == config['composition']
            assert client.patch(path + '/composition', json={'expected_revision': 2, 'layouts': {'portrait': {'zoom': 50}}}).status_code == 422
    finally:
        app.dependency_overrides.clear()


def test_composition_route_requires_admin():
    from app.api.v1.admin_content import router
    route = next(r for r in router.routes if r.path.endswith('/composition'))
    assert any(d.call is require_admin for d in route.dependant.dependencies)
