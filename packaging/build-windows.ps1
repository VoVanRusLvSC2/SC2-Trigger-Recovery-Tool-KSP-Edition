param([string]$StageName = ('portable-' + (Get-Date -Format 'yyyyMMdd-HHmmss')))
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$projectRoot = Split-Path -Parent $PSScriptRoot
Push-Location $projectRoot
function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$File failed ($LASTEXITCODE)" }
}
try {
  if ($StageName -notmatch '^[A-Za-z0-9_-]+$') { throw 'StageName must be a simple directory name' }
  Invoke-Checked python @('scripts/fetch-public-runtime.py')
  Invoke-Checked npm.cmd @('ci', '--ignore-scripts')
  Invoke-Checked node @('scripts/build-public-runtime.mjs')
  Invoke-Checked npm.cmd @('run', 'verify:gui')
  Invoke-Checked python @('scripts/fetch-release-tools.py', '--installer')
  Invoke-Checked npm.cmd @('run', 'verify:preview')
  foreach ($check in @('verify:recovered', 'verify:retained', 'verify:bindings', 'verify:helpers', 'verify:source', 'verify:dependencies', 'verify:authored', 'verify:attribute-source', 'verify:attribute-use', 'verify:condition-helper-evidence', 'verify:cli', 'verify:preparation')) {
    Invoke-Checked npm.cmd @('run', $check)
  }
  Invoke-Checked npm.cmd @('run', 'verify:language', '--', '--with-runtime')
  Invoke-Checked npm.cmd @('run', 'format:check')
  $compiler = Join-Path $projectRoot '.runtime/tools/inno/ISCC.exe'
  if (-not (Test-Path -LiteralPath $compiler)) {
    $compilerRoot = Join-Path $projectRoot '.runtime/tools/inno'
    $install = Start-Process -FilePath '.runtime/tools/innosetup.exe' -ArgumentList @('/VERYSILENT', '/SUPPRESSMSGBOXES', '/NORESTART', '/CURRENTUSER', ('/DIR="' + $compilerRoot + '"')) -WindowStyle Hidden -Wait -PassThru
    if ($install.ExitCode -ne 0) { throw 'Inno Setup compiler installation failed' }
  }
  $releaseRoot = Join-Path $projectRoot 'release'
  New-Item -ItemType Directory -Path $releaseRoot -Force | Out-Null
  $stage = Join-Path $releaseRoot $StageName
  Invoke-Checked node @('scripts/stage-release.mjs', $stage)
  Invoke-Checked (Join-Path $stage 'node/node.exe') @((Join-Path $stage 'scripts/verify-distribution.mjs'))
  Invoke-Checked (Join-Path $stage 'node/node.exe') @((Join-Path $stage 'trigger-recovery.mjs'), 'doctor')
  # Inno 6's source/license readers do not share long-path handling. Give the
  # compiler a temporary short view; nothing in the payload uses this drive.
  $compilerDrive = $null
  try {
    foreach ($letter in 'ZYXWVUTSRQPONM'.ToCharArray()) {
      $candidate = [string]$letter + ':'
      & subst.exe $candidate $stage 2>$null
      if ($LASTEXITCODE -eq 0) { $compilerDrive = $candidate; break }
    }
    if (-not $compilerDrive) { throw 'No free temporary drive for the installer compiler' }
    Invoke-Checked $compiler @('/Qp', ('/DStageRoot=' + $compilerDrive + '\'), ('/DReleaseDir=' + $releaseRoot), 'packaging/windows.iss')
  } finally { if ($compilerDrive) { & subst.exe $compilerDrive /D } }
  $zip = Join-Path $releaseRoot 'SC2-Trigger-Recovery-KSP-3.0.0-rc.3-Windows-x64.zip'
  if (Test-Path -LiteralPath $zip) { throw 'Release ZIP already exists; preserve it and use a clean build directory' }
  Invoke-Checked python @('scripts/archive-release.py', $stage, $zip)
  $artifacts = Get-ChildItem -LiteralPath $releaseRoot -File | Where-Object { $_.Name -like 'SC2-Trigger-Recovery-KSP-3.0.0-rc.3-*' -and $_.Extension -in @('.exe', '.zip') }
  $lines = foreach ($file in $artifacts) { ((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()) + '  ' + $file.Name }
  [IO.File]::WriteAllLines((Join-Path $releaseRoot 'SHA256SUMS.txt'), [string[]]$lines, (New-Object Text.UTF8Encoding($false)))
  Write-Output "Release artifacts: $releaseRoot"
} finally { Pop-Location }
