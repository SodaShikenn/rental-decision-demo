from typing import Literal
from pydantic import BaseModel, Field


class Claim(BaseModel):
    name: str = Field(min_length=1, max_length=150)
    kind: Literal['station', 'supermarket', 'convenience_store'] = 'station'
    minutes: int | None = Field(default=None, ge=0, le=240)
    meters: int | None = Field(default=None, ge=0, le=20000)


class MapsRequest(BaseModel):
    address: str = Field(min_length=5, max_length=300)
    claims: list[Claim] = Field(default_factory=list, max_length=8)
