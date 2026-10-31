from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

class Layout(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    text_x: float = Field(default=0, ge=0, le=100)
    text_y: float = Field(default=0, ge=0, le=100)
    image_x: float = Field(default=50, ge=0, le=100)
    image_y: float = Field(default=50, ge=0, le=100)
    zoom: float = Field(default=1, ge=1, le=3)

class Layouts(BaseModel):
    model_config = ConfigDict(extra='forbid')
    portrait: Layout | None = None
    landscape: Layout | None = None
    tablet: Layout | None = None

class Composition(BaseModel):
    model_config = ConfigDict(extra='forbid')
    version: Literal[1] = 1
    revision: int = Field(default=0, ge=0)
    layouts: Layouts = Field(default_factory=Layouts)

class CompositionUpdate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    expected_revision: int = Field(ge=0)
    layouts: Layouts

    @model_validator(mode='after')
    def require_layout(self):
        if not self.layouts.model_dump(exclude_none=True):
            raise ValueError('Informe ao menos um formato de composição.')
        return self
