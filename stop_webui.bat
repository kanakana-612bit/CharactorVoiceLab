@echo off
setlocal
cd /d "%~dp0"

powershell.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\stop_webui.ps1"
if errorlevel 1 (
  echo.
  echo [CharacterVoiceDesigner] Shutdown completed with warnings.
  pause
  exit /b 1
)

echo.
echo [CharacterVoiceDesigner] Local services stopped.
pause
endlocal
