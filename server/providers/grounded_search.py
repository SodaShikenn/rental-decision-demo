"""Provider citation metadata, never URLs invented by the mapping model."""

from .web_urls import public_url


def cited_evidence(response, *, allow_url_context=True):
    """Keep only text with provider citation metadata, never model-invented URLs."""
    candidate = response.candidates[0]
    metadata = getattr(candidate, "grounding_metadata", None)
    chunks = getattr(metadata, "grounding_chunks", None) or []
    evidence = []
    for support in getattr(metadata, "grounding_supports", None) or []:
        segment = getattr(support, "segment", None)
        text = getattr(segment, "text", None)
        if not text:
            continue
        for index in support.grounding_chunk_indices or []:
            if index < 0 or index >= len(chunks):
                continue
            web = getattr(chunks[index], "web", None)
            if not web:
                continue
            try:
                url = public_url(web.uri)
            except (ValueError, TypeError):
                continue
            evidence.append(
                {"text": text[:3500], "url": url, "title": (web.title or url)[:300]}
            )
    # URL context does not always include search grounding spans. With exactly one
    # successfully read URL, the requested-page report can be attributed to it.
    if not evidence and allow_url_context:
        context = getattr(candidate, "url_context_metadata", None)
        successful = [
            item.retrieved_url
            for item in getattr(context, "url_metadata", None) or []
            if str(item.url_retrieval_status).endswith("SUCCESS")
        ]
        if len(successful) == 1:
            try:
                url = public_url(successful[0])
                evidence.append(
                    {"text": (response.text or "")[:16000], "url": url, "title": url}
                )
            except (ValueError, TypeError):
                pass
    return evidence[:40]
