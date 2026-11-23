"""Small Win32 adapter. Hooks only enqueue metadata; never block or read typed text."""
import ctypes as ct
from ctypes import wintypes as wt
import os
from pathlib import PureWindowsPath
import queue
import threading
import time


def key_activity(vk, shortcut=False, editing=False):
    if vk in (16, 17, 18, 20, 91, 92, 144, 145, 160, 161, 162, 163, 164, 165):
        return None
    if editing or (vk == 46 and not shortcut):
        return {"kind": "typing"}
    if shortcut:
        return {"kind": "key", "value": "keyboard shortcut"}
    navigation = {9: "Tab", 13: "Enter", 27: "Escape", 33: "Page Up", 34: "Page Down",
                  35: "End", 36: "Home", 37: "Left arrow", 38: "Up arrow", 39: "Right arrow", 40: "Down arrow", 46: "Delete"}
    if vk in navigation:
        return {"kind": "key", "value": navigation[vk]}
    if 112 <= vk <= 123:
        return {"kind": "key", "value": f"F{vk - 111}"}
    # No character, virtual key code, clipboard value, or typed content leaves the hook.
    return {"kind": "typing"}


class NativeDesktop:
    def __init__(self):
        if os.name != "nt":
            raise RuntimeError("Desktop recording requires Windows.")
        self.user = ct.WinDLL("user32", use_last_error=True)
        self.kernel = ct.WinDLL("kernel32", use_last_error=True)
        self.events = queue.Queue(maxsize=1000)
        self.enabled = False
        self.overflow = False
        self.thread = None
        self.ready = threading.Event()
        self.error = None
        self.ignored = set()
        self.text_reader = None
        self.text_unavailable = False
        self._configure()
        # This helper is a separate process, so its DPI mode cannot change the API server.
        self.user.SetProcessDpiAwarenessContext(ct.c_void_p(-4))

    def _configure(self):
        def api(dll, name, args, result):
            fn = getattr(dll, name); fn.argtypes = args; fn.restype = result
        self.HOOKPROC = ct.WINFUNCTYPE(ct.c_ssize_t, ct.c_int, wt.WPARAM, wt.LPARAM)
        api(self.user, 'SetProcessDpiAwarenessContext', [ct.c_void_p], wt.BOOL)
        api(self.user, 'SetWindowsHookExW', [ct.c_int, self.HOOKPROC, wt.HINSTANCE, wt.DWORD], wt.HANDLE)
        api(self.user, 'CallNextHookEx', [wt.HANDLE, ct.c_int, wt.WPARAM, wt.LPARAM], ct.c_ssize_t)
        api(self.user, 'UnhookWindowsHookEx', [wt.HANDLE], wt.BOOL)
        api(self.user, 'GetMessageW', [ct.POINTER(wt.MSG), wt.HWND, wt.UINT, wt.UINT], ct.c_int)
        api(self.user, 'PeekMessageW', [ct.POINTER(wt.MSG), wt.HWND, wt.UINT, wt.UINT, wt.UINT], wt.BOOL)
        api(self.user, 'TranslateMessage', [ct.POINTER(wt.MSG)], wt.BOOL)
        api(self.user, 'DispatchMessageW', [ct.POINTER(wt.MSG)], ct.c_ssize_t)
        api(self.user, 'PostThreadMessageW', [wt.DWORD, wt.UINT, wt.WPARAM, wt.LPARAM], wt.BOOL)
        api(self.user, 'GetForegroundWindow', [], wt.HWND)
        api(self.user, 'WindowFromPoint', [wt.POINT], wt.HWND)
        api(self.user, 'GetAncestor', [wt.HWND, wt.UINT], wt.HWND)
        api(self.user, 'GetWindowThreadProcessId', [wt.HWND, ct.POINTER(wt.DWORD)], wt.DWORD)
        api(self.user, 'GetWindowTextW', [wt.HWND, wt.LPWSTR, ct.c_int], ct.c_int)
        api(self.user, 'GetAsyncKeyState', [ct.c_int], wt.SHORT)
        api(self.user, 'SetWindowDisplayAffinity', [wt.HWND, wt.DWORD], wt.BOOL)
        api(self.user, 'OpenInputDesktop', [wt.DWORD, wt.BOOL, wt.DWORD], wt.HANDLE)
        api(self.user, 'GetUserObjectInformationW', [wt.HANDLE, ct.c_int, ct.c_void_p, wt.DWORD, ct.POINTER(wt.DWORD)], wt.BOOL)
        api(self.user, 'CloseDesktop', [wt.HANDLE], wt.BOOL)
        api(self.kernel, 'GetCurrentThreadId', [], wt.DWORD)
        api(self.kernel, 'GetModuleHandleW', [wt.LPCWSTR], wt.HMODULE)
        api(self.kernel, 'OpenProcess', [wt.DWORD, wt.BOOL, wt.DWORD], wt.HANDLE)
        api(self.kernel, 'QueryFullProcessImageNameW', [wt.HANDLE, wt.DWORD, wt.LPWSTR, ct.POINTER(wt.DWORD)], wt.BOOL)
        api(self.kernel, 'CloseHandle', [wt.HANDLE], wt.BOOL)

    def bounds(self):
        return dict(zip(('left', 'top', 'width', 'height'), [self.user.GetSystemMetrics(i) for i in (76, 77, 78, 79)]))

    def foreground(self):
        handle = int(self.user.GetForegroundWindow() or 0)
        return 0 if handle in self.ignored else handle

    def window(self, handle):
        title = ct.create_unicode_buffer(501)
        self.user.GetWindowTextW(handle, title, len(title))
        pid = wt.DWORD()
        self.user.GetWindowThreadProcessId(handle, ct.byref(pid))
        process = self.kernel.OpenProcess(0x1000, False, pid.value)
        app = 'Windows desktop'
        if process:
            try:
                buffer = ct.create_unicode_buffer(4096); size = wt.DWORD(len(buffer))
                if self.kernel.QueryFullProcessImageNameW(process, 0, buffer, ct.byref(size)):
                    app = PureWindowsPath(buffer.value).name
            finally:
                self.kernel.CloseHandle(process)
        return {'title': title.value or app, 'app': app}

    def interactive(self):
        desktop = self.user.OpenInputDesktop(0, False, 1)
        if not desktop:
            return False
        try:
            name = ct.create_unicode_buffer(256); size = wt.DWORD()
            return bool(self.user.GetUserObjectInformationW(desktop, 2, name, ct.sizeof(name), ct.byref(size))) and name.value.lower() == 'default'
        finally:
            self.user.CloseDesktop(desktop)

    def capture(self):
        from PIL import ImageGrab
        return ImageGrab.grab(all_screens=True, include_layered_windows=True)

    def focused_field(self, hwnd):
        if not self.enabled or self.text_unavailable or not self.interactive() or self.foreground() != hwnd:
            return None
        try:
            if self.text_reader is None:
                from .text_capture import FocusedTextReader
                self.text_reader = FocusedTextReader()
            return self.text_reader.focused(hwnd)
        except Exception:
            self.text_unavailable = True
            return None

    def target_at(self, hwnd, x, y):
        if not self.enabled or self.text_unavailable or not self.interactive(): return None
        try:
            if self.text_reader is None:
                from .text_capture import FocusedTextReader
                self.text_reader = FocusedTextReader()
            return self.text_reader.target_at(hwnd, x, y)
        except Exception:
            return None

    def close_text_reader(self):
        if self.text_reader:
            self.text_reader.close()
            self.text_reader = None

    def ignore_window(self, handle):
        root = int(self.user.GetAncestor(handle, 2) or handle)
        self.ignored.add(root)
        # Exclude floating controls from supported Windows captures; not a redaction guarantee.
        self.user.SetWindowDisplayAffinity(root, 0x11)

    def _emit(self, data):
        if not self.enabled or not data or data.get('hwnd') in self.ignored:
            return
        data['time'] = time.time()
        try:
            self.events.put_nowait(data)
        except queue.Full:
            self.overflow = True
            self.enabled = False

    def start(self):
        self.thread = threading.Thread(target=self._listen, daemon=True)
        self.thread.start()
        if not self.ready.wait(5) or self.error:
            raise RuntimeError('Windows input capture could not start. Desktop recording may be restricted on this computer.')

    def _listen(self):
        class Mouse(ct.Structure):
            _fields_ = [('pt', wt.POINT), ('mouseData', wt.DWORD), ('flags', wt.DWORD), ('time', wt.DWORD), ('extra', ct.c_size_t)]
        class Key(ct.Structure):
            _fields_ = [('vkCode', wt.DWORD), ('scanCode', wt.DWORD), ('flags', wt.DWORD), ('time', wt.DWORD), ('extra', ct.c_size_t)]
        def mouse(code, message, pointer):
            if code >= 0 and self.enabled and message in (0x201, 0x204, 0x207, 0x20A, 0x20E):
                data = ct.cast(pointer, ct.POINTER(Mouse)).contents
                hwnd = self.user.GetAncestor(self.user.WindowFromPoint(data.pt), 2)
                event = {'hwnd': int(hwnd or 0), 'x': data.pt.x, 'y': data.pt.y}
                if message in (0x20A, 0x20E):
                    delta = ct.c_short(data.mouseData >> 16).value
                    event.update(kind='scroll', value=('right' if delta > 0 else 'left') if message == 0x20E else ('up' if delta > 0 else 'down'))
                else:
                    event.update(kind='click', button={0x201: 'left', 0x204: 'right', 0x207: 'middle'}[message])
                self._emit(event)
            return self.user.CallNextHookEx(None, code, message, pointer)
        def keyboard(code, message, pointer):
            if code >= 0 and self.enabled and message in (0x100, 0x104):
                data = ct.cast(pointer, ct.POINTER(Key)).contents
                shortcut = any(self.user.GetAsyncKeyState(key) & 0x8000 for key in (17, 18, 91, 92))
                ctrl = bool(self.user.GetAsyncKeyState(17) & 0x8000)
                shift = bool(self.user.GetAsyncKeyState(16) & 0x8000)
                editing = (ctrl and data.vkCode in (86, 88, 90, 89)) or (shift and data.vkCode in (45, 46))
                event = key_activity(data.vkCode, shortcut, editing)
                if event:
                    self._emit({**event, 'hwnd': int(self.user.GetForegroundWindow() or 0)})
            return self.user.CallNextHookEx(None, code, message, pointer)
        # Keep callbacks alive for the complete lifetime of both hooks.
        callbacks = [self.HOOKPROC(mouse), self.HOOKPROC(keyboard)]
        hooks = []
        try:
            self.thread_id = self.kernel.GetCurrentThreadId()
            msg = wt.MSG()
            self.user.PeekMessageW(ct.byref(msg), None, 0, 0, 0)
            for kind, callback in zip((14, 13), callbacks):
                hook = self.user.SetWindowsHookExW(kind, callback, self.kernel.GetModuleHandleW(None), 0)
                if not hook:
                    raise ct.WinError(ct.get_last_error())
                hooks.append(hook)
            self.ready.set()
            while self.user.GetMessageW(ct.byref(msg), None, 0, 0) > 0:
                self.user.TranslateMessage(ct.byref(msg)); self.user.DispatchMessageW(ct.byref(msg))
        except Exception:
            self.error = True; self.ready.set()
        finally:
            for hook in hooks:
                self.user.UnhookWindowsHookEx(hook)

    def stop(self):
        self.enabled = False
        if self.thread and self.thread.is_alive():
            self.user.PostThreadMessageW(self.thread_id, 0x12, 0, 0)
            self.thread.join(timeout=3)
