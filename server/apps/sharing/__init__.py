from fastapi import APIRouter, Depends, Request
from apps.listing import apply_rate_limit
from helper import AppError, json_response
from .models import ShareCreate, ShareRead, ShareRevoke
from .store import ShareStore

router = APIRouter(
    prefix="/api/shares", tags=["sharing"], dependencies=[Depends(apply_rate_limit)]
)


def store_for(request):
    settings = request.app.state.settings
    if not settings.sharing_enabled:
        raise AppError(
            503, "sharing_disabled", "リンク共有は無効です。ファイル出力を使えます。"
        )
    return ShareStore(settings.share_db_path)


@router.post("")
def create(body: ShareCreate, request: Request):
    return json_response(
        store_for(request).create(
            body.brief.model_dump(mode="json"), body.expiresInDays
        ),
        201,
    )


# POST keeps bearer tokens out of URL/access logs, browser caches and referrer strings.
@router.post("/read")
def read(body: ShareRead, request: Request):
    return json_response(store_for(request).read(body.token))


@router.post("/revoke")
def revoke(body: ShareRevoke, request: Request):
    store_for(request).revoke(body.token, body.deleteSecret)
    return json_response({"revoked": True})
