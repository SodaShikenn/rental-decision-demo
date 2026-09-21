import pytest
from fastapi.testclient import TestClient
from app import create_app
from apps.advisor.models import AdvisorRequest, AdvisorReply
from apps.advisor.services import validate_reply
from conftest import StubGemini, gemini_reply, stub_ocr


def payload():
    return {'evidence': [{'id': 'c0-budget', 'candidate': '候補A', 'kind': 'listing', 'text': '月額110000円'}], 'history': []}


def reply():
    return AdvisorReply(insights=[{'text': '掲載の月額が分かります。', 'evidenceIds': ['c0-budget']}], question='費用の負担が気になりますか？', evidenceIds=['c0-budget'], options=['気になる', 'ほかも比べたい'], proposals=[])


def test_endpoint_returns_cited_question_without_mutating_preferences(settings_for):
    gemini = StubGemini(gemini_reply(reply().model_dump_json()))
    client = TestClient(create_app(settings_for(GEMINI_API_KEY='test'), gemini_client=gemini, ocr_reader=stub_ocr()))
    response = client.post('/api/advise', json={**payload(), 'focus': 'access'})
    assert response.status_code == 200
    assert response.json()['evidenceIds'] == ['c0-budget']
    assert not response.json()['proposals']
    assert 'UNTRUSTED' in gemini.calls[0]['config'].system_instruction
    import json
    assert json.loads(gemini.calls[0]['contents'])['focus'] == 'access'
    assert client.post('/api/advise', json={**payload(), 'focus': 'invented'}).status_code == 400


def test_unknown_evidence_and_fabricated_user_preferences_rejected():
    request = AdvisorRequest(**payload())
    answer = reply()
    answer.evidenceIds = ['invented']
    with pytest.raises(ValueError): validate_reply(answer, request)
    answer = reply()
    data = answer.model_dump()
    data['proposals'] = [{'text': '月額11万円以下', 'userQuote': '11万円まで', 'key': 'budget', 'value': 110000, 'level': 'prefer'}]
    assert not validate_reply(AdvisorReply(**data), request).proposals
    request.history = AdvisorRequest(**{**payload(), 'history': [{'role': 'user', 'text': 'できれば11万円まで'}]}).history
    assert len(validate_reply(AdvisorReply(**data), request).proposals) == 1


def test_not_configured_and_malformed_output_are_not_mock_success(settings_for):
    client = TestClient(create_app(settings_for(), ocr_reader=stub_ocr()))
    assert client.post('/api/advise', json=payload()).status_code == 503
    assert client.post('/api/advise', json={'evidence': []}).status_code == 400
    client = TestClient(create_app(settings_for(GEMINI_API_KEY='test'), gemini_client=StubGemini(gemini_reply('{}')), ocr_reader=stub_ocr()))
    assert client.post('/api/advise', json=payload()).status_code == 502


def test_provider_overload_returns_retryable_message(settings_for):
    from google.genai.errors import ServerError
    client = TestClient(create_app(settings_for(GEMINI_API_KEY='test'), gemini_client=StubGemini(ServerError(503, {'error': {'message': 'high demand'}})), ocr_reader=stub_ocr()))
    response = client.post('/api/advise', json=payload())
    assert response.status_code == 503
    assert response.json()['error']['code'] == 'advisor_busy'
