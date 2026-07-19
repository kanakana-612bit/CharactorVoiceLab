param(
  [string]$AudioCppRoot = "",
  [ValidateSet("cpu", "cuda")]
  [string]$Backend = "cpu",
  [ValidateSet("balance", "fast", "portable")]
  [string]$Profile = "balance",
  [switch]$InstallModel,
  [switch]$BuildFromSource
)

$ErrorActionPreference = "Stop"
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $AudioCppRoot) {
  $AudioCppRoot = Join-Path $ProjectRoot "runtime\audio.cpp"
}
$AudioCppRoot = [System.IO.Path]::GetFullPath($AudioCppRoot)
$RuntimeRoot = Split-Path -Parent $AudioCppRoot
New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $AudioCppRoot | Out-Null

if ($BuildFromSource) {
  foreach ($Tool in @("git", "cmake", "ninja")) {
    if (-not (Get-Command $Tool -ErrorAction SilentlyContinue)) {
      throw "$Tool is required for -BuildFromSource but was not found in PATH."
    }
  }
  if (-not (Get-Command "cl.exe" -ErrorAction SilentlyContinue)) {
    throw "MSVC cl.exe was not found. Run this script from a Visual Studio 2022 Developer PowerShell."
  }
  if (-not (Test-Path -LiteralPath (Join-Path $AudioCppRoot ".git") -PathType Container)) {
    git clone https://github.com/0xShug0/audio.cpp.git $AudioCppRoot
  }
  $Preset = if ($Backend -eq "cuda") { "windows-cuda-release" } else { "windows-cpu-release" }
  Push-Location $AudioCppRoot
  try {
    & ".\scripts\build_windows.ps1" -Preset $Preset -Target audiocpp_server
    if ($LASTEXITCODE -ne 0) { throw "audio.cpp build failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }
} else {
  $ExistingServer = Get-ChildItem -LiteralPath $AudioCppRoot -Filter "audiocpp_server.exe" -File -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
  if (-not $ExistingServer) {
    $Headers = @{ "User-Agent" = "CharacterVoiceDesigner-audio.cpp-setup" }
    $Release = Invoke-RestMethod -Headers $Headers -Uri "https://api.github.com/repos/0xShug0/audio.cpp/releases/latest"
    $AssetPatterns = if ($Backend -eq "cuda") {
      @("audiocpp-windows-cuda-runtime.zip", "audiocpp-windows-cuda-$Profile*.zip")
    } else {
      @("audiocpp-windows-cpu-$Profile*.zip")
    }
    foreach ($AssetPattern in $AssetPatterns) {
      $Asset = $Release.assets | Where-Object { $_.name -like $AssetPattern } | Select-Object -First 1
      if (-not $Asset) { throw "Release asset was not found: $AssetPattern" }
      $ArchivePath = Join-Path ([System.IO.Path]::GetTempPath()) $Asset.name
      Write-Host "Downloading $($Asset.name) from audio.cpp $($Release.tag_name)..."
      Invoke-WebRequest -Headers $Headers -Uri $Asset.browser_download_url -OutFile $ArchivePath
      Expand-Archive -LiteralPath $ArchivePath -DestinationPath $AudioCppRoot -Force
      Remove-Item -LiteralPath $ArchivePath -Force
    }
  }
}

if ($InstallModel) {
  if (-not (Get-Command "git" -ErrorAction SilentlyContinue)) { throw "git is required to install the model." }
  if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) { throw "python is required to install the model." }
  $ManagerRoot = Join-Path $RuntimeRoot "audio.cpp-model-manager"
  if (-not (Test-Path -LiteralPath (Join-Path $ManagerRoot ".git") -PathType Container)) {
    git clone --depth 1 https://github.com/0xShug0/audio.cpp.git $ManagerRoot
  }
  # Keep the venv path short enough for Torch's deeply nested license tree on Windows.
  $ModelVenvRoot = Join-Path $RuntimeRoot "mm"
  $ModelPython = Join-Path $ModelVenvRoot "Scripts\python.exe"
  if (-not (Test-Path -LiteralPath $ModelPython -PathType Leaf)) {
    & python -m venv $ModelVenvRoot
    if ($LASTEXITCODE -ne 0) { throw "Model-manager virtual environment creation failed." }
  }
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $ModelPython -c "import torch, safetensors, yaml, numpy, pyworld, parselmouth" *> $null
  $DependencyCheckExitCode = $LASTEXITCODE
  $ErrorActionPreference = $PreviousErrorActionPreference
  if ($DependencyCheckExitCode -ne 0) {
    & $ModelPython -m pip install --upgrade pip
    & $ModelPython -m pip install torch safetensors PyYAML numpy pyworld praat-parselmouth
    if ($LASTEXITCODE -ne 0) { throw "Model-manager dependency installation failed." }
  }
  Push-Location $ManagerRoot
  try {
    & $ModelPython ".\tools\model_manager.py" install irodori_tts_600m_v3_voice_design --models-root (Join-Path $AudioCppRoot "models")
    if ($LASTEXITCODE -ne 0) { throw "Irodori model installation failed with exit code $LASTEXITCODE." }
  } finally {
    Pop-Location
  }

  # tempfile-created staging directories can retain protected ACLs after the
  # model manager moves them. Re-enable inheritance so the normal user server
  # process can read the installed model files.
  $ModelsRoot = Join-Path $AudioCppRoot "models"
  foreach ($ModelDirectory in @(
    "Irodori-TTS-600M-v3-VoiceDesign",
    "llm-jp-3-150m",
    "Semantic-DACVAE-Japanese-32dim"
  )) {
    $ModelPath = Join-Path $ModelsRoot $ModelDirectory
    if (Test-Path -LiteralPath $ModelPath -PathType Container) {
      & icacls.exe $ModelPath /inheritance:e /T /C | Out-Null
      if ($LASTEXITCODE -ne 0) { throw "Failed to restore inherited permissions for $ModelPath." }
    }
  }

  # The upstream snapshot includes model-card demonstration audio. It is not
  # required for inference and is intentionally not retained by this project.
  $UnusedSampleRoot = Join-Path $ModelsRoot "Irodori-TTS-600M-v3-VoiceDesign\samples"
  if (Test-Path -LiteralPath $UnusedSampleRoot -PathType Container) {
    Remove-Item -LiteralPath $UnusedSampleRoot -Recurse -Force
  }
}

$Config = Get-Content -LiteralPath (Join-Path $PSScriptRoot "audio_cpp.server.example.json") -Raw | ConvertFrom-Json
$Config.backend = $Backend
$Config | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath (Join-Path $AudioCppRoot "server.character_voice_designer.json") -Encoding utf8

Write-Host "audio.cpp setup completed: $AudioCppRoot"
if (-not $InstallModel) {
  Write-Host "The VoiceDesign model was not downloaded. Re-run with -InstallModel when ready."
}
