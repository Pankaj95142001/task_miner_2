@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  py -3 -m venv .venv
  if errorlevel 1 goto failed
)
.venv\Scripts\python.exe -m pip install -r remote-recorder\requirements.txt
if errorlevel 1 goto failed
echo Setup complete. Run start-remote-recorder.cmd inside the remote session.
pause
exit /b 0
:failed
echo Setup failed. Install Python 3.11 or newer with Tkinter and check approved package access.
pause
exit /b 1
