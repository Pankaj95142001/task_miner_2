import json
import ssl

import httpx
import pytest
from openai import APIConnectionError, APIStatusError, APITimeoutError, DefaultHttpxClient

from backend.app import cleaner
from backend.app.config import Settings


def record(identifier='step-one', **changes):
    return {'id': identifier, 'action': 'click', 'label': 'Save', 'page_title': 'Form',
            'url': 'https://example.org', 'value': '', 'sensitive': False, 'description': 'Click Save.', **changes}


def test_real_sdk_uses_verified_system_tls_and_preserves_private_masking(tmp_path, monkeypatch):
    context = ssl.create_default_context()
    assert context.verify_mode == ssl.CERT_REQUIRED and context.check_hostname
    monkeypatch.setattr(cleaner.ssl, 'create_default_context', lambda: context)
    seen = []
    def respond(request):
        payload = json.loads(request.content)
        seen.append(payload)
        data = json.loads(payload['input'][1]['content'])
        records = data['steps']
        assert data['recording_context'] == 'Raise a ticket for access.'
        assert 'Raise a ticket for access.' not in payload['input'][0]['content']
        assert records[1]['value'] == '[private]'
        assert 'do-not-send-this' not in request.content.decode()
        assert payload['store'] is False
        assert payload['text']['format']['type'] == 'json_schema'
        assert payload['text']['format']['strict'] is True
        return httpx.Response(200, json={
            'id': 'resp_test', 'object': 'response', 'created_at': 1, 'model': 'gpt-4o-mini', 'status': 'completed',
            'output': [{'id': 'msg_test', 'type': 'message', 'role': 'assistant', 'status': 'completed',
                'content': [{'type': 'output_text', 'annotations': [], 'text': json.dumps({'steps': [
                    {'id': records[0]['id'], 'description': 'Select Save.'},
                    {'id': records[1]['id'], 'description': 'Enter the required private information.'},
                ]})}]}],
        })
    def client(**kwargs):
        assert kwargs['verify'] is context
        return DefaultHttpxClient(**kwargs, transport=httpx.MockTransport(respond))
    monkeypatch.setattr(cleaner, 'DefaultHttpxClient', client)
    result = cleaner.clean_steps(Settings(tmp_path, 'test-session-token', 'test-key'), [
        record(), record('step-two', action='input', sensitive=True, value='do-not-send-this'),
    ], 'Raise a ticket for access.')
    assert [s.description for s in result] == ['Select Save.', 'Enter the required private information.']
    assert len(seen) == 1


@pytest.mark.parametrize('status,code,reason,phrase', [
    (401, 'invalid_api_key', 'authentication_error', 'OPENAI_API_KEY'),
    (429, 'insufficient_quota', 'quota_error', 'billing'),
    (429, 'project_spend_limit_exceeded', 'quota_error', 'billing'),
    (429, 'rate_limit_exceeded', 'rate_limit', 'Wait briefly'),
    (403, None, 'access_error', 'permissions'),
    (404, 'model_not_found', 'access_error', 'OPENAI_MODEL'),
    (400, 'invalid_json_schema', 'request_error', 'API settings'),
    (503, None, 'provider_error', 'temporarily unavailable'),
])
def test_provider_failures_are_actionable_without_leaking_bodies(status, code, reason, phrase):
    secret = 'sensitive-provider-message-and-key'
    response = httpx.Response(status, request=httpx.Request('POST', 'https://api.openai.com/v1/responses'))
    error = APIStatusError(secret, response=response, body={'code': code, 'message': secret})
    result = cleaner.cleanup_failure(error)
    assert result['reason'] == reason and phrase in result['message']
    assert secret not in str(result) and 'No steps were changed.' in result['message']


def test_connection_certificate_timeout_and_invalid_response_errors():
    request = httpx.Request('POST', 'https://api.openai.com/v1/responses')
    error = APIConnectionError(request=request)
    assert cleaner.cleanup_failure(error)['reason'] == 'connection_error'
    error.__cause__ = httpx.ConnectError('[SSL: CERTIFICATE_VERIFY_FAILED] sensitive internal details')
    result = cleaner.cleanup_failure(error)
    assert result['reason'] == 'certificate_error' and 'SSL_CERT_FILE' in result['message']
    assert 'sensitive internal details' not in result['message']
    assert cleaner.cleanup_failure(APITimeoutError(request=request))['reason'] == 'timeout'
    assert cleaner.cleanup_failure(ValueError('private output'))['reason'] == 'invalid_response'
    assert cleaner.cleanup_failure(RuntimeError('private credentials'))['reason'] == 'cleanup_error'
