from datetime import datetime, timedelta, timezone
from typing import Literal
from pydantic import BaseModel, Field, AwareDatetime, model_validator


class Candidate(BaseModel):
    id: str = Field(min_length=1, max_length=100)
    name: str = Field(min_length=1, max_length=300)
    address: str = Field(default="", max_length=300)


class DestinationQuery(BaseModel):
    query: str = Field(min_length=2, max_length=300)


class CommuteRequest(BaseModel):
    candidates: list[Candidate] = Field(min_length=1, max_length=6)
    destinationId: str = Field(pattern=r"^[A-Za-z0-9_-]{5,256}$")
    at: AwareDatetime
    returnAt: AwareDatetime | None = None
    timeKind: Literal["arrival", "departure"] = "arrival"
    timezone: Literal["Asia/Tokyo"] = "Asia/Tokyo"
    mode: Literal["TRANSIT", "WALK"] = "TRANSIT"
    daysPerWeek: int = Field(default=3, ge=0, le=7)
    objective: Literal["fastest", "transfers", "walking"] = "fastest"

    @model_validator(mode="after")
    def comparable(self):
        now = datetime.now(timezone.utc)
        if not now - timedelta(days=7) <= self.at <= now + timedelta(days=100):
            raise ValueError("Schedule outside provider window")
        if self.returnAt is not None:
            if not self.at < self.returnAt <= now + timedelta(days=100):
                raise ValueError(
                    "Return must follow outbound and be inside provider window"
                )
        if len({c.id for c in self.candidates}) != len(self.candidates):
            raise ValueError("Duplicate candidate IDs")
        return self
