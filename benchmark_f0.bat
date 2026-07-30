@echo off
setlocal
cd /d "%~dp0"
if not exist "runtime\mm\Scripts\python.exe" (
  echo CharacterVoiceDesigner runtime is not installed. Run webui.bat first.
  exit /b 1
)
"runtime\mm\Scripts\python.exe" seed_f0_benchmark.py %*
exit /b %errorlevel%
