"""Source-linked listing research with explicit identity and eligibility metadata."""
import ipaddress
from typing import Literal
from urllib.parse import urlsplit, urlunsplit

from pydantic import BaseModel, Field, field_validator, model_validator

from apps.listing.models import FieldKey


def public_url(value: str) -> str:
    parts = urlsplit(value.strip())
    host = parts.hostname or ""
    if parts.scheme != "https" or not host or parts.username or parts.password or parts.port not in (None, 443):
        raise ValueError("Use a public HTTPS listing URL")
    if "." not in host or host.endswith((".local", ".localhost", ".internal", ".test")):
        raise ValueError("Private URLs are not supported")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None:
        raise ValueError("IP address URLs are not supported")
    return urlunsplit(("https", parts.netloc.lower(), parts.path or "/", parts.query, ""))


class ResearchRequest(BaseModel):
    url: str | None = Field(default=None, max_length=2048)
    name: str = Field(default="", max_length=300)
    address: str = Field(default="", max_length=300)
    room: str = Field(default="", max_length=30)
    layout: str = Field(default="", max_length=100)
    areaSqm: float | None = Field(default=None, gt=0, le=10000)
    missing: list[FieldKey] = Field(default_factory=list, max_length=8)

    @field_validator("url")
    @classmethod
    def validate_url(cls, value):
        return public_url(value) if value else None

    @model_validator(mode="after")
    def require_identity(self):
        if not self.url and not self.name.strip():
            raise ValueError("A URL or property name is required")
        return self


class FoundFact(BaseModel):
    key: FieldKey
    value: str | float
    evidenceIndex: int = Field(ge=0)


class FoundListing(BaseModel):
    name: str = Field(max_length=300)
    address: str = Field(max_length=300)
    room: str = Field(max_length=30)
    scope: Literal["building", "unit", "unknown"]
    # A current listing date must come from the source; retrieval time is separate.
    listingDate: str = Field(max_length=100)
    status: Literal["current", "historical", "unknown"]
    facts: list[FoundFact] = Field(max_length=8)


class ResearchMapping(BaseModel):
    listings: list[FoundListing] = Field(max_length=6)
