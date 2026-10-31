from datetime import datetime
from typing import Any, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from app.api.v1.schemas import MediaOut

StoryStatus = Literal['draft', 'published', 'archived']


class AdminStoryInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    slug: str = Field(min_length=1, max_length=180)
    subtitle: str | None = Field(default=None, max_length=255)
    synopsis: str = ''
    description: str = ''
    cover_asset_id: UUID | None = None
    hero_asset_id: UUID | None = None
    minimum_age: int | None = Field(default=None, ge=0)
    maximum_age: int | None = Field(default=None, ge=0)
    estimated_reading_minutes: int | None = Field(default=None, gt=0)
    language: str = Field(default='pt-BR', min_length=2, max_length=20)
    status: StoryStatus = 'draft'
    published_at: datetime | None = None

    @field_validator('slug')
    @classmethod
    def valid_slug(cls, value: str) -> str:
        import re
        value = value.strip()
        if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', value):
            raise ValueError('Use apenas letras minúsculas, números e hífens no slug.')
        return value

    @field_validator('title', 'language')
    @classmethod
    def non_blank(cls, value: str) -> str:
        value = value.strip()
        if not value:
            raise ValueError('Este campo não pode ficar vazio.')
        return value

    @field_validator('maximum_age')
    @classmethod
    def valid_age_range(cls, value: int | None, info):
        minimum = info.data.get('minimum_age')
        if value is not None and minimum is not None and value < minimum:
            raise ValueError('A idade máxima não pode ser menor que a idade mínima.')
        return value


class AdminStoryCreate(AdminStoryInput):
    pass


class AdminStoryDelete(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)
    confirm: Literal[True]
    confirmation_slug: str = Field(min_length=1, max_length=180)

    @field_validator('confirm', mode='before')
    @classmethod
    def explicit_confirmation(cls, value):
        if value is not True:
            raise ValueError('Confirme explicitamente a exclusão.')
        return value


class AdminStoryUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    slug: str | None = Field(default=None, min_length=1, max_length=180)
    subtitle: str | None = Field(default=None, max_length=255)
    synopsis: str | None = None
    description: str | None = None
    cover_asset_id: UUID | None = None
    hero_asset_id: UUID | None = None
    minimum_age: int | None = Field(default=None, ge=0)
    maximum_age: int | None = Field(default=None, ge=0)
    estimated_reading_minutes: int | None = Field(default=None, gt=0)
    language: str | None = Field(default=None, min_length=2, max_length=20)
    status: StoryStatus | None = None
    published_at: datetime | None = None

    @field_validator('slug')
    @classmethod
    def valid_optional_slug(cls, value: str | None) -> str | None:
        return AdminStoryInput.valid_slug(value) if value is not None else value


class AdminStoryOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

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
    status: StoryStatus
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime
    cover_asset: MediaOut | None = None
    collections: list[str] = []
    chapter_count: int = 0


class AdminStoryPage(BaseModel):
    items: list[AdminStoryOut]
    limit: int
    offset: int


class AdminChapterInput(BaseModel):
    title: str = Field(min_length=1, max_length=255)
    description: str | None = None


class AdminChapterCreate(AdminChapterInput):
    display_order: int | None = Field(default=None, ge=0)


class AdminChapterUpdate(AdminChapterInput):
    title: str | None = Field(default=None, min_length=1, max_length=255)
    description: str | None = None


class AdminChapterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    story_id: UUID
    title: str
    description: str | None
    display_order: int
    scene_count: int = 0


class AdminSceneInput(BaseModel):
    narrative_text: str = Field(min_length=1)
    title: str | None = Field(default=None, max_length=255)
    estimated_duration_seconds: int | None = Field(default=None, gt=0)
    text_position: str | None = Field(default=None, max_length=30)
    text_animation: str | None = Field(default=None, max_length=30)
    transition_type: str | None = Field(default=None, max_length=30)
    presentation_config: dict[str, Any] = Field(default_factory=dict)

    @field_validator('presentation_config')
    @classmethod
    def validate_composition(cls, value):
        if 'composition' in value:
            from app.modules.stories.composition import Composition
            value = {**value, 'composition': Composition.model_validate(value['composition']).model_dump(exclude_none=True)}
        return value


class AdminSceneCreate(AdminSceneInput):
    display_order: int | None = Field(default=None, ge=0)


class AdminSceneUpdate(BaseModel):
    narrative_text: str | None = Field(default=None, min_length=1)
    title: str | None = Field(default=None, max_length=255)
    estimated_duration_seconds: int | None = Field(default=None, gt=0)
    text_position: str | None = Field(default=None, max_length=30)
    text_animation: str | None = Field(default=None, max_length=30)
    transition_type: str | None = Field(default=None, max_length=30)
    presentation_config: dict[str, Any] | None = None


class AdminSceneMediaOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: UUID
    scene_id: UUID
    media_asset_id: UUID
    role: str
    display_order: int
    configuration: dict[str, Any]
    asset: MediaOut


class AdminSceneOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
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
    media: list[AdminSceneMediaOut] = []


class OrderUpdate(BaseModel):
    ids: list[UUID] = Field(min_length=1)


class SceneMediaCreate(BaseModel):
    media_asset_id: UUID
    role: Literal['background', 'illustration', 'narration', 'ambient_music', 'sound_effect']
    display_order: int = Field(default=0, ge=0)
    configuration: dict[str, Any] = Field(default_factory=dict)


class AdminMediaSummary(MediaOut):
    story_count: int = 0


class AdminMediaPage(BaseModel):
    items: list[AdminMediaSummary]
    limit: int
    offset: int


class AdminMediaUpdate(BaseModel):
    title: str | None = Field(default=None, max_length=255)
    description: str | None = Field(default=None, max_length=2000)


class MediaUsage(BaseModel):
    kind: Literal['scene', 'story_cover', 'story_hero', 'collection']
    story_id: UUID | None = None
    story_title: str | None = None
    chapter_id: UUID | None = None
    scene_id: UUID | None = None
    role: str | None = None


class AdminMediaDetail(MediaOut):
    usage: list[MediaUsage] = []
