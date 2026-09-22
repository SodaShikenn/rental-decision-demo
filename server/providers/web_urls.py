"""Public HTTPS source validation; retrieval is delegated to provider tools."""

import ipaddress
from urllib.parse import urlsplit, urlunsplit


def public_url(value: str) -> str:
    parts = urlsplit(value.strip())
    host = parts.hostname or ""
    if (
        parts.scheme != "https"
        or not host
        or parts.username
        or parts.password
        or parts.port not in (None, 443)
    ):
        raise ValueError("Use a public HTTPS listing URL")
    if "." not in host or host.endswith((".local", ".localhost", ".internal", ".test")):
        raise ValueError("Private URLs are not supported")
    try:
        address = ipaddress.ip_address(host)
    except ValueError:
        address = None
    if address is not None:
        raise ValueError("IP address URLs are not supported")
    return urlunsplit(
        ("https", parts.netloc.lower(), parts.path or "/", parts.query, "")
    )
