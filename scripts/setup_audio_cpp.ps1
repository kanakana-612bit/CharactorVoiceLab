param(
  [string]$AudioCppRoot = "",
  [ValidateSet("cpu", "cuda")]
  [string]$Backend = "cpu",
  [ValidateSet("balance", "fast", "portable")]
  [string]$Profile = "balance",
  [string]$ReleaseTag = "",
  [string]$ModelPython = "",
  [switch]$InstallModel,
  [switch]$BuildFromSource
)

$ErrorActionPreference = "Stop"
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProjectRoot = Split-Path -Parent $PSScriptRoot
if (-not $AudioCppRoot) {
  $AudioCppRoot = Join-Path $ProjectRoot "runtime\audio.cpp"
}
$AudioCppRoot = [System.IO.Path]::GetFullPath($AudioCppRoot)
$RuntimeRoot = Split-Path -Parent $AudioCppRoot
$PyWorldRequirement = "pyworld==0.3.5"
$SetuptoolsRequirement = "setuptools<81"
New-Item -ItemType Directory -Force -Path $RuntimeRoot | Out-Null
New-Item -ItemType Directory -Force -Path $AudioCppRoot | Out-Null

$Headers = @{ "User-Agent" = "CharacterVoiceDesigner-audio.cpp-setup" }
$script:AudioCppRelease = $null
function Get-AudioCppRelease {
  if (-not $script:AudioCppRelease) {
    $ReleaseUri = if ($ReleaseTag) {
      $EscapedTag = [Uri]::EscapeDataString($ReleaseTag)
      "https://api.github.com/repos/0xShug0/audio.cpp/releases/tags/$EscapedTag"
    } else {
      "https://api.github.com/repos/0xShug0/audio.cpp/releases/latest"
    }
    $script:AudioCppRelease = Invoke-RestMethod -Headers $Headers -Uri $ReleaseUri
  }
  return $script:AudioCppRelease
}

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
    $Release = Get-AudioCppRelease
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
      if ($Asset.digest -match '^sha256:([a-fA-F0-9]{64})$') {
        $ActualHash = (Get-FileHash -LiteralPath $ArchivePath -Algorithm SHA256).Hash
        if ($ActualHash -ne $Matches[1]) { throw "The downloaded audio.cpp archive failed SHA-256 verification: $($Asset.name)" }
      }
      Expand-Archive -LiteralPath $ArchivePath -DestinationPath $AudioCppRoot -Force
      Remove-Item -LiteralPath $ArchivePath -Force
    }
  }
}

if ($InstallModel) {
  # Keep the venv path short enough for Torch's deeply nested license tree on Windows.
  $ModelVenvRoot = Join-Path $RuntimeRoot "mm"
  if ($ModelPython) {
    $ModelPython = [System.IO.Path]::GetFullPath($ModelPython)
    if (-not (Test-Path -LiteralPath $ModelPython -PathType Leaf)) {
      throw "The supplied model Python was not found: $ModelPython"
    }
  } else {
    $ModelPython = Join-Path $ModelVenvRoot "Scripts\python.exe"
  }
  if (-not (Test-Path -LiteralPath $ModelPython -PathType Leaf)) {
    if (-not (Get-Command "python" -ErrorAction SilentlyContinue)) {
      throw "python is required for manual setup. Use webui.bat for automatic local Python installation."
    }
    & python -m venv $ModelVenvRoot
    if ($LASTEXITCODE -ne 0) { throw "Model-manager virtual environment creation failed." }
  }
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $ModelPython -m pip --version *> $null
  $PipCheckExitCode = $LASTEXITCODE
  $ErrorActionPreference = $PreviousErrorActionPreference
  if ($PipCheckExitCode -ne 0) {
    & $ModelPython -m ensurepip --upgrade
    if ($LASTEXITCODE -ne 0) { throw "pip could not be prepared in the local Python environment." }
  }
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $ModelPython -c "import torch, safetensors, yaml, numpy, pyworld, parselmouth" *> $null
  $DependencyCheckExitCode = $LASTEXITCODE
  $ErrorActionPreference = $PreviousErrorActionPreference
  if ($DependencyCheckExitCode -ne 0) {
    & $ModelPython -m pip install --upgrade pip
    & $ModelPython -m pip install $SetuptoolsRequirement torch safetensors PyYAML numpy $PyWorldRequirement praat-parselmouth
    if ($LASTEXITCODE -ne 0) { throw "Model-manager dependency installation failed." }
  }
  $PostprocessCheck = Join-Path $ProjectRoot "audio_postprocess.py"
  & $ModelPython $PostprocessCheck --check
  if ($LASTEXITCODE -ne 0) {
    Write-Host "Repairing the local F0-correction dependencies..."
    & $ModelPython -m pip install --upgrade --force-reinstall --no-cache-dir $SetuptoolsRequirement numpy $PyWorldRequirement praat-parselmouth
    if ($LASTEXITCODE -ne 0) { throw "F0-correction dependency repair failed." }
    & $ModelPython $PostprocessCheck --check
    if ($LASTEXITCODE -ne 0) { throw "The local PSOLA F0-correction runtime is incomplete." }
  }

  $ModelsRoot = Join-Path $AudioCppRoot "models"
  $RequiredModelFiles = @(
    (Join-Path $ModelsRoot "Irodori-TTS-600M-v3-VoiceDesign\model.safetensors"),
    (Join-Path $ModelsRoot "llm-jp-3-150m\model.safetensors"),
    (Join-Path $ModelsRoot "Semantic-DACVAE-Japanese-32dim\weights.safetensors")
  )
  $ModelsReady = @($RequiredModelFiles | Where-Object { -not (Test-Path -LiteralPath $_ -PathType Leaf) }).Count -eq 0
  $ModelInstalledThisRun = $false
  if (-not $ModelsReady) {
    $ManagerRoot = Join-Path $RuntimeRoot "audio.cpp-model-manager"
    $ManagerScript = Join-Path $ManagerRoot "tools\model_manager.py"
    if (-not (Test-Path -LiteralPath $ManagerScript -PathType Leaf)) {
      if (Test-Path -LiteralPath $ManagerRoot) {
        throw "The model-manager directory is incomplete: $ManagerRoot"
      }
      $Release = Get-AudioCppRelease
      $SafeReleaseTag = $Release.tag_name -replace '[^A-Za-z0-9._-]', '_'
      $SourceArchive = Join-Path $RuntimeRoot "audio.cpp-$SafeReleaseTag-source.zip"
      $StageRoot = Join-Path $RuntimeRoot "audio.cpp-model-manager-stage-$PID"
      Write-Host "Downloading audio.cpp model-manager source $($Release.tag_name)..."
      Invoke-WebRequest -Headers $Headers -Uri "https://github.com/0xShug0/audio.cpp/archive/refs/tags/$($Release.tag_name).zip" -OutFile $SourceArchive
      Expand-Archive -LiteralPath $SourceArchive -DestinationPath $StageRoot -Force
      Remove-Item -LiteralPath $SourceArchive -Force
      $SourceRoot = Get-ChildItem -LiteralPath $StageRoot -Directory | Where-Object {
        Test-Path -LiteralPath (Join-Path $_.FullName "tools\model_manager.py") -PathType Leaf
      } | Select-Object -First 1
      if (-not $SourceRoot) { throw "The downloaded audio.cpp source did not contain tools\model_manager.py." }
      $ResolvedRuntimeRoot = [System.IO.Path]::GetFullPath($RuntimeRoot).TrimEnd('\') + '\'
      $ResolvedSourceRoot = [System.IO.Path]::GetFullPath($SourceRoot.FullName)
      $ResolvedManagerRoot = [System.IO.Path]::GetFullPath($ManagerRoot)
      if (-not $ResolvedSourceRoot.StartsWith($ResolvedRuntimeRoot, [System.StringComparison]::OrdinalIgnoreCase) -or
          -not $ResolvedManagerRoot.StartsWith($ResolvedRuntimeRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
        throw "Refusing to move model-manager files outside the project runtime."
      }
      Move-Item -LiteralPath $ResolvedSourceRoot -Destination $ResolvedManagerRoot
      Remove-Item -LiteralPath $StageRoot -Force
    }
    Push-Location $ManagerRoot
    try {
      & $ModelPython ".\tools\model_manager.py" install irodori_tts_600m_v3_voice_design --models-root $ModelsRoot
      if ($LASTEXITCODE -ne 0) { throw "Irodori model installation failed with exit code $LASTEXITCODE." }
      $ModelInstalledThisRun = $true
    } finally {
      Pop-Location
    }
  } else {
    Write-Host "Irodori VoiceDesign model already exists; skipping model download."
  }

  # tempfile-created staging directories can retain protected ACLs after the
  # model manager moves them. Re-enable inheritance so the normal user server
  # process can read the installed model files.
  if ($ModelInstalledThisRun) {
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
