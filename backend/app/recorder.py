"""Own the local Playwright recorder process; no browser credentials cross the API."""
import json
import os
import shutil
import subprocess
import sys
import importlib.util
import threading
from pathlib import Path

from fastapi import HTTPException

from .config import PROJECT


class RecorderService:
    def __init__(self, settings):
        self.settings = settings
        self.directory = settings.data_dir / "recorder"
        self.process = None
        self.lock = threading.RLock()
        self.state = {"phase": "idle", "mode": "browser", "workflow_id": None, "title": "", "count": 0, "pending": 0, "error": "", "download_error": ""}

    def status(self):
        with self.lock:
            running = self.process is not None and self.process.poll() is None
            state = dict(self.state)
            state["browser_channel"] = self.settings.browser_channel
            manifest = self.directory / "session.json"
            recoverable = manifest.is_file() and not running
            if recoverable:
                try:
                    previous = json.loads(manifest.read_text(encoding="utf-8"))
                    state.update(workflow_id=previous["id"], title=previous["title"], count=previous["nextSequence"] - 1, mode=previous.get('mode', 'browser'))
                    state["pending"] = len(list((self.directory / "queue").glob("*.json")))
                except (OSError, ValueError, KeyError):
                    state["error"] = "The saved recorder session could not be read. Keep its files for recovery."
                state["phase"] = "interrupted"
            state["recoverable"] = recoverable
            state['browser_available'] = bool(shutil.which("node")) and (PROJECT / "frontend/node_modules/playwright/package.json").is_file()
            state['desktop_available'] = os.name == 'nt' and importlib.util.find_spec('tkinter') is not None
            state['available'] = state['desktop_available'] if state['mode'] == 'desktop' else state['browser_available']
            return state

    def start(self, api_origin, title="", url="", recover=False, mode='browser', recording_context=""):
        with self.lock:
            current = self.status()
            if self.process is not None and self.process.poll() is None:
                raise HTTPException(409, "A recording is already running. Stop it before starting another.")
            if current["recoverable"] and not recover:
                raise HTTPException(409, "Recover the previous recording before starting another.")
            if recover and not current["recoverable"]:
                raise HTTPException(409, "There is no interrupted recording to recover.")
            mode = current['mode'] if recover else mode
            if mode not in ('browser', 'desktop'):
                raise HTTPException(422, 'Choose browser or desktop recording.')
            if mode == 'desktop' and not current['desktop_available']:
                raise HTTPException(503, 'Whole-desktop recording requires Windows and Python with Tkinter.')
            if mode == 'browser' and not current['browser_available']:
                raise HTTPException(503, "Install Node.js and run npm.cmd ci inside frontend, then restart the backend.")
            self.directory.mkdir(parents=True, exist_ok=True)
            self.state = {"phase": "recovering" if recover else "starting", "mode": mode, "workflow_id": current["workflow_id"] if recover else None,
                          "title": current["title"] if recover else title, "count": 0, "pending": 0, "error": "", "download_error": ""}
            environment = {key: value for key, value in os.environ.items() if key not in ("OPENAI_API_KEY", "SOP_TOKEN")}
            # Node has no console window on Windows. Chromium itself remains visible.
            try:
                self.process = subprocess.Popen(
                    [sys.executable, '-m', 'backend.desktop.runner'] if mode == 'desktop' else [shutil.which("node"), str(PROJECT / "frontend/recorder/runner.mjs")],
                    cwd=PROJECT, env=environment, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                    stderr=subprocess.DEVNULL, text=True, encoding="utf-8", bufsize=1,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0,
                )
                self.process.stdin.write(json.dumps({"api": api_origin, "token": self.settings.token,
                    "directory": str(self.directory.resolve()), "title": title, "url": url, "mode": mode,
                    "recording_context": recording_context,
                    "browser_channel": self.settings.browser_channel, "recover": recover, "headless": os.getenv("SOP_RECORDER_HEADLESS") == "1"}) + "\n")
                self.process.stdin.flush()
            except (OSError, BrokenPipeError) as exc:
                if self.process is not None and self.process.poll() is None:
                    self.process.terminate()
                self.state.update(phase="error", error="Could not start the recording helper. Check local Python/Node.js installation and Windows access.")
                raise HTTPException(503, self.state["error"]) from exc
            threading.Thread(target=self._read_status, args=(self.process,), daemon=True).start()
            return self.status()

    def _read_status(self, process):
        for line in process.stdout:
            try:
                update = json.loads(line)
                if update.get("type") != "status":
                    continue
                with self.lock:
                    if self.process is process:
                        for key in self.state:
                            if key in update:
                                self.state[key] = update[key]
            except (ValueError, AttributeError):
                continue
        process.wait()
        with self.lock:
            if self.process is process and self.state["phase"] not in ("done", "error"):
                self.state.update(phase="error", error="The recorder closed unexpectedly. Recover any saved steps before continuing.")

    def command(self, action):
        with self.lock:
            if self.process is None or self.process.poll() is not None:
                raise HTTPException(409, "No recording is running.")
            phase = self.state["phase"]
            allowed = {"pause": {"recording"}, "resume": {"paused"}, "stop": {"recording", "paused"}, "retry": {"recording", "paused"}}
            if phase not in allowed.get(action, set()):
                raise HTTPException(409, "Wait for the current recorder operation to finish.")
            try:
                self.process.stdin.write(json.dumps({"action": action}) + "\n")
                self.process.stdin.flush()
            except (OSError, BrokenPipeError) as exc:
                raise HTTPException(409, "The recorder closed. Refresh its status to recover saved steps.") from exc
            if action in ("pause", "resume", "stop"):
                self.state["phase"] = {"pause": "pausing", "resume": "resuming", "stop": "stopping"}[action]
            return self.status()

    def shutdown(self):
        with self.lock:
            process = self.process
            if process is None or process.poll() is not None:
                return
            try:
                process.stdin.write('{"action":"stop"}\n')
                process.stdin.flush()
            except OSError:
                pass
        try:
            process.wait(timeout=12)
        except subprocess.TimeoutExpired:
            process.terminate()
            # Unacknowledged steps remain in the recorder directory for recovery.
