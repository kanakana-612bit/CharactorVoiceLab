param(
  [switch]$NoBrowser
)

$ErrorActionPreference = "Stop"
$ProjectRoot = [System.IO.Path]::GetFullPath((Split-Path -Parent $PSScriptRoot))
$RuntimeRoot = Join-Path $ProjectRoot "runtime"
$PythonRoot = Join-Path $RuntimeRoot "mm"
$RuntimePython = Join-Path $PythonRoot "Scripts\python.exe"
$AudioCppRoot = Join-Path $RuntimeRoot "audio.cpp"
$LogRoot = Join-Path $RuntimeRoot "logs"
$StatePath = Join-Path $RuntimeRoot "webui.state.json"
$Headers = @{ "User-Agent" = "CharacterVoiceDesigner-bootstrap" }
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

if (-not [Environment]::Is64BitOperatingSystem) {
  throw "CharacterVoiceDesigner requires 64-bit Windows."
}

# Windows PowerShell 5.1 cannot spawn a process when an inherited environment
# contains both Path and PATH keys. Keep the more complete value under one key.
$ProcessEnvironment = [Environment]::GetEnvironmentVariables()
$PathKeys = @($ProcessEnvironment.Keys | Where-Object { $_ -imatch '^path$' })
if ($PathKeys.Count -gt 1) {
  $PreferredPathKey = if ($PathKeys -ccontains 'PATH') { 'PATH' } else { $PathKeys[0] }
  $PreferredPathValue = [string]$ProcessEnvironment[$PreferredPathKey]
  [Environment]::SetEnvironmentVariable('PATH', $null, [EnvironmentVariableTarget]::Process)
  [Environment]::SetEnvironmentVariable('Path', $PreferredPathValue, [EnvironmentVariableTarget]::Process)
}
New-Item -ItemType Directory -Force -Path $RuntimeRoot, $LogRoot | Out-Null

function Test-PythonExecutable([string]$Path) {
  if (-not (Test-Path -LiteralPath $Path -PathType Leaf)) { return $false }
  $PreviousErrorActionPreference = $ErrorActionPreference
  $ErrorActionPreference = "Continue"
  & $Path -c "import sys; raise SystemExit(0 if sys.version_info[:2] == (3, 12) else 1)" *> $null
  $ExitCode = $LASTEXITCODE
  $ErrorActionPreference = $PreviousErrorActionPreference
  return $ExitCode -eq 0
}

function Initialize-LocalPython {
  if (Test-PythonExecutable $RuntimePython) {
    Write-Host "[1/4] Local Python is ready."
    return
  }

  $BootstrapRoot = Join-Path $RuntimeRoot "bootstrap"
  $UvArchive = Join-Path $BootstrapRoot "uv-windows-x64.zip"
  $UvExecutable = Join-Path $BootstrapRoot "uv.exe"
  New-Item -ItemType Directory -Force -Path $BootstrapRoot | Out-Null
  if (-not (Test-Path -LiteralPath $UvExecutable -PathType Leaf)) {
    Write-Host "[1/4] Downloading the portable Python environment manager..."
    $UvRelease = Invoke-RestMethod -Headers $Headers -Uri "https://api.github.com/repos/astral-sh/uv/releases/latest"
    $UvAsset = $UvRelease.assets | Where-Object { $_.name -eq "uv-x86_64-pc-windows-msvc.zip" } | Select-Object -First 1
    if (-not $UvAsset) { throw "The official uv Windows x64 archive was not found in the latest release." }
    Invoke-WebRequest -Headers $Headers -Uri $UvAsset.browser_download_url -OutFile $UvArchive
    if ($UvAsset.digest -match '^sha256:([a-fA-F0-9]{64})$') {
      $ActualHash = (Get-FileHash -LiteralPath $UvArchive -Algorithm SHA256).Hash
      if ($ActualHash -ne $Matches[1]) { throw "The downloaded uv archive failed SHA-256 verification." }
    }
    Expand-Archive -LiteralPath $UvArchive -DestinationPath $BootstrapRoot -Force
    Remove-Item -LiteralPath $UvArchive -Force
  }
  $env:UV_PYTHON_INSTALL_DIR = Join-Path $RuntimeRoot "python"
  $env:UV_CACHE_DIR = Join-Path $RuntimeRoot "uv-cache"
  Write-Host "[1/4] Installing project-local Python 3.12..."
  & $UvExecutable venv $PythonRoot --python 3.12 --seed
  if ($LASTEXITCODE -ne 0) { throw "Portable Python setup failed." }

  if (-not (Test-PythonExecutable $RuntimePython)) {
    throw "The project-local Python environment is incomplete: $RuntimePython"
  }
}

function Test-HttpEndpoint([string]$Uri, [string]$ExpectedText = "") {
  try {
    $Response = Invoke-WebRequest -UseBasicParsing -Uri $Uri -TimeoutSec 2
    if ($Response.StatusCode -lt 200 -or $Response.StatusCode -ge 300) { return $false }
    if ($ExpectedText -and $Response.Content -notmatch [regex]::Escape($ExpectedText)) { return $false }
    return $true
  } catch {
    return $false
  }
}

function Find-FreePort([int]$PreferredPort) {
  foreach ($Port in $PreferredPort..($PreferredPort + 100)) {
    $Listener = $null
    try {
      $Listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
      $Listener.Start()
      return $Port
    } catch {
      continue
    } finally {
      if ($Listener) { $Listener.Stop() }
    }
  }
  throw "No free local port was found near $PreferredPort."
}

function Wait-HttpEndpoint(
  [string]$Uri,
  [string]$ExpectedText,
  [int]$TimeoutSeconds,
  [System.Diagnostics.Process]$Process,
  [string]$ErrorLog
) {
  $Deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
  while ([DateTime]::UtcNow -lt $Deadline) {
    if (Test-HttpEndpoint $Uri $ExpectedText) { return }
    if ($Process) {
      $Process.Refresh()
      if ($Process.HasExited) {
        $Details = if (Test-Path -LiteralPath $ErrorLog -PathType Leaf) {
          (Get-Content -LiteralPath $ErrorLog -Tail 30) -join [Environment]::NewLine
        } else { "No error log was produced." }
        throw "A local service exited during startup.`n$Details"
      }
    }
    Start-Sleep -Milliseconds 500
  }
  throw "Timed out waiting for $Uri. See $ErrorLog"
}

function Get-ProcessStartIso([System.Diagnostics.Process]$Process) {
  $Process.Refresh()
  return $Process.StartTime.ToUniversalTime().ToString("o")
}

function Test-RecordedProcess($ProcessId, $StartedAt, [string[]]$AllowedNames) {
  if (-not $ProcessId -or -not $StartedAt) { return $false }
  $Process = Get-Process -Id ([int]$ProcessId) -ErrorAction SilentlyContinue
  if (-not $Process -or $AllowedNames -notcontains $Process.ProcessName) { return $false }
  try {
    $ActualStart = $Process.StartTime.ToUniversalTime()
    $RecordedStart = [DateTime]::Parse($StartedAt).ToUniversalTime()
    return [Math]::Abs(($ActualStart - $RecordedStart).TotalSeconds) -le 2
  } catch {
    return $false
  }
}

function Stop-RecordedProcess($ProcessId, $StartedAt, [string[]]$AllowedNames) {
  if (-not (Test-RecordedProcess $ProcessId $StartedAt $AllowedNames)) { return }
  Stop-Process -Id ([int]$ProcessId) -Force
  for ($Attempt = 0; $Attempt -lt 50; $Attempt++) {
    if (-not (Get-Process -Id ([int]$ProcessId) -ErrorAction SilentlyContinue)) { return }
    Start-Sleep -Milliseconds 100
  }
}

Initialize-LocalPython

Write-Host "[2/4] Preparing audio.cpp, the VoiceDesign model, and F0 correction dependencies..."
& (Join-Path $PSScriptRoot "setup_audio_cpp.ps1") -Backend cpu -Profile balance -ReleaseTag "release-0.3-qwen3-tts" -InstallModel -ModelPython $RuntimePython
if ($LASTEXITCODE -ne 0) { throw "audio.cpp setup failed with exit code $LASTEXITCODE." }

$PreviousState = $null
if (Test-Path -LiteralPath $StatePath -PathType Leaf) {
  try { $PreviousState = Get-Content -LiteralPath $StatePath -Raw | ConvertFrom-Json } catch { $PreviousState = $null }
}

$AudioServer = Get-ChildItem -LiteralPath $AudioCppRoot -Filter "audiocpp_server.exe" -File -Recurse | Select-Object -First 1
if (-not $AudioServer) { throw "audiocpp_server.exe was not found after setup." }
$AudioRuntimeConfig = Join-Path $RuntimeRoot "audio_cpp.runtime.json"
$AudioManifest = [ordered]@{
  schema_version = "cvd_audio_cpp_runtime_manifest_0.1"
  project_root = $ProjectRoot
  executable = $AudioServer.FullName
  working_directory = $AudioCppRoot
  log_root = $LogRoot
  preferred_port = 8080
  threads = 4
  default_device = "cpu"
  devices = @(
    [ordered]@{
      id = "cpu"
      label = "CPU only"
      backend = "cpu"
      physical_index = $null
      memory_mib = 0
      free_memory_mib = 0
    }
  )
  models = @(
    [ordered]@{
      id = "irodori-vdes"
      label = "Irodori VoiceDesign / Japanese"
      family = "irodori_tts"
      path = Join-Path $AudioCppRoot "models\Irodori-TTS-600M-v3-VoiceDesign"
      task = "vdes"
      mode = "offline"
    }
  )
  environment = @{}
}
$AudioManifest | ConvertTo-Json -Depth 10 | Set-Content -LiteralPath $AudioRuntimeConfig -Encoding utf8
if ($PreviousState -and $PreviousState.audio_cpp_pid) {
  Stop-RecordedProcess $PreviousState.audio_cpp_pid $PreviousState.audio_cpp_started_at @("audiocpp_server")
}
Write-Host "[3/4] audio.cpp is installed and will start after model/device selection."

if ($PreviousState -and $PreviousState.designer_pid) {
  if ($PreviousState.designer_port) {
    try {
      Invoke-WebRequest -UseBasicParsing -Method Post -ContentType "application/json" -Body "{}" -Uri "http://127.0.0.1:$($PreviousState.designer_port)/api/audio-cpp/stop" -TimeoutSec 5 | Out-Null
    } catch {}
  }
  Stop-RecordedProcess $PreviousState.designer_pid $PreviousState.designer_started_at @("python", "pythonw")
}
$DesignerPort = Find-FreePort 8765
$DesignerOutLog = Join-Path $LogRoot "designer.stdout.log"
$DesignerErrorLog = Join-Path $LogRoot "designer.stderr.log"
$DesignerServer = Join-Path $ProjectRoot "designer_server.py"
$DesignerArguments = "-u `"$DesignerServer`" --host 127.0.0.1 --port $DesignerPort --audio-cpp-runtime-config `"$AudioRuntimeConfig`""
Write-Host "[4/4] Starting CharacterVoiceDesigner on port $DesignerPort..."
$DesignerOwnedProcess = Start-Process -FilePath $RuntimePython -ArgumentList $DesignerArguments -WorkingDirectory $ProjectRoot -WindowStyle Hidden -RedirectStandardOutput $DesignerOutLog -RedirectStandardError $DesignerErrorLog -PassThru
$DesignerPid = $DesignerOwnedProcess.Id
$DesignerStartedAt = Get-ProcessStartIso $DesignerOwnedProcess
Wait-HttpEndpoint "http://127.0.0.1:$DesignerPort/" "CharacterVoiceDesigner" 30 $DesignerOwnedProcess $DesignerErrorLog

$State = [ordered]@{
  app = "CharacterVoiceDesigner"
  schema_version = "webui_runtime_state_0.2"
  audio_cpp_runtime_config = $AudioRuntimeConfig
  audio_cpp_executable = $AudioServer.FullName
  designer_port = $DesignerPort
  designer_pid = $DesignerPid
  designer_started_at = $DesignerStartedAt
  updated_at = [DateTime]::UtcNow.ToString("o")
}
$State | ConvertTo-Json -Depth 5 | Set-Content -LiteralPath $StatePath -Encoding utf8

$WebUiUrl = "http://127.0.0.1:$DesignerPort/"
Write-Host ""
Write-Host "CharacterVoiceDesigner is ready: $WebUiUrl"
Write-Host "Run stop_webui.bat to stop services started by this launcher."
if (-not $NoBrowser) {
  Start-Process $WebUiUrl
}
