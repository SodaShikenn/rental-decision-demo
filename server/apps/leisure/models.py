from typing import Literal
from pydantic import BaseModel, Field, model_validator


class LeisureCandidate(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=300)
    address: str = Field(default="", max_length=300)


class LeisureRequest(BaseModel):
    candidates: list[LeisureCandidate] = Field(min_length=1, max_length=6)
    categories: list[Literal["park", "gym", "cafe"]] = Field(
        default_factory=lambda: ["park", "gym", "cafe"], min_length=1, max_length=3
    )
    destinationId: str | None = Field(default=None, pattern=r"^[A-Za-z0-9_-]{5,256}$")

    @model_validator(mode="after")
    def unique(self):
        if len({c.id for c in self.candidates}) != len(self.candidates) or len(
            set(self.categories)
        ) != len(self.categories):
            raise ValueError("Duplicate candidates or categories")
        return self
