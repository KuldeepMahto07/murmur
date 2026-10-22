@echo off
rem Clarion launcher: builds the UI if needed, then serves everything on http://127.0.0.1:8001
cd /d "%~dp0"
if not exist frontend\dist\index.html (
  pushd frontend && call npm install && call npm run build && popd
)
if not exist models\GFPGANv1.4.pth backend\.venv\Scripts\python scripts\download_models.py
backend\.venv\Scripts\python -m uvicorn app.main:app --app-dir backend --host 127.0.0.1 --port 8001
