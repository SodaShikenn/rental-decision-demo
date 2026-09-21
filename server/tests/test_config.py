from config import load_settings


def test_root_variable_names_are_supported_as_aliases():
    settings = load_settings({"GOOGLE_API_KEY": "gemini-test", "GOOGLE_MAP_API": "maps-test"})
    assert settings.gemini_api_key == "gemini-test"
    assert settings.google_maps_api_key == "maps-test"


def test_canonical_key_names_take_precedence_over_aliases():
    settings = load_settings({"GEMINI_API_KEY": "primary", "GOOGLE_API_KEY": "fallback", "GOOGLE_MAPS_API_KEY": "primary-maps", "GOOGLE_MAP_API": "fallback-maps"})
    assert settings.gemini_api_key == "primary"
    assert settings.google_maps_api_key == "primary-maps"
