"""Shared Gemini transport errors and completion validation."""

import httpx
from google.genai import errors, types
from helper import AppError


def _key_rejected(error: errors.APIError) -> bool:
    # Google answers an invalid key with HTTP 400 and reason API_KEY_INVALID rather than 401.
    return error.code in (401, 403) or (
        error.code == 400 and "API_KEY_INVALID" in str(error.details)
    )


def to_app_error(error: errors.APIError) -> AppError:
    if error.code == 429:
        details = error.details if isinstance(error.details, dict) else {}
        body = details.get("error", details)
        entries = body.get("details", []) if isinstance(body, dict) else []
        daily_limit = any(
            "perday" in str(violation.get("quotaId", "")).lower()
            for entry in entries
            if isinstance(entry, dict)
            for violation in entry.get("violations", [])
            if isinstance(violation, dict)
        )
        if daily_limit:
            return AppError(
                503,
                "upstream_daily_quota",
                "本日のAI利用上限に達しました。利用枠が回復するまで、AI分析・オンライン調査は利用できません。比較・通勤リンク・メモは引き続き使えます。",
            )
        return AppError(
            503,
            "upstream_busy",
            "解析サービスが混み合っています。少し待ってから再試行してください。",
        )
    if _key_rejected(error):
        return AppError(
            503, "not_configured", "Gemini API キーの設定に問題があります。"
        )
    if error.code == 503:
        return AppError(
            503,
            "upstream_busy",
            "AIサービスが混み合っています。時間をおいて再試行してください。",
        )
    if error.code == 504:
        return AppError(
            504,
            "upstream_timeout",
            "解析がタイムアウトしました。もう一度お試しください。",
        )
    return AppError(502, "upstream_error", "解析サービスでエラーが発生しました。")


def checked_response(response):
    candidate = response.candidates[0] if response.candidates else None
    if (
        not candidate
        or str(candidate.finish_reason).split(".")[-1] != "STOP"
        or (
            getattr(response, "prompt_feedback", None)
            and response.prompt_feedback.block_reason
        )
    ):
        raise AppError(
            502,
            "incomplete_research",
            "調査結果を確認できませんでした。時間をおいて再試行してください。",
        )
    return response


async def generate(app, **kwargs):
    config = kwargs.get("config")
    if config is not None and config.thinking_config is None:
        # Research must respect the same configured thinking budget as advice/OCR.
        kwargs["config"] = config.model_copy(
            update={
                "thinking_config": types.ThinkingConfig(
                    thinking_level=app.state.settings.gemini_thinking_level
                )
            }
        )
    try:
        response = await app.state.gemini().aio.models.generate_content(
            model=app.state.settings.gemini_model, **kwargs
        )
        return checked_response(response)
    except errors.APIError as error:
        raise to_app_error(error) from error
    except httpx.TimeoutException as error:
        raise AppError(
            504,
            "research_timeout",
            "オンライン調査がタイムアウトしました。再試行してください。",
        ) from error
    except httpx.HTTPError as error:
        raise AppError(
            502, "research_unavailable", "検索サービスに接続できませんでした。"
        ) from error
