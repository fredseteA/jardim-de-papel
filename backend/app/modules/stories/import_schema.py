"""Versioned editorial interchange contract; pages map to existing Scene rows."""
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

from app.api.v1.admin_schemas import AdminStoryInput

MAX_IMPORT_BYTES = 2 * 1024 * 1024
NonBlank = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1)]
Title = Annotated[NonBlank, Field(max_length=255)]
Notes = Annotated[str, Field(max_length=20_000)]
Slug = Annotated[NonBlank, Field(max_length=180, pattern=r'^[a-z0-9]+(?:-[a-z0-9]+)*$')]


class ImportModel(BaseModel):
    model_config = ConfigDict(extra='forbid', strict=True)


class LiteraryMetadata(ImportModel):
    author: Notes | None = None
    literary_origin: Notes | None = None
    reference_work: Notes | None = None
    reference_version: Notes | None = None
    editorial_notes: Notes | None = None
    copyright_notes: Notes | None = None


class ImportStory(ImportModel):
    title: Title
    slug: Slug
    collection_slug: Slug
    synopsis: Notes = ''
    description: Notes = ''
    minimum_age: int | None = Field(default=None, ge=0)
    maximum_age: int | None = Field(default=None, ge=0)
    language: Annotated[NonBlank, Field(min_length=2, max_length=20)] = 'pt-BR'
    estimated_narration_seconds: int | None = Field(default=None, gt=0, le=86400)
    editorial: LiteraryMetadata = Field(default_factory=LiteraryMetadata)

    @field_validator('slug', 'collection_slug')
    @classmethod
    def slug_format(cls, value: str) -> str:
        return AdminStoryInput.valid_slug(value)

    @model_validator(mode='after')
    def age_range(self):
        if self.minimum_age is not None and self.maximum_age is not None and self.maximum_age < self.minimum_age:
            raise ValueError('A idade máxima não pode ser menor que a mínima.')
        return self


class ImportPage(ImportModel):
    order: int = Field(ge=1)
    title: Title | None = None
    text: Annotated[NonBlank, Field(max_length=20_000)]
    illustration_description: Notes | None = None
    estimated_narration_seconds: int | None = Field(default=None, gt=0, le=86400)


class ImportChapter(ImportModel):
    order: int = Field(ge=1)
    title: Title
    pages: list[ImportPage] = Field(min_length=1, max_length=500)

    @model_validator(mode='after')
    def page_order(self):
        if [page.order for page in self.pages] != list(range(1, len(self.pages) + 1)):
            raise ValueError('pages: a ordem deve ser consecutiva, começando em 1, sem lacunas ou repetições.')
        return self


class StoryImport(ImportModel):
    schema_version: Literal[1]
    story: ImportStory
    chapters: list[ImportChapter] = Field(min_length=1, max_length=100)

    @field_validator('schema_version', mode='before')
    @classmethod
    def integer_version(cls, value):
        if type(value) is not int:
            raise ValueError('schema_version deve ser o número inteiro 1.')
        return value

    @model_validator(mode='after')
    def chapter_order(self):
        if [chapter.order for chapter in self.chapters] != list(range(1, len(self.chapters) + 1)):
            raise ValueError('chapters: a ordem deve ser consecutiva, começando em 1, sem lacunas ou repetições.')
        if sum(len(chapter.pages) for chapter in self.chapters) > 500:
            raise ValueError('Uma importação pode conter no máximo 500 páginas.')
        return self


class ImportPreview(BaseModel):
    document: StoryImport
    collection_title: str
    chapter_count: int
    page_count: int
    estimated_narration_seconds: int | None
    warnings: list[str]
