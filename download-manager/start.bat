@echo off
rem Fetchline: starts the engine and opens the UI. Keep this window open while you use it.
cd /d "%~dp0"
title Fetchline engine
start "" http://127.0.0.1:8765/
node --disable-warning=ExperimentalWarning engine\main.ts --port 8765
echo.
echo Fetchline engine stopped.
pause
