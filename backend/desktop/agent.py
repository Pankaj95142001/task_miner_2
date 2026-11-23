"""Run inside the Windows session containing the applications to record."""
import argparse
from contextlib import contextmanager
import json
import os
from pathlib import Path
import socket
import ssl
import subprocess
import sys
from urllib.parse import urlsplit
from uuid import uuid4

import httpx


def backend_url(value):
    value = value.strip().rstrip('/')
    parsed = urlsplit(value)
    try:
        port = parsed.port
    except ValueError:
        raise ValueError('Invalid backend port.') from None
    if (not parsed.hostname or parsed.username or parsed.password or parsed.query or parsed.fragment
            or parsed.path or parsed.scheme not in ('http', 'https')):
        raise ValueError('Enter a backend origin such as https://sop.company.example, without a path or credentials.')
    if parsed.scheme == 'http' and parsed.hostname not in ('127.0.0.1', 'localhost', '::1'):
        raise ValueError('Use HTTPS for a remote backend, or a localhost address through an approved SSH tunnel.')
    return value


def preflight(api, token):
    with httpx.Client(base_url=api, headers={'Authorization': 'Bearer ' + token},
                      timeout=10, verify=ssl.create_default_context()) as client:
        response = client.get('/api/settings')
        response.raise_for_status()
        if not response.json().get('remote_agent_capture'):
            raise ValueError('Update the dashboard backend before connecting this agent.')


@contextmanager
def single_instance(directory):
    import msvcrt
    directory.mkdir(parents=True, exist_ok=True)
    with (directory / 'agent.lock').open('a+b') as lock:
        lock.seek(0); lock.write(b'0'); lock.flush(); lock.seek(0)
        try:
            msvcrt.locking(lock.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError:
            raise ValueError('Another remote recorder is already running in this Windows account.') from None
        try:
            yield
        finally:
            lock.seek(0); msvcrt.locking(lock.fileno(), msvcrt.LK_UNLCK, 1)


def make_config(directory, api, token, title, recover=False):
    api = backend_url(api)
    manifest = directory / 'recording' / 'session.json'
    if manifest.exists():
        saved = json.loads(manifest.read_text(encoding='utf-8'))
        if saved.get('api') != api:
            raise ValueError('Unsent recording belongs to another backend. Use its original backend address to recover.')
        if not recover:
            raise ValueError('An unfinished recording exists. Choose Recover saved steps first.')
    elif recover:
        raise ValueError('There is no saved recording to recover.')
    identity = directory / 'agent-id.txt'
    if not identity.exists(): identity.write_text(str(uuid4()), encoding='utf-8')
    return {'api': api, 'token': token, 'title': title, 'directory': str((directory / 'recording').resolve()),
            'recover': recover, 'capture_host': {'kind': 'remote_agent',
                'agent_id': identity.read_text(encoding='utf-8').strip(), 'machine': socket.gethostname()[:200]}}


def setup(directory, default_api=''):
    import tkinter as tk
    from tkinter import messagebox
    root = tk.Tk(); root.title('SOP Studio - Remote recorder setup'); root.resizable(False, False)
    frame = tk.Frame(root, padx=24, pady=20); frame.pack()
    tk.Label(frame, text='Run this recorder INSIDE the remote Windows session.', wraplength=500).grid(row=0,column=0,columnspan=2,pady=(0,12))
    entries = []
    for row, (label, value, hidden) in enumerate([
        ('Dashboard backend URL', default_api, False), ('Dashboard session token', '', True),
        ('Workflow name', 'Remote desktop workflow', False)], 1):
        tk.Label(frame,text=label).grid(row=row,column=0,sticky='w',padx=(0,12),pady=5)
        entry=tk.Entry(frame,width=48,show='*' if hidden else ''); entry.insert(0,value)
        entry.grid(row=row,column=1,pady=5); entries.append(entry)
    tk.Label(frame,text='Captures this session: screenshots, clicks and accessible field values. Password fields stay private.\nStop/Pause controls appear here. No OpenAI key is needed on this machine.',wraplength=520,justify='left').grid(row=4,column=0,columnspan=2,pady=12)
    result=[]
    def connect(recover):
        api,token,title=[e.get().strip() for e in entries]
        try:
            if len(token)<16: raise ValueError('Enter the dashboard session token.')
            if not title or len(title)>200: raise ValueError('Enter a workflow name of 1 to 200 characters.')
            config=make_config(directory,api,token,title,recover)
            preflight(config['api'],token)
        except httpx.HTTPStatusError as error:
            messagebox.showerror('Cannot connect', 'Session token was rejected.' if error.response.status_code==401 else 'The backend rejected the connection. Check its status.',parent=root); return
        except httpx.HTTPError:
            messagebox.showerror('Cannot connect','Backend unreachable or its certificate is not trusted. Check the URL and approved network connection.',parent=root); return
        except (ValueError,OSError):
            # Known setup errors contain no credentials; avoid logging HTTP requests.
            messagebox.showerror('Cannot start', 'Check the URL, workflow name and local storage. If a recording is pending, recover it using the original backend address.',parent=root); return
        (directory/'connection.json').write_text(json.dumps({'api':config['api']}),encoding='utf-8')
        result.append(config); root.destroy()
    tk.Button(frame,text='Start recording',command=lambda: connect(False),width=22).grid(row=5,column=0,pady=6)
    tk.Button(frame,text='Recover saved steps',command=lambda: connect(True),width=24).grid(row=5,column=1,pady=6)
    root.mainloop()
    return result[0] if result else None


def run_helper(config):
    environment={k:v for k,v in os.environ.items() if k not in ('OPENAI_API_KEY','SOP_TOKEN')}
    process=subprocess.Popen([sys.executable,'-m','backend.desktop.runner'],
        cwd=Path(__file__).resolve().parents[2], env=environment,
        stdin=subprocess.PIPE,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL,
        text=True,encoding='utf-8',creationflags=subprocess.CREATE_NO_WINDOW)
    state={}; previous=None
    try:
        # Token is passed in memory, never on the command line or in the queue.
        process.stdin.write(json.dumps(config)+'\n');process.stdin.flush()
        for line in process.stdout:
            try: state=json.loads(line)
            except ValueError: continue
            status=(state.get('phase'),state.get('count'),state.get('pending'))
            if status!=previous:
                print(f'{status[0]} | {status[1] or 0} steps | {status[2] or 0} pending',flush=True);previous=status
            if state.get('error'): print(state['error'],flush=True)
        process.wait()
    except KeyboardInterrupt:
        try:
            process.stdin.write('{"action":"stop"}\n');process.stdin.flush();process.wait(timeout=20)
        except (OSError,subprocess.TimeoutExpired): process.terminate();process.wait()
    finally:
        process.stdin.close();process.stdout.close()
    if state.get('phase')!='done':
        print('Saved steps remain on this machine. Run the agent again and choose Recover saved steps.')
        return 1
    print('Saved. Refresh the workflow library in your SOP dashboard.')
    return 0


def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--backend',default='',help='HTTPS backend origin, or localhost through an approved tunnel')
    args=parser.parse_args()
    if os.name!='nt': parser.error('The remote recorder requires Windows.')
    directory=Path(os.environ.get('LOCALAPPDATA',str(Path.home())))/'SOPStudioRemoteRecorder'
    with single_instance(directory):
        api=args.backend
        if not api and (directory/'connection.json').exists():
            api=json.loads((directory/'connection.json').read_text(encoding='utf-8')).get('api','')
        config=setup(directory,api)
        return run_helper(config) if config else 0


if __name__=='__main__':
    try: sys.exit(main())
    except (ValueError,OSError) as error:
        print(str(error));sys.exit(1)
