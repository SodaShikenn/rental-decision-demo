from typing import Literal
from pydantic import BaseModel, Field, model_validator


class Evidence(BaseModel):
    id: str = Field(min_length=1, max_length=80)
    candidate: str = Field(min_length=1, max_length=200)
    kind: Literal['listing', 'maps', 'unknown']
    text: str = Field(min_length=1, max_length=1500)


class Turn(BaseModel):
    role: Literal['user', 'assistant']
    text: str = Field(min_length=1, max_length=4000)


class AdvisorRequest(BaseModel):
    focus: Literal['cost', 'space', 'access', 'living', 'all'] = 'all'
    evidence: list[Evidence] = Field(min_length=1, max_length=80)
    confirmed: str = Field(default='', max_length=6000)
    history: list[Turn] = Field(default_factory=list, max_length=24)

    @model_validator(mode='after')
    def unique_ids(self):
        if len({item.id for item in self.evidence}) != len(self.evidence):
            raise ValueError('Evidence IDs must be unique')
        return self


class Insight(BaseModel):
    text: str = Field(min_length=1, max_length=600)
    evidenceIds: list[str] = Field(min_length=1, max_length=8)


class Proposal(BaseModel):
    text: str = Field(min_length=1, max_length=300)
    userQuote: str = Field(min_length=1, max_length=300)
    key: Literal['budget', 'walk', 'area', 'note']
    value: float | None = Field(default=None, ge=0, le=10000000)
    level: Literal['must', 'prefer', 'later']


class AdvisorReply(BaseModel):
    insights: list[Insight] = Field(min_length=1, max_length=3)
    question: str = Field(min_length=1, max_length=500)
    evidenceIds: list[str] = Field(min_length=1, max_length=8)
    options: list[str] = Field(min_length=2, max_length=3)
    proposals: list[Proposal] = Field(default_factory=list, max_length=2)
