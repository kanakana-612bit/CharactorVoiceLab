param(
  [string]$Python = "",
  [int]$Port = 8765,
  [string]$AudioCppUrl = "http://127.0.0.1:8080"
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $Python) {
  $RuntimePython = Join-Path $ProjectRoot "runtime\mm\Scripts\python.exe"
  $Python = if (Test-Path -LiteralPath $RuntimePython -PathType Leaf) { $RuntimePython } else { "python" }
}

Push-Location $ProjectRoot
try {
  & $Python ".\designer_server.py" --host 127.0.0.1 --port $Port --audio-cpp-url $AudioCppUrl
} finally {
  Pop-Location
}
