@echo off
setlocal
cd /d "%~dp0"

where powershell.exe >nul 2>nul
if errorlevel 1 (
  echo [CharacterVoiceDesigner] Windows PowerShell was not found.
  pause
  exit /b 1
)

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\bootstrap_webui.ps1" %*
if errorlevel 1 (
  echo.
  echo [CharacterVoiceDesigner] Startup failed. Review the message above and runtime\logs.
  pause
  exit /b 1
)

endlocal
