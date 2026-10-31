from __future__ import annotations
import uuid
from datetime import datetime
from typing import Any
from sqlalchemy import BigInteger, CheckConstraint, DateTime, ForeignKey, ForeignKeyConstraint, Index, Integer, Numeric, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB, UUID
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column

class Base(DeclarativeBase):
    pass

class Timestamped:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class MediaAsset(Timestamped, Base):
    __tablename__ = "media_assets"
    __table_args__ = (CheckConstraint("media_type IN ('image','video','audio','animation')", name="ck_media_type"), CheckConstraint("file_size IS NULL OR file_size >= 0", name="ck_media_size"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    storage_provider: Mapped[str] = mapped_column(String(50))
    storage_bucket: Mapped[str] = mapped_column(String(255))
    storage_path: Mapped[str] = mapped_column(Text)
    media_type: Mapped[str] = mapped_column(String(20))
    mime_type: Mapped[str] = mapped_column(String(100))
    file_size: Mapped[int | None] = mapped_column(BigInteger)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    duration_seconds: Mapped[int | None] = mapped_column(Integer)
    asset_metadata: Mapped[dict[str, Any]] = mapped_column("metadata", JSONB, server_default="{}", default=dict)

class Collection(Timestamped, Base):
    __tablename__ = "collections"
    __table_args__ = (CheckConstraint("status IN ('draft','published','archived')", name="ck_collection_status"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    cover_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id"))
    decorative_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id"))
    display_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft", index=True)

class Story(Timestamped, Base):
    __tablename__ = "stories"
    __table_args__ = (CheckConstraint("status IN ('draft','published','archived')", name="ck_story_status"), CheckConstraint("minimum_age IS NULL OR minimum_age >= 0", name="ck_story_min_age"), CheckConstraint("maximum_age IS NULL OR maximum_age >= COALESCE(minimum_age, 0)", name="ck_story_age_range"), CheckConstraint("estimated_reading_minutes IS NULL OR estimated_reading_minutes > 0", name="ck_story_minutes"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    slug: Mapped[str] = mapped_column(String(180), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(255))
    subtitle: Mapped[str | None] = mapped_column(String(255))
    synopsis: Mapped[str] = mapped_column(Text, default="", server_default="")
    description: Mapped[str] = mapped_column(Text, default="", server_default="")
    cover_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id"))
    hero_asset_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("media_assets.id"))
    minimum_age: Mapped[int | None] = mapped_column(Integer)
    maximum_age: Mapped[int | None] = mapped_column(Integer)
    estimated_reading_minutes: Mapped[int | None] = mapped_column(Integer)
    language: Mapped[str] = mapped_column(String(20), default="pt-BR", server_default="pt-BR")
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft", index=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class CollectionStory(Base):
    __tablename__ = "collection_stories"
    collection_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("collections.id", ondelete="CASCADE"), primary_key=True)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"), primary_key=True)
    display_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")

class Chapter(Timestamped, Base):
    __tablename__ = "chapters"
    __table_args__ = (UniqueConstraint("story_id", "display_order", name="uq_chapter_order"), UniqueConstraint("story_id", "id", name="uq_chapter_story_id"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"), index=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text)
    display_order: Mapped[int] = mapped_column(Integer)

class Scene(Timestamped, Base):
    __tablename__ = "scenes"
    __table_args__ = (UniqueConstraint("chapter_id", "display_order", name="uq_scene_order"), UniqueConstraint("chapter_id", "id", name="uq_scene_chapter_id"), CheckConstraint("estimated_duration_seconds IS NULL OR estimated_duration_seconds > 0", name="ck_scene_duration"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    chapter_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("chapters.id", ondelete="CASCADE"), index=True)
    display_order: Mapped[int] = mapped_column(Integer)
    title: Mapped[str | None] = mapped_column(String(255))
    narrative_text: Mapped[str] = mapped_column(Text)
    estimated_duration_seconds: Mapped[int | None] = mapped_column(Integer)
    text_position: Mapped[str | None] = mapped_column(String(30))
    text_animation: Mapped[str | None] = mapped_column(String(30))
    transition_type: Mapped[str | None] = mapped_column(String(30))
    presentation_config: Mapped[dict[str, Any]] = mapped_column(JSONB, server_default="{}", default=dict)

class SceneMedia(Base):
    __tablename__ = "scene_media"
    __table_args__ = (CheckConstraint("role IN ('background','illustration','animation','narration','ambient_music','sound_effect')", name="ck_scene_media_role"), UniqueConstraint("scene_id", "role", "display_order", name="uq_scene_media_order"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    scene_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("scenes.id", ondelete="CASCADE"), index=True)
    media_asset_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("media_assets.id"))
    role: Mapped[str] = mapped_column(String(30))
    display_order: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    configuration: Mapped[dict[str, Any]] = mapped_column(JSONB, default=dict, server_default="{}")

class User(Timestamped, Base):
    __tablename__ = "users"
    __table_args__ = (CheckConstraint("role IN ('reader', 'admin')", name="ck_users_role"),)
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # Apenas identificador do provedor futuro; sem senha ou cadastro público nesta etapa.
    auth_provider_subject: Mapped[str | None] = mapped_column(String(255), unique=True)
    role: Mapped[str] = mapped_column(String(20), default="reader", server_default="reader")

class ReadingProfile(Timestamped, Base):
    __tablename__ = "reading_profiles"
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    display_name: Mapped[str] = mapped_column(String(80))

class ReadingProgress(Timestamped, Base):
    __tablename__ = "reading_progress"
    __table_args__ = (UniqueConstraint("reading_profile_id", "story_id", name="uq_progress_profile_story"), ForeignKeyConstraint(["story_id", "chapter_id"], ["chapters.story_id", "chapters.id"], name="fk_progress_story_chapter"), ForeignKeyConstraint(["chapter_id", "scene_id"], ["scenes.chapter_id", "scenes.id"], name="fk_progress_chapter_scene"), CheckConstraint("completion_percentage >= 0 AND completion_percentage <= 100", name="ck_progress_percentage"), CheckConstraint("scene_id IS NULL OR chapter_id IS NOT NULL", name="ck_progress_scene_chapter"))
    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    reading_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reading_profiles.id", ondelete="CASCADE"))
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"))
    chapter_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    scene_id: Mapped[uuid.UUID | None] = mapped_column(UUID(as_uuid=True))
    completion_percentage: Mapped[float] = mapped_column(Numeric(5, 2), default=0, server_default="0")
    completed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))

class Favorite(Base):
    __tablename__ = "favorites"
    reading_profile_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reading_profiles.id", ondelete="CASCADE"), primary_key=True)
    story_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("stories.id", ondelete="CASCADE"), primary_key=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

Index("ix_collection_stories_story_id", CollectionStory.story_id)
