@echo off
cd /d "%~dp0"
if not exist ".venv\Scripts\python.exe" (
  echo Python environment missing. Follow the fresh installation steps in README.md.
  exit /b 1
)
if not exist "frontend\dist\index.html" (
  echo Dashboard build missing. Run npm.cmd ci and npm.cmd run build inside frontend.
  exit /b 1
)
echo SOP Studio: http://127.0.0.1:8000
echo Session token: data\session-token.txt, or your configured SOP_TOKEN
echo Press Ctrl+C to stop.
".venv\Scripts\python.exe" -m backend.run
