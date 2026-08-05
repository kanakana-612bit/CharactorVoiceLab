$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$StatePath = Join-Path $ProjectRoot "runtime\webui.state.json"

if (-not (Test-Path -LiteralPath $StatePath -PathType Leaf)) {
  Write-Host "No launcher-owned CharacterVoiceDesigner services are recorded."
  exit 0
}

$State = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json
if ($State.designer_port) {
  try {
    Invoke-WebRequest -UseBasicParsing -Method Post -ContentType "application/json" -Body "{}" -Uri "http://127.0.0.1:$($State.designer_port)/api/audio-cpp/stop" -TimeoutSec 5 | Out-Null
  } catch {}
}
$HadWarning = $false

function Stop-RecordedProcess([string]$Label, $ProcessId, $StartedAt, [string[]]$AllowedNames) {
  if (-not $ProcessId -or -not $StartedAt) {
    Write-Host "$Label was reused from another launcher and will not be stopped."
    return
  }
  $Process = Get-Process -Id ([int]$ProcessId) -ErrorAction SilentlyContinue
  if (-not $Process) {
    Write-Host "$Label is already stopped."
    return
  }
  $ActualStart = $Process.StartTime.ToUniversalTime()
  $RecordedStart = [DateTime]::Parse($StartedAt).ToUniversalTime()
  $StartDelta = [Math]::Abs(($ActualStart - $RecordedStart).TotalSeconds)
  if ($AllowedNames -notcontains $Process.ProcessName -or $StartDelta -gt 2) {
    Write-Warning "Refusing to stop PID $ProcessId because it no longer matches the recorded $Label process."
    $script:HadWarning = $true
    return
  }
  Stop-Process -Id $Process.Id
  Write-Host "Stopped $Label (PID $ProcessId)."
}

Stop-RecordedProcess "CharacterVoiceDesigner" $State.designer_pid $State.designer_started_at @("python", "pythonw")
Stop-RecordedProcess "audio.cpp" $State.audio_cpp_pid $State.audio_cpp_started_at @("audiocpp_server")
Remove-Item -LiteralPath $StatePath -Force

if ($HadWarning) { exit 1 }
