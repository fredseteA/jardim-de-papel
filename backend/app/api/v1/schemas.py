from datetime import datetime
from typing import Any
from uuid import UUID
from pydantic import BaseModel, ConfigDict

class ORMModel(BaseModel):
    model_config = ConfigDict(from_attributes=True)

class MediaOut(ORMModel):
    id: UUID
    storage_provider: str
    storage_bucket: str
    storage_path: str
    media_type: str
    mime_type: str
    file_size: int | None
    width: int | None
    height: int | None
    duration_seconds: int | None
    asset_metadata: dict[str, Any]
    resolved_url: str | None = None

class CollectionOut(ORMModel):
    id: UUID
    slug: str
    title: str
    description: str
    cover_asset_id: UUID | None
    decorative_asset_id: UUID | None
    display_order: int
    cover_asset: MediaOut | None = None

class StoryOut(ORMModel):
    id: UUID
    slug: str
    title: str
    subtitle: str | None
    synopsis: str
    description: str
    cover_asset_id: UUID | None
    hero_asset_id: UUID | None
    minimum_age: int | None
    maximum_age: int | None
    estimated_reading_minutes: int | None
    language: str
    published_at: datetime | None
    cover_asset: MediaOut | None = None
    hero_asset: MediaOut | None = None
    collections: list[CollectionOut] = []

class SceneMediaOut(ORMModel):
    role: str
    display_order: int
    configuration: dict[str, Any]
    asset: MediaOut

class SceneOut(ORMModel):
    id: UUID
    chapter_id: UUID
    display_order: int
    title: str | None
    narrative_text: str
    estimated_duration_seconds: int | None
    text_position: str | None
    text_animation: str | None
    transition_type: str | None
    presentation_config: dict[str, Any]
    media: list[SceneMediaOut] = []

class ChapterOut(ORMModel):
    id: UUID
    story_id: UUID
    title: str
    description: str | None
    display_order: int

class CollectionPage(BaseModel):
    items: list[CollectionOut]
    limit: int
    offset: int

class StoryPage(BaseModel):
    items: list[StoryOut]
    limit: int
    offset: int

class ChapterWithScenes(ChapterOut):
    scenes: list[SceneOut]

class ReadingStory(StoryOut):
    chapters: list[ChapterWithScenes]
