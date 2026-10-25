import copy
from sqlalchemy import create_engine, event, select, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.compiler import compiles
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
import pytest
from app.models import Base, Chapter, Collection, CollectionStory, MediaAsset, Scene, SceneMedia, Story
from app.core.database import get_session
from app.main import app
from app.scripts.import_chapeuzinho import Inventory, all_media, import_content, load_inventory, stable_id

@compiles(JSONB, 'sqlite')
def sqlite_jsonb(_type, _compiler, **_kw): return 'JSON'

@pytest.fixture
def engine():
    engine = create_engine('sqlite://', connect_args={'check_same_thread': False}, poolclass=__import__('sqlalchemy').pool.StaticPool)
    @event.listens_for(engine, 'connect')
    def enable_fk(connection, _record): connection.execute('PRAGMA foreign_keys=ON')
    Base.metadata.create_all(engine)
    yield engine
    engine.dispose()

def counts(session):
    return {model.__tablename__: session.scalar(select(func.count()).select_from(model)) for model in (Collection, Story, CollectionStory, Chapter, Scene, MediaAsset, SceneMedia)}

def test_inventory_and_asset_validation():
    inventory = load_inventory()
    assert len(inventory.story.chapters) == 5
    assert sum(len(c.pages) for c in inventory.story.chapters) == 20
    assert len(set(all_media(inventory))) == 8
    raw = inventory.model_dump(exclude_none=True)
    raw['story']['chapters'][0]['pages'][0]['illustration']['src'] = '/assets/inexistente.webp'
    with pytest.raises(ValueError): Inventory.model_validate(raw)
    raw = inventory.model_dump(exclude_none=True)
    raw['story']['chapters'][0]['pages'][1]['id'] = raw['story']['chapters'][0]['pages'][0]['id']
    with pytest.raises(ValueError): Inventory.model_validate(raw)

def test_import_idempotence_and_api_reading(engine):
    inventory = load_inventory()
    with Session(engine) as db:
        with db.begin(): first = import_content(db, inventory)
        initial_counts = counts(db)
        db.commit()
        with db.begin(): second = import_content(db, inventory)
        assert first == second
        assert counts(db) == initial_counts == {'collections': 1, 'stories': 1, 'collection_stories': 1, 'chapters': 5, 'scenes': 20, 'media_assets': 8, 'scene_media': 20}
        assert db.get(Story, stable_id('story', inventory.story.id)).status == 'published'
        assert [c.display_order for c in db.scalars(select(Chapter).order_by(Chapter.display_order))] == [1,2,3,4,5]
        for chapter in inventory.story.chapters:
            scene = db.get(Scene, stable_id('scene', chapter.pages[0].id))
            assert scene.narrative_text == chapter.pages[0].text
            assert scene.presentation_config['jdp_import_v1']['legacyChapterSlug'] == chapter.slug
    app.dependency_overrides[get_session] = lambda: Session(engine)
    try:
        with TestClient(app) as client:
            result = client.get('/api/v1/stories/chapeuzinho-vermelho/reading')
            assert result.status_code == 200
            payload = result.json()
            assert len(payload['chapters']) == 5
            assert sum(len(ch['scenes']) for ch in payload['chapters']) == 20
            assert payload['cover_asset']['asset_metadata']['jdp_import_v1']['id'] == inventory.story.id
            assert payload['chapters'][0]['scenes'][0]['media'][0]['configuration']['demonstrative'] is True
            assert client.get('/api/v1/stories?collection=contos-classicos').json()['items'][0]['slug'] == inventory.story.slug
    finally: app.dependency_overrides.clear()

def test_import_rollback_on_conflict(engine):
    inventory = load_inventory()
    with Session(engine) as db:
        with db.begin(): db.add(Story(id=stable_id('story', 'outra'), slug=inventory.story.slug, title='Outra', synopsis='', description='', language='pt-BR', status='draft'))
        with pytest.raises(ValueError):
            with db.begin(): import_content(db, inventory)
        assert counts(db)['stories'] == 1
        assert counts(db)['chapters'] == 0
        assert counts(db)['media_assets'] == 0


def test_partial_writes_are_rolled_back_when_later_chapter_conflicts(engine):
    inventory = load_inventory()
    unrelated = stable_id('story', 'outra')
    conflict_chapter = stable_id('chapter', inventory.story.chapters[-1].id)
    with Session(engine) as db:
        with db.begin():
            db.add(Story(id=unrelated, slug='outra', title='Outra', synopsis='', description='', language='pt-BR', status='draft'))
            db.flush()
            db.add(Chapter(id=conflict_chapter, story_id=unrelated, title='Outro', display_order=1))
        with pytest.raises(ValueError):
            with db.begin(): import_content(db, inventory)
        assert counts(db) == {'collections': 0, 'stories': 1, 'collection_stories': 0, 'chapters': 1, 'scenes': 0, 'media_assets': 0, 'scene_media': 0}


def test_draft_is_not_public(engine):
    inventory = load_inventory()
    with Session(engine) as db:
        with db.begin():
            import_content(db, inventory)
            db.get(Story, stable_id('story', inventory.story.id)).status = 'draft'
    app.dependency_overrides[get_session] = lambda: Session(engine)
    try:
        with TestClient(app) as client:
            assert client.get('/api/v1/stories/chapeuzinho-vermelho').status_code == 404
            assert client.get('/api/v1/stories/chapeuzinho-vermelho/reading').status_code == 404
            assert client.get('/api/v1/stories').json()['items'] == []
    finally: app.dependency_overrides.clear()
