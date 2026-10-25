"""Integration tests run only against an explicitly named local test database."""
import os
import uuid
from decimal import Decimal
import pytest
from sqlalchemy import create_engine, text
from sqlalchemy.engine import make_url
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from app.models import Base, Chapter, ReadingProfile, ReadingProgress, Scene, Story, User

@pytest.fixture
def session():
    url = os.environ.get('TEST_DATABASE_URL')
    if not url:
        pytest.skip('TEST_DATABASE_URL não configurada; integração PostgreSQL não executada')
    parsed = make_url(url)
    if parsed.get_backend_name() != 'postgresql' or parsed.host not in ('localhost', '127.0.0.1', '::1') or not (parsed.database or '').startswith('test_'):
        pytest.fail('TEST_DATABASE_URL deve apontar para um banco test_* local')
    schema = 'test_reader_' + uuid.uuid4().hex
    engine = create_engine(url, connect_args={'connect_timeout': 5})
    with engine.begin() as connection:
        connection.execute(text(f'CREATE SCHEMA "{schema}"'))
    try:
        with engine.connect() as connection:
            connection.execute(text(f'SET search_path TO "{schema}"'))
            connection.commit()
            Base.metadata.create_all(connection)  # Somente schema isolado do teste; não é migration.
            connection.commit()
            with Session(connection) as db:
                yield db
    finally:
        with engine.begin() as connection:
            connection.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
        engine.dispose()

def test_progress_rejects_scene_from_another_chapter(session):
    owner = User(id=uuid.uuid4())
    profile = ReadingProfile(id=uuid.uuid4(), user_id=owner.id, display_name='Teste')
    story = Story(id=uuid.uuid4(), slug='historia', title='História', synopsis='', description='', language='pt-BR', status='published')
    session.add_all([owner, story]); session.flush()
    session.add(profile)
    first = Chapter(id=uuid.uuid4(), story_id=story.id, title='Um', display_order=1)
    second = Chapter(id=uuid.uuid4(), story_id=story.id, title='Dois', display_order=2)
    session.add_all([first, second]); session.flush()
    scene = Scene(id=uuid.uuid4(), chapter_id=second.id, display_order=1, narrative_text='Texto')
    session.add(scene); session.flush()
    session.add(ReadingProgress(reading_profile_id=profile.id, story_id=story.id, chapter_id=first.id, scene_id=scene.id, completion_percentage=Decimal('20')))
    with pytest.raises(IntegrityError):
        session.flush()
