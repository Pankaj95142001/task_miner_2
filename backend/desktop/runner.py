"""JSON-over-stdio child process with visible desktop recording controls."""
import json
import queue
import sys
import threading
import time

from .engine import DesktopRecorder
from .native import NativeDesktop


def main():
    config = json.loads(sys.stdin.readline())
    commands = queue.Queue(); statuses = queue.Queue(); output_lock = threading.Lock()
    def report(state):
        statuses.put(state)
        with output_lock:
            print(json.dumps(state), flush=True)
    native = None if config.get('recover') else NativeDesktop()
    engine = DesktopRecorder(config, native, report)
    def read_commands():
        for line in sys.stdin:
            try:
                commands.put(json.loads(line).get('action'))
            except ValueError:
                continue
        commands.put('stop')
    threading.Thread(target=read_commands, daemon=True).start()

    def work():
        try:
            engine.recover() if config.get('recover') else engine.start()
            def upload():
                while engine.phase not in ('done', 'error'):
                    engine.pump(); time.sleep(.4)
            uploader = threading.Thread(target=upload, daemon=True); uploader.start()
            while engine.phase not in ('done', 'error'):
                try:
                    command = commands.get(timeout=.04)
                    if command == 'pause': engine.pause()
                    if command == 'resume': engine.resume()
                    if command == 'stop': engine.stop()
                    # Uploads already retry in the background.
                except queue.Empty:
                    pass
                if not config.get('recover'): engine.tick()
        except Exception:
            engine.phase = 'error'
            engine.error = 'Desktop recording could not continue. Check local disk space and Windows access; recover any saved steps.'
            engine.report()
        finally:
            if native:
                native.stop()
                native.close_text_reader()

    if config.get('recover'):
        work()
        return
    import tkinter as tk
    root = tk.Tk()
    root.title('SOP Studio - Desktop recorder')
    root.attributes('-topmost', True)
    root.resizable(False, False)
    root.geometry('+30+30')
    root.configure(bg='#194f43')
    label = tk.Label(root, text='Desktop recording starts in 3 seconds', bg='#194f43', fg='white', padx=16, pady=12, wraplength=360)
    label.pack()
    buttons = tk.Frame(root, bg='#194f43'); buttons.pack(padx=12, pady=(0, 12))
    toggle = tk.Button(buttons, text='Pause', width=12, command=lambda: commands.put('resume' if engine.phase == 'paused' else 'pause'))
    toggle.pack(side='left', padx=4)
    stop = tk.Button(buttons, text='Stop & review', width=16, command=lambda: commands.put('stop'))
    stop.pack(side='left', padx=4)
    root.protocol('WM_DELETE_WINDOW', lambda: commands.put('stop'))
    root.update_idletasks(); native.ignore_window(root.winfo_id())
    def update():
        latest = None
        while not statuses.empty(): latest = statuses.get_nowait()
        if latest:
            phase = latest['phase']
            text = {'starting': 'Desktop recording starts in 3 seconds', 'recording': 'RECORDING - all monitors',
                    'paused': 'PAUSED - no capture', 'stopping': 'Saving desktop steps...', 'done': 'Saved - return to SOP Studio',
                    'error': 'Stopped - return to SOP Studio for recovery'}.get(phase, phase)
            label.configure(text=f'{text}\n{latest["count"]} steps | {latest["pending"]} waiting to sync')
            if latest['error']:
                label.configure(text=f'{text}\n{latest["error"]}')
            toggle.configure(text='Resume' if phase == 'paused' else 'Pause', state='normal' if phase in ('recording', 'paused') else 'disabled')
            stop.configure(state='disabled' if phase in ('stopping', 'done', 'error') else 'normal')
            if phase in ('done', 'error'):
                root.after(1200, root.destroy); return
        root.after(100, update)
    threading.Thread(target=work, daemon=True).start()
    root.after(100, update); root.mainloop()


if __name__ == '__main__':
    try:
        main()
    except Exception:
        print(json.dumps({'type': 'status', 'mode': 'desktop', 'phase': 'error',
                          'error': 'Desktop recording could not open. Run SOP Studio in an unlocked Windows session.'}), flush=True)
        sys.exit(1)
