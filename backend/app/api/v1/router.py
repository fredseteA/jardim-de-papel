from typing import Annotated
import re
import unicodedata
from difflib import SequenceMatcher
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session
from app.core.database import get_session
from app.models import Chapter, Collection, CollectionStory, MediaAsset, Scene, SceneMedia, Story
from app.api.v1.schemas import ChapterOut, ChapterWithScenes, CollectionOut, CollectionPage, ReadingStory, SceneMediaOut, SceneOut, StoryOut, StoryPage

router = APIRouter(prefix="/api/v1")
DB = Annotated[Session, Depends(get_session)]
Limit = Annotated[int, Query(ge=1, le=100)]
Offset = Annotated[int, Query(ge=0)]

def published_story(session: Session, slug: str) -> Story:
    item = session.scalar(select(Story).where(Story.slug == slug, Story.status == "published"))
    if item is None:
        raise HTTPException(status_code=404, detail="História não encontrada")
    return item

def enrich_stories(session: Session, stories: list[Story]):
    if not stories: return []
    ids = [s.id for s in stories]
    asset_ids = {x for s in stories for x in (s.cover_asset_id, s.hero_asset_id) if x}
    assets = {a.id: a for a in session.scalars(select(MediaAsset).where(MediaAsset.id.in_(asset_ids))).all()} if asset_ids else {}
    pairs = session.execute(select(CollectionStory.story_id, Collection).join(Collection, Collection.id == CollectionStory.collection_id).where(CollectionStory.story_id.in_(ids), Collection.status == 'published').order_by(CollectionStory.display_order, Collection.id)).all()
    return [{**StoryOut.model_validate(s).model_dump(), 'cover_asset': assets.get(s.cover_asset_id), 'hero_asset': assets.get(s.hero_asset_id), 'collections': [c for sid, c in pairs if sid == s.id]} for s in stories]

def normalize(value: str) -> str:
    value = unicodedata.normalize('NFKD', value.lower())
    return re.sub(r'[^a-z0-9 ]+', ' ', ''.join(c for c in value if not unicodedata.combining(c)))

def matches_query(story: Story, query: str, categories: str = '') -> bool:
    words = normalize(story.title + ' ' + story.description + ' ' + story.synopsis + ' ' + categories).split()
    tokens = [w for w in normalize(query).split() if w not in {'de','da','do','dos','das','e','o','a','os','as','um','uma','em'}]
    def match(token: str, word: str) -> bool:
        if token in word: return True
        maximum = 0 if len(token) <= 3 else 1 if len(token) <= 6 else 2
        if abs(len(token)-len(word)) > maximum: return False
        # Damerau-Levenshtein: tolerates substitutions, omissions and transpositions.
        d = [[0] * (len(word)+1) for _ in range(len(token)+1)]
        for i in range(len(token)+1): d[i][0] = i
        for j in range(len(word)+1): d[0][j] = j
        for i in range(1,len(token)+1):
            for j in range(1,len(word)+1):
                d[i][j] = min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(token[i-1]!=word[j-1]))
                if i>1 and j>1 and token[i-1]==word[j-2] and token[i-2]==word[j-1]: d[i][j]=min(d[i][j],d[i-2][j-2]+1)
        return d[-1][-1] <= maximum
    return all(any(match(t,w) for w in words) for t in tokens)

@router.get("/collections", response_model=CollectionPage)
def list_collections(session: DB, limit: Limit = 20, offset: Offset = 0):
    items = session.scalars(select(Collection).where(Collection.status == "published").order_by(Collection.display_order, Collection.id).limit(limit).offset(offset)).all()
    items = [{**CollectionOut.model_validate(c).model_dump(), "cover_asset": session.get(MediaAsset, c.cover_asset_id) if c.cover_asset_id else None} for c in items]
    return {"items": items, "limit": limit, "offset": offset}

@router.get("/collections/{slug}", response_model=CollectionOut)
def collection_detail(slug: str, session: DB):
    item = session.scalar(select(Collection).where(Collection.slug == slug, Collection.status == "published"))
    if item is None:
        raise HTTPException(status_code=404, detail="Coleção não encontrada")
    data = CollectionOut.model_validate(item).model_dump()
    data["cover_asset"] = session.get(MediaAsset, item.cover_asset_id) if item.cover_asset_id else None
    return data

@router.get("/stories", response_model=StoryPage)
def list_stories(session: DB, limit: Limit = 20, offset: Offset = 0, collection: str | None = None, q: Annotated[str, Query(max_length=120)] = "", min_minutes: Annotated[int | None, Query(ge=0)] = None, max_minutes: Annotated[int | None, Query(ge=0)] = None):
    query = select(Story).where(Story.status == "published")
    if collection:
        query = query.join(CollectionStory, CollectionStory.story_id == Story.id).join(Collection, Collection.id == CollectionStory.collection_id).where(Collection.slug == collection, Collection.status == "published").order_by(CollectionStory.display_order, Story.id)
    else:
        query = query.order_by(Story.published_at.desc().nullslast(), Story.id)
    if min_minutes is not None: query = query.where(Story.estimated_reading_minutes >= min_minutes)
    if max_minutes is not None: query = query.where(Story.estimated_reading_minutes <= max_minutes)
    if q.strip():
        candidates = list(session.scalars(query).all())
        enriched = enrich_stories(session, candidates)
        matching = [data for item, data in zip(candidates, enriched) if matches_query(item, q, ' '.join(c.title for c in data['collections']))]
        return {"items": matching[offset:offset + limit], "limit": limit, "offset": offset}
    items = session.scalars(query.limit(limit).offset(offset)).all()
    return {"items": enrich_stories(session, list(items)), "limit": limit, "offset": offset}

@router.get("/stories/{slug}", response_model=StoryOut)
def story_detail(slug: str, session: DB):
    story = published_story(session, slug)
    data = StoryOut.model_validate(story).model_dump()
    data["cover_asset"] = session.get(MediaAsset, story.cover_asset_id) if story.cover_asset_id else None
    data["hero_asset"] = session.get(MediaAsset, story.hero_asset_id) if story.hero_asset_id else None
    data["collections"] = session.scalars(select(Collection).join(CollectionStory, CollectionStory.collection_id == Collection.id).where(CollectionStory.story_id == story.id, Collection.status == "published").order_by(CollectionStory.display_order, Collection.id)).all()
    return data

@router.get("/stories/{slug}/chapters", response_model=list[ChapterOut])
def story_chapters(slug: str, session: DB):
    story = published_story(session, slug)
    return session.scalars(select(Chapter).where(Chapter.story_id == story.id).order_by(Chapter.display_order, Chapter.id)).all()

@router.get("/stories/{slug}/reading", response_model=ReadingStory)
def story_reading(slug: str, session: DB):
    story = published_story(session, slug)
    chapters = session.scalars(select(Chapter).where(Chapter.story_id == story.id).order_by(Chapter.display_order, Chapter.id)).all()
    scenes = session.scalars(select(Scene).where(Scene.chapter_id.in_([c.id for c in chapters])).order_by(Scene.display_order, Scene.id)).all() if chapters else []
    scene_ids = [scene.id for scene in scenes]
    media = session.execute(select(SceneMedia, MediaAsset).join(MediaAsset, SceneMedia.media_asset_id == MediaAsset.id).where(SceneMedia.scene_id.in_(scene_ids)).order_by(SceneMedia.display_order, SceneMedia.id)).all() if scene_ids else []
    result = StoryOut.model_validate(story).model_dump()
    result["cover_asset"] = session.get(MediaAsset, story.cover_asset_id) if story.cover_asset_id else None
    result["hero_asset"] = session.get(MediaAsset, story.hero_asset_id) if story.hero_asset_id else None
    result["collections"] = session.scalars(select(Collection).join(CollectionStory, CollectionStory.collection_id == Collection.id).where(CollectionStory.story_id == story.id, Collection.status == "published").order_by(CollectionStory.display_order, Collection.id)).all()
    def scene_out(scene: Scene) -> SceneOut:
        content = SceneOut.model_validate(scene)
        content.media = [SceneMediaOut(role=link.role, display_order=link.display_order, configuration=link.configuration, asset=asset) for link, asset in media if link.scene_id == scene.id]
        return content
    result["chapters"] = [ChapterWithScenes(**ChapterOut.model_validate(chapter).model_dump(), scenes=[scene_out(scene) for scene in scenes if scene.chapter_id == chapter.id]) for chapter in chapters]
    return result
