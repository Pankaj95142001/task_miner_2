"""Read editable field values through Windows accessibility, never raw keystrokes."""
import sys


def unavailable():
    return {'text_capture': 'unavailable', 'value': '', 'sensitive': True}


def target_metadata(element):
    try:
        if element.CurrentIsPassword: return None
        types = {50000:'Button',50001:'Calendar',50002:'CheckBox',50003:'ComboBox',50004:'Edit',50005:'Hyperlink',50006:'Image',50007:'ListItem',50008:'List',50009:'Menu',50010:'MenuBar',50011:'MenuItem',50012:'ProgressBar',50013:'RadioButton',50014:'ScrollBar',50015:'Slider',50016:'Spinner',50017:'StatusBar',50018:'Tab',50019:'TabItem',50020:'Text',50021:'ToolBar',50023:'Tree',50024:'TreeItem',50025:'Custom',50026:'Group',50028:'DataGrid',50029:'DataItem',50030:'Document',50032:'Window',50033:'Pane',50036:'Table'}
        metadata = {'auto_id':(element.CurrentAutomationId or '')[:300], 'name':(element.CurrentName or '')[:300],
                'control_type':types.get(element.CurrentControlType, '')}
        try:
            rect = element.CurrentBoundingRectangle
            if rect.right > rect.left and rect.bottom > rect.top:
                metadata['rect'] = {'x': rect.left, 'y': rect.top, 'width': rect.right-rect.left, 'height': rect.bottom-rect.top}
        except Exception:
            pass
        return metadata
    except Exception:
        return None


class TextField:
    def __init__(self, element, interfaces):
        self.element, self.interfaces = element, interfaces
        self.identity = tuple(element.GetRuntimeId())

    def is_focused(self):
        try:
            return bool(self.element.CurrentHasKeyboardFocus)
        except Exception:
            return False

    def read(self):
        try:
            # Check before reading even the accessible name: password controls may
            # expose confidential content through more than their value property.
            if self.element.CurrentIsPassword:
                return {'text_capture': 'protected', 'value': '', 'label': 'the private field', 'sensitive': True}
            if not self.element.CurrentHasKeyboardFocus:
                return None
            uia = self.interfaces
            try:
                pattern = self.element.GetCurrentPattern(uia.UIA_ValuePatternId).QueryInterface(uia.IUIAutomationValuePattern)
            except Exception:
                pattern = None
            if pattern:
                if pattern.CurrentIsReadOnly:
                    return unavailable()
                value = pattern.CurrentValue
            else:
                # Only editable text/document controls, never arbitrary window text.
                if self.element.CurrentControlType not in (uia.UIA_EditControlTypeId, uia.UIA_DocumentControlTypeId):
                    return unavailable()
                pattern = self.element.GetCurrentPattern(uia.UIA_TextPatternId).QueryInterface(uia.IUIAutomationTextPattern)
                text = pattern.DocumentRange
                if text.GetAttributeValue(uia.UIA_IsReadOnlyAttributeId) is not False:
                    return unavailable()
                value = text.GetText(2001)
            if not isinstance(value, str):
                return unavailable()
            # XML 1.0 cannot represent these controls in DOCX exports.
            value = ''.join(c for c in value if c in '\t\n\r' or (ord(c) >= 32 and not 0xD800 <= ord(c) <= 0xDFFF and ord(c) not in (0xFFFE, 0xFFFF)))
            return {'text_capture': 'truncated' if len(value) > 2000 else 'captured',
                    'value': value[:2000], 'label': (self.element.CurrentName or 'the text field')[:300], 'sensitive': False,
                    'desktop_target': target_metadata(self.element)}
        except Exception:
            return unavailable()


class FocusedTextReader:
    def __init__(self):
        # Created only on the recorder's worker thread. Native hooks stay fast.
        sys.coinit_flags = 0
        import comtypes
        import comtypes.client
        comtypes.CoInitializeEx(0)
        self.comtypes = comtypes
        self.interfaces = comtypes.client.GetModule('UIAutomationCore.dll')
        self.automation = comtypes.client.CreateObject(self.interfaces.CUIAutomation8, interface=self.interfaces.IUIAutomation2)
        self.automation.ConnectionTimeout = 200
        self.automation.TransactionTimeout = 200

    def target_at(self, hwnd, x, y):
        try:
            element = self.automation.ElementFromPoint(self.interfaces.tagPOINT(int(x), int(y)))
            return target_metadata(element) if self.belongs_to(element, hwnd) else None
        except Exception:
            return None

    def belongs_to(self, element, hwnd):
        current = element
        for _ in range(32):
            if not current: return False
            if current.CurrentNativeWindowHandle == hwnd: return True
            current = self.automation.ControlViewWalker.GetParentElement(current)
        return False

    def focused(self, hwnd):
        try:
            element = self.automation.GetFocusedElement()
            if self.belongs_to(element, hwnd):
                return TextField(element, self.interfaces)
        except Exception:
            pass
        return None

    def close(self):
        self.automation = None
        self.comtypes.CoUninitialize()
