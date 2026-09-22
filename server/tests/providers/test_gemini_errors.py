from google.genai import errors
from providers.gemini import to_app_error


def test_research_uses_configured_thinking_without_mutating_callers(settings_for):
    import asyncio
    from types import SimpleNamespace
    from google.genai import types
    from conftest import StubGemini, gemini_reply
    from providers.gemini import generate

    client = StubGemini(gemini_reply())
    app = SimpleNamespace(
        state=SimpleNamespace(
            settings=settings_for(GEMINI_THINKING_LEVEL="low"), gemini=lambda: client
        )
    )
    config = types.GenerateContentConfig(max_output_tokens=5000)
    asyncio.run(generate(app, contents="test", config=config))
    assert (
        client.calls[0]["config"].thinking_config.thinking_level
        == types.ThinkingLevel.LOW
    )
    assert config.thinking_config is None
    explicit = types.GenerateContentConfig(
        thinking_config=types.ThinkingConfig(thinking_level="medium")
    )
    asyncio.run(generate(app, contents="test", config=explicit))
    assert (
        client.calls[1]["config"].thinking_config.thinking_level
        == types.ThinkingLevel.MEDIUM
    )


def test_daily_quota_is_not_presented_as_temporary_overload():
    error = errors.ClientError(
        429,
        {
            "error": {
                "message": "private provider details must not reach the browser",
                "details": [
                    {
                        "@type": "type.googleapis.com/google.rpc.QuotaFailure",
                        "violations": [
                            {
                                "quotaId": "GenerateRequestsPerDayPerProjectPerModel-FreeTier",
                                "quotaValue": "20",
                            }
                        ],
                    },
                    {
                        "@type": "type.googleapis.com/google.rpc.RetryInfo",
                        "retryDelay": "21s",
                    },
                ],
            }
        },
    )
    result = to_app_error(error)
    assert result.code == "upstream_daily_quota"
    assert "本日のAI利用上限" in result.message
    assert "private" not in result.message
    # A short generic retry delay does not make a daily quota recover in 21 seconds.
    assert "Retry-After" not in result.headers


def test_minute_quota_and_overload_keep_retryable_messages():
    quota = errors.ClientError(
        429,
        {
            "error": {
                "details": [
                    {
                        "violations": [
                            {
                                "quotaId": "GenerateRequestsPerMinutePerProjectPerModel-FreeTier"
                            }
                        ]
                    }
                ]
            }
        },
    )
    assert to_app_error(quota).code == "upstream_busy"
    assert (
        to_app_error(errors.ServerError(503, {"error": {"message": "busy"}})).code
        == "upstream_busy"
    )


def test_client_retries_only_transient_server_errors(settings_for, monkeypatch):
    from fastapi import FastAPI
    from extensions import ext_gemini

    options = {}
    monkeypatch.setattr(
        ext_gemini.genai, "Client", lambda **kwargs: options.update(kwargs) or object()
    )
    app = FastAPI()
    app.state.settings = settings_for(GEMINI_API_KEY="test")
    ext_gemini.init_app(app)
    app.state.gemini()
    assert 429 not in options["http_options"].retry_options.http_status_codes
    assert 503 in options["http_options"].retry_options.http_status_codes
