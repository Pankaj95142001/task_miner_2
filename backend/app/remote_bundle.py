"""Distributable recorder bundle: explicit allowlist, no local data or credentials."""
from io import BytesIO
from zipfile import ZipFile, ZIP_DEFLATED
from .config import PROJECT

FILES = (
    'backend/__init__.py', 'backend/desktop/__init__.py',
    'backend/desktop/agent.py', 'backend/desktop/engine.py',
    'backend/desktop/native.py', 'backend/desktop/text_capture.py', 'backend/desktop/runner.py',
    'remote-recorder/requirements.txt', 'remote-recorder/README.md',
    'setup-remote-recorder.cmd', 'start-remote-recorder.cmd',
)


def recorder_bundle():
    output = BytesIO()
    with ZipFile(output, 'w', ZIP_DEFLATED) as archive:
        for name in FILES:
            archive.writestr('sop-remote-recorder/' + name, (PROJECT / name).read_bytes())
    return output.getvalue()
