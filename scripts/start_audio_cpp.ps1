param(
  [string]$AudioCppRoot = "",
  [string]$ConfigPath = ""
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $AudioCppRoot) {
  $AudioCppRoot = Join-Path $ProjectRoot "runtime\audio.cpp"
}
$AudioCppRoot = [System.IO.Path]::GetFullPath($AudioCppRoot)
if (-not $ConfigPath) {
  $ConfigPath = Join-Path $AudioCppRoot "server.character_voice_designer.json"
}

if (-not (Test-Path -LiteralPath $AudioCppRoot -PathType Container)) {
  throw "audio.cpp was not found at $AudioCppRoot. Run setup_audio_cpp.ps1 first."
}
if (-not (Test-Path -LiteralPath $ConfigPath -PathType Leaf)) {
  Copy-Item -LiteralPath (Join-Path $PSScriptRoot "audio_cpp.server.example.json") -Destination $ConfigPath
}

$Server = Get-Item -LiteralPath (Join-Path $AudioCppRoot "audiocpp_server.exe") -ErrorAction SilentlyContinue
if (-not $Server) {
  $BuildRoot = Join-Path $AudioCppRoot "build"
  if (Test-Path -LiteralPath $BuildRoot -PathType Container) {
    $Server = Get-ChildItem -LiteralPath $BuildRoot -Filter "audiocpp_server.exe" -File -Recurse -ErrorAction SilentlyContinue |
      Sort-Object FullName |
      Select-Object -First 1
  }
}
if (-not $Server) {
  throw "audiocpp_server.exe was not found under $AudioCppRoot."
}

Push-Location $AudioCppRoot
try {
  & $Server.FullName --config $ConfigPath
} finally {
  Pop-Location
}
