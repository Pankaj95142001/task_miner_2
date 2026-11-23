@echo off
cd /d "%~dp0"
if not exist "frontend\node_modules\playwright\package.json" (
  echo Browser dependencies missing. Run npm.cmd ci inside frontend.
  exit /b 1
)
node "frontend\recorder\dashboard.mjs"
