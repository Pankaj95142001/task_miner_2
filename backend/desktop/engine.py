"""Durable whole-desktop step capture, separate from hooks, UI and HTTP uploading."""
import base64
from datetime import datetime, timezone
from io import BytesIO
import json
from pathlib import Path
import queue
import ssl
import threading
import time
from uuid import uuid4

import httpx


def timestamp(value):
    return datetime.fromtimestamp(value, timezone.utc).isoformat()


def desktop_point(x, y, bounds):
    return {'space': 'desktop', 'x': x - bounds['left'], 'y': y - bounds['top'],
            'screen_x': x, 'screen_y': y, 'desktop_left': bounds['left'], 'desktop_top': bounds['top'],
            'desktop_width': bounds['width'], 'desktop_height': bounds['height']}


class DesktopRecorder:
    def __init__(self, config, native=None, on_status=lambda state: None, api=None, clock=time.time):
        self.config, self.native, self.on_status, self.clock = config, native, on_status, clock
        self.directory = Path(config['directory']); self.queue_path = self.directory / 'queue'
        self.manifest_path = self.directory / 'session.json'
        self.phase = 'starting'; self.error = ''; self.manifest = None
        self.jobs = {}; self.snapshot = None; self.last_capture = 0; self.last_window = None
        self.pending = None; self.input_field = None; self.lock = threading.RLock()
        self.input_group = None
        self.enabled_since = 0
        self.client = None
        self.api_override = api

    def report(self):
        with self.lock:
            state = {'type': 'status', 'mode': 'desktop', 'phase': self.phase,
                     'workflow_id': self.manifest['id'] if self.manifest else None,
                     'title': self.manifest['title'] if self.manifest else self.config.get('title', ''),
                     'count': self.manifest['nextSequence'] - 1 if self.manifest else 0,
                     'pending': len(self.jobs), 'error': self.error, 'download_error': ''}
        self.on_status(state)
        return state

    def api(self, route, data=None):
        if self.api_override:
            return self.api_override(route, data or {})
        if self.client is None:
            self.client = httpx.Client(base_url=self.config['api'] + '/api', timeout=8,
                                       headers={'Authorization': 'Bearer ' + self.config['token']}, verify=ssl.create_default_context())
        response = self.client.post(route, json=data or {})
        response.raise_for_status()
        return response.json()

    def persist(self, filename, data):
        temporary = filename.with_suffix('.tmp')
        temporary.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
        temporary.replace(filename)

    def save(self, job):
        self.persist(self.queue_path / (job['step']['id'] + '.json'), job)

    def start(self):
        self.queue_path.mkdir(parents=True, exist_ok=True)
        if self.manifest_path.exists():
            raise RuntimeError('Recover the previous recording before starting another.')
        self.native.start()
        workflow = self.api('/workflows', {'title': self.config['title'], 'recording_context': self.config.get('recording_context', '')})
        self.manifest = {'id': workflow['id'], 'title': workflow['title'], 'mode': 'desktop', 'nextSequence': 1, 'api': self.config.get('api'),
                         'capture_host': self.config.get('capture_host')}
        self.persist(self.manifest_path, self.manifest)
        self.start_at = self.clock() + 3
        self.report()

    def capture(self):
        if self.phase != 'recording':
            return {'note': 'Desktop capture was paused or stopped.'}
        if not self.native.interactive():
            self.pause('Desktop capture paused because Windows is locked or on a protected screen. Resume after returning to your desktop.')
            return {'note': 'A protected or locked desktop cannot be captured.'}
        try:
            bounds = self.native.bounds()
            image = self.native.capture().convert('RGB')
            # Keep large multi-monitor desktops within the API's image and request limits.
            image.thumbnail((5000, 3500))
            while True:
                output = BytesIO(); image.save(output, 'JPEG', quality=72)
                if output.tell() <= 5_500_000:
                    break
                image.thumbnail((max(1, int(image.width * .8)), max(1, int(image.height * .8))))
            self.last_capture = self.clock()
            return {'data_url': 'data:image/jpeg;base64,' + base64.b64encode(output.getvalue()).decode(),
                    'captured_at': timestamp(self.last_capture), 'url': '', 'desktop_bounds': bounds,
                    'note': 'Whole desktop across all monitors; image may be resized. Verify the action and any private content.'}
        except Exception:
            self.pause('Desktop screenshots are unavailable. Check that Windows is unlocked, then resume.')
            return {'note': 'Windows could not capture the desktop.'}

    def before(self, occurred):
        if self.snapshot and self.snapshot.get('data_url'):
            captured = datetime.fromisoformat(self.snapshot['captured_at']).timestamp()
            if 0 <= occurred - captured <= 3:
                return {**self.snapshot, 'note': 'Recent pre-action desktop view; verify that it matches this step.'}
        return {'note': 'No recent desktop screenshot from before this action is available.'}

    def enqueue(self, event):
        if len(self.jobs) >= 150:
            self.pause('Recording paused at 150 pending desktop steps. Retry sync before resuming.')
            return None
        occurred = event.get('time', self.clock())
        window = self.native.window(event.get('hwnd', 0))
        action = 'input' if event['kind'] == 'typing' else event['kind']
        point = desktop_point(event['x'], event['y'], self.native.bounds()) if action == 'click' else None
        step = {'id': str(uuid4()), 'sequence': self.manifest['nextSequence'], 'action': action,
                'occurred_at': timestamp(occurred), 'source': 'desktop', 'tab_id': event.get('hwnd', 0),
                'url': '', 'page_title': window['title'][:500], 'app_name': window['app'][:200],
                'selector': '', 'label': window['title'][:300], 'value': event.get('value', ''),
                'sensitive': action == 'input', 'mouse_button': event.get('button', 'left'),
                'coordinates': point, 'before': self.before(occurred),
                'after': {'note': 'The recorder stopped before the post-action desktop image was captured.'}}
        if self.config.get('capture_host'):
            step['capture_host'] = self.config['capture_host']
        if action == 'click' and hasattr(self.native, 'target_at'):
            step['desktop_target'] = self.native.target_at(event.get('hwnd'), event['x'], event['y'])
        # Field values are read separately; raw keystrokes never enter the queue.
        if action == 'input':
            step['value'] = ''
            step['text_capture'] = 'unavailable'
            step['input_group_id'] = event.get('input_group_id')
            step['desktop_field_id'] = event.get('desktop_field_id')
        job = {'step': step, 'ready': False, 'due': self.clock() + (1.5 if action in ('input', 'scroll') else .7)}
        with self.lock:
            self.manifest['nextSequence'] += 1
            self.persist(self.manifest_path, self.manifest)
            self.save(job); self.jobs[step['id']] = job
        self.report()
        return step['id']

    def sample_input(self):
        if not self.input_field or self.phase != 'recording' or not self.native.enabled or not self.native.interactive():
            return
        step_id, field = self.input_field
        job = self.jobs.get(step_id)
        if not job or job['ready']:
            self.input_field = None
            return
        if self.native.foreground() != job['step']['tab_id']:
            self.input_field = None
            return
        sample = field.read()
        if sample is None:
            # Focus moved away. Never substitute the value of a different field.
            self.input_field = None
            return
        with self.lock:
            if any(job['step'].get(key) != value for key, value in sample.items()):
                job['step'].update(sample)
                self.save(job)

    def handle(self, event):
        if self.phase != 'recording' or event.get('time', 0) < self.enabled_since:
            return
        if event.get('kind') not in ('click', 'typing', 'key', 'scroll'):
            return
        if event['kind'] in ('typing', 'scroll'):
            field = self.native.focused_field(event.get('hwnd')) if event['kind'] == 'typing' else None
            # Stopping may flush queued activity, using only the last known field.
            if not self.native.enabled and event['kind'] == 'typing' and self.pending and self.pending[0][1] == event.get('hwnd') and self.input_field:
                field = self.input_field[1]
            identity = field.identity if field else None
            if event['kind'] == 'typing' and identity:
                group_key = (event.get('hwnd'), tuple(identity))
                if not self.input_group or self.input_group[0] != group_key:
                    self.input_group = (group_key, str(uuid4()), field)
                event = {**event, 'input_group_id': self.input_group[1], 'desktop_field_id': list(identity)}
            else:
                self.input_group = None
            key = (event['kind'], event.get('hwnd'), identity if event['kind'] == 'typing' else event.get('value', ''))
            previous = self.jobs.get(self.pending[1]) if self.pending and self.pending[0] == key else None
            if (previous and not previous['ready'] and self.clock() - self.pending[2] < .8
                    and (event['kind'] != 'typing' or previous['step'].get('input_group_id') == event.get('input_group_id'))):
                with self.lock:
                    previous['due'] = self.clock() + 1.5
                    self.save(previous)
                self.pending = (key, self.pending[1], self.clock())
                self.sample_input()
                return
            self.input_field = None
            step_id = self.enqueue(event)
            self.pending = (key, step_id, self.clock()) if step_id else None
            if field and step_id:
                self.input_field = (step_id, field)
                self.sample_input()
        else:
            self.input_group = None
            self.sample_input()
            self.pending = None; self.input_field = None
            self.enqueue(event)

    def tick(self):
        if self.phase == 'starting' and self.clock() >= self.start_at:
            self.phase = 'recording'; self.enabled_since = self.clock()
            self.snapshot = self.capture()
            self.native.enabled = self.phase == 'recording'
            self.report()
        if self.phase != 'recording':
            return
        if not self.native.interactive():
            self.pause('Desktop capture paused because Windows is locked or on a protected screen. Resume after returning to your desktop.')
            return
        if self.native.overflow:
            self.native.overflow = False
            self.pause('Recording paused because input arrived faster than it could be saved. Review the last steps before resuming.')
            return
        if self.input_group:
            key, _, field = self.input_group
            focused = getattr(field, 'is_focused', lambda: False)
            if self.native.foreground() != key[0] or not focused():
                self.input_group = None
        for _ in range(100):
            try:
                self.handle(self.native.events.get_nowait())
            except queue.Empty:
                break
        if self.phase != 'recording':
            return
        self.sample_input()
        handle = self.native.foreground()
        if handle and handle != self.last_window:
            self.input_group = None
            self.pending = None; self.input_field = None
            self.enqueue({'kind': 'window_switch', 'hwnd': handle, 'time': self.clock()})
            self.last_window = handle
        with self.lock:
            due = [job for job in self.jobs.values() if not job['ready'] and job['due'] <= self.clock()]
        if due or self.clock() - self.last_capture >= 1:
            shot = self.capture()
            if self.phase != 'recording':
                return
            self.snapshot = shot
            with self.lock:
                for job in due:
                    job['step']['after'] = shot; job['ready'] = True; self.save(job)

    def finish_pending(self, reason):
        self.input_group = None
        self.pending = None; self.input_field = None; self.snapshot = None
        with self.lock:
            for job in self.jobs.values():
                if not job['ready']:
                    job['step']['after'] = {'note': reason}; job['ready'] = True; self.save(job)

    def pause(self, reason=''):
        if self.phase not in ('recording', 'starting'):
            return
        self.native.enabled = False
        self.phase = 'paused'; self.error = reason
        self.finish_pending('Recording paused before the post-action desktop image was captured.')
        self.report()

    def resume(self):
        if self.phase != 'paused' or len(self.jobs) >= 150:
            return
        self.error = ''; self.last_window = None; self.enabled_since = self.clock()
        self.phase = 'recording'; self.snapshot = self.capture()
        self.native.enabled = self.phase == 'recording'
        self.report()

    def stop(self):
        if self.phase in ('done', 'error', 'stopping'):
            return
        if self.native:
            self.native.stop()
            # Preserve input already delivered before the stop request.
            for _ in range(1000):
                try:
                    self.handle(self.native.events.get_nowait())
                except queue.Empty:
                    break
        self.phase = 'stopping'
        self.finish_pending('Recording stopped before the post-action desktop image was captured.')
        self.report()

    def pump(self):
        # One upload thread calls this; capture and native hooks continue independently.
        with self.lock:
            ready = [job for job in self.jobs.values() if job['ready']]
        for job in ready:
            try:
                self.api(f'/workflows/{self.manifest["id"]}/steps', job['step'])
                with self.lock:
                    (self.queue_path / (job['step']['id'] + '.json')).unlink(missing_ok=True)
                    self.jobs.pop(job['step']['id'], None)
                if self.error.startswith('Sync pending.'):
                    self.error = ''
                self.report()
            except Exception:
                self.error = 'Sync pending. Steps are saved locally. Keep the backend running or recover the recording later.'
                if self.phase in ('stopping', 'recovering'):
                    self.phase = 'error'
                self.report(); return
        if self.phase in ('stopping', 'recovering') and not self.jobs:
            try:
                if self.manifest:
                    self.api(f'/workflows/{self.manifest["id"]}/stop')
                    self.manifest_path.unlink(missing_ok=True)
                self.phase = 'done'; self.error = ''
            except Exception:
                self.phase = 'error'; self.error = 'Steps are saved but finalizing failed. Use Recover saved steps.'
            self.report()

    def recover(self):
        self.manifest = json.loads(self.manifest_path.read_text(encoding='utf-8'))
        if self.manifest.get('api') and self.manifest['api'] != self.config.get('api'):
            raise RuntimeError('Recover using the same backend that created this recording.')
        for filename in self.queue_path.glob('*.json'):
            job = json.loads(filename.read_text(encoding='utf-8'))
            self.jobs[job['step']['id']] = job
        self.phase = 'recovering'
        self.finish_pending('Desktop capture was interrupted; no later screenshot was substituted.')
        self.report()
