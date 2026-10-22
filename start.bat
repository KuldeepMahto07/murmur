@echo off
rem Murmur launcher: builds the web UI if needed, then serves everything on http://127.0.0.1:8000
cd /d "%~dp0"
if not exist frontend\dist\index.html (
  pushd frontend && call npm install && call npm run build && popd
)
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8000
