from datetime import datetime, timezone
from uuid import uuid4
from unittest.mock import MagicMock
from fastapi.testclient import TestClient
from sqlalchemy.dialects import postgresql
from app.api.v1.router import published_story
from app.core.config import Settings
from app.core.database import get_session
from app.main import app
from app.models import Base, Story
from app.api.v1.schemas import StoryOut

client = TestClient(app)

def test_health_and_only_read_routes():
    assert client.get("/health").json() == {"status": "ok"}
    spec = client.get("/openapi.json").json()
    for path, methods in spec["paths"].items():
        if path.startswith('/api/v1/admin/'):
            continue
        assert set(methods) == {"get"}, path

def test_configuration_does_not_expose_password():
    settings = Settings(_env_file=None, database_url="postgresql://u:password-not-for-display-2048@localhost/db")
    assert "password-not-for-display-2048" not in repr(settings)
    assert settings.sqlalchemy_url().startswith("postgresql+psycopg://")
    supabase = Settings(_env_file=None, database_url='postgresql://u:p@pooler.supabase.com/db')
    assert 'sslmode=require' in supabase.sqlalchemy_url()

def test_unpublished_and_missing_are_not_found():
    session = MagicMock()
    session.scalar.return_value = None
    app.dependency_overrides[get_session] = lambda: session
    try:
        assert client.get("/api/v1/stories/unknown").status_code == 404
        assert client.get("/api/v1/stories/unknown/chapters").status_code == 404
        query = session.scalar.call_args.args[0]
        sql = str(query.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        assert "stories.status = 'published'" in sql
    finally:
        app.dependency_overrides.clear()

def test_pagination_validation_and_public_query():
    session = MagicMock()
    session.scalars.return_value.all.return_value = []
    app.dependency_overrides[get_session] = lambda: session
    try:
        assert client.get("/api/v1/stories?limit=0").status_code == 422
        response = client.get("/api/v1/stories?limit=5&offset=10")
        assert response.json() == {"items": [], "limit": 5, "offset": 10}
        sql = str(session.scalars.call_args.args[0].compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
        assert "stories.status = 'published'" in sql
        assert "LIMIT 5 OFFSET 10" in sql
        assert client.get("/api/v1/collections?limit=3").status_code == 200
    finally:
        app.dependency_overrides.clear()

def test_story_serialization_and_integrity_constraints():
    story = Story(id=uuid4(), slug="teste", title="Teste", subtitle=None, synopsis="", description="", cover_asset_id=None, hero_asset_id=None, minimum_age=None, maximum_age=None, estimated_reading_minutes=None, language="pt-BR", status="published", published_at=datetime.now(timezone.utc))
    assert StoryOut.model_validate(story).slug == "teste"
    progress = Base.metadata.tables["reading_progress"]
    assert {"fk_progress_story_chapter", "fk_progress_chapter_scene", "uq_progress_profile_story"}.issubset({constraint.name for constraint in progress.constraints})
    assert {"uq_scene_order", "uq_scene_chapter_id"}.issubset({constraint.name for constraint in Base.metadata.tables["scenes"].constraints})

def test_reading_orders_chapters_and_scenes():
    session = MagicMock()
    story = Story(id=uuid4(), slug="teste", title="Teste", subtitle=None, synopsis="", description="", cover_asset_id=None, hero_asset_id=None, minimum_age=None, maximum_age=None, estimated_reading_minutes=None, language="pt-BR", status="published", published_at=None)
    session.scalar.return_value = story
    session.scalars.return_value.all.return_value = []
    app.dependency_overrides[get_session] = lambda: session
    try:
        response = client.get('/api/v1/stories/teste/reading')
        assert response.status_code == 200 and response.json()['chapters'] == []
        queries = [str(call.args[0]) for call in session.scalars.call_args_list]
        assert any('ORDER BY chapters.display_order, chapters.id' in query for query in queries)
    finally:
        app.dependency_overrides.clear()
