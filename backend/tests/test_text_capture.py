from types import SimpleNamespace

from backend.desktop.text_capture import TextField
from backend.app.cleaner import fallback_text


INTERFACES = SimpleNamespace(UIA_ValuePatternId=10002, IUIAutomationValuePattern=object,
    UIA_TextPatternId=10014, IUIAutomationTextPattern=object, UIA_EditControlTypeId=50004,
    UIA_DocumentControlTypeId=50030, UIA_IsReadOnlyAttributeId=40015)


class Element:
    CurrentIsPassword = False
    CurrentHasKeyboardFocus = True
    CurrentName = 'Notes'
    CurrentControlType = 50004
    CurrentIsReadOnly = False
    value = 'Approved'
    def GetRuntimeId(self): return [42, 1]
    def GetCurrentPattern(self, _): return self
    def QueryInterface(self, _): return self
    @property
    def CurrentValue(self):
        assert not self.CurrentIsPassword, 'Password contents must never be read'
        return self.value


def test_password_is_checked_before_name_or_value():
    class Private(Element):
        CurrentIsPassword = True
        @property
        def CurrentName(self): raise AssertionError('Private accessible name must not be read')
    result = TextField(Private(), INTERFACES).read()
    assert result == {'text_capture': 'protected', 'value': '', 'label': 'the private field', 'sensitive': True}


def test_unicode_line_breaks_truncation_and_xml_controls():
    element = Element(); element.value = 'R\u00e9sum\u00e9\n\u0939\u093f\u0902\u0926\u0940\t<notes> & \x00' + 'x' * 2100
    result = TextField(element, INTERFACES).read()
    assert result['text_capture'] == 'truncated' and len(result['value']) == 2000
    assert result['value'].startswith('R\u00e9sum\u00e9\n\u0939\u093f\u0902\u0926\u0940\t<notes> & ')
    assert '\x00' not in result['value']
    assert 'Only the first 2,000 characters' in fallback_text({'action': 'input', 'source': 'desktop', **result})


def test_unavailable_password_metadata_fails_closed():
    class Broken(Element):
        @property
        def CurrentIsPassword(self): raise RuntimeError('Provider unavailable')
        @property
        def CurrentValue(self): raise AssertionError('Value must not be read')
    assert TextField(Broken(), INTERFACES).read()['text_capture'] == 'unavailable'
    element = Element(); element.CurrentIsReadOnly = True
    assert TextField(element, INTERFACES).read()['value'] == ''
    element.CurrentHasKeyboardFocus = False
    assert TextField(element, INTERFACES).read() is None


def test_editable_text_pattern_only():
    class Document(Element):
        def GetCurrentPattern(self, kind):
            if kind == 10002: raise RuntimeError('ValuePattern not supported')
            return self
        @property
        def DocumentRange(self): return self
        def GetAttributeValue(self, _): return self.CurrentIsReadOnly
        def GetText(self, limit): return self.value[:limit]
    element = Document(); element.value = 'Line one\nLine two'
    assert TextField(element, INTERFACES).read()['value'] == element.value
    element.CurrentIsReadOnly = True
    assert TextField(element, INTERFACES).read()['text_capture'] == 'unavailable'
    element.CurrentIsReadOnly = object()
    assert TextField(element, INTERFACES).read()['text_capture'] == 'unavailable'
