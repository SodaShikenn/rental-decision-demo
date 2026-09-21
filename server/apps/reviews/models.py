from typing import Literal
from pydantic import BaseModel, Field


class ReviewSearch(BaseModel):
    name: str = Field(min_length=2, max_length=300)
    address: str = Field(min_length=5, max_length=300)


class ReviewRequest(ReviewSearch):
    placeId: str = Field(pattern=r"^[A-Za-z0-9_-]{5,256}$")
    confirmed: Literal[True]
