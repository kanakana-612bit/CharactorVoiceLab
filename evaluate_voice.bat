@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\mm\Scripts\python.exe" (
  "runtime\mm\Scripts\python.exe" evaluate_voice.py %*
) else (
  py -3 evaluate_voice.py %*
)
endlocal
