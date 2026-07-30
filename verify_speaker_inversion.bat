@echo off
setlocal
cd /d "%~dp0"
if exist "runtime\mm\Scripts\python.exe" (
  "runtime\mm\Scripts\python.exe" verify_speaker_inversion.py %*
) else (
  py -3 verify_speaker_inversion.py %*
)
endlocal
