# Optional reproduction of the pinned tool binary; needs CMake and MSVC C++ tools.
param([string]$CMake = 'cmake')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$source = Join-Path $projectRoot '.runtime/mpqcli-source'
$build = Join-Path $projectRoot '.runtime/mpqcli-build'
$revision = 'c515a1b9668c1f43fed9f740db34f67e4ddcaabf'
function Invoke-Checked([string]$File, [string[]]$Arguments) {
  & $File @Arguments
  if ($LASTEXITCODE -ne 0) { throw "$File failed ($LASTEXITCODE)" }
}
if (-not (Test-Path -LiteralPath $source)) {
  Invoke-Checked git @('clone', '--branch', 'v0.10.0', '--depth', '1', '--recurse-submodules', '--shallow-submodules', 'https://github.com/thegraydot/mpqcli.git', $source)
}
if ((& git -C $source rev-parse HEAD) -ne $revision) { throw 'mpqcli source revision differs' }
foreach ($dependency in @(@('CLI11','74d72dd38f7ccb122c9439c79d6c2c294d10f3bc'), @('StormLib','570734e0ac4b1389361f1be3d1ec98f7235beea2'))) {
  if ((& git -C (Join-Path $source ('extern/' + $dependency[0])) rev-parse HEAD) -ne $dependency[1]) { throw 'mpqcli submodule revision differs' }
}
Push-Location $source
try {
  Invoke-Checked $CMake @('-S', $source, '-B', $build, '-A', 'x64', '-DCMAKE_POLICY_DEFAULT_CMP0091=NEW', '-DCMAKE_MSVC_RUNTIME_LIBRARY=MultiThreaded')
  Invoke-Checked $CMake @('--build', $build, '--config', 'Release', '--parallel', '4')
} finally { Pop-Location }
$binary = Join-Path $build 'bin/Release/mpqcli.exe'
Invoke-Checked python @((Join-Path $projectRoot 'scripts/check-pe-runtime.py'), $binary)
$destination = Join-Path $projectRoot '.runtime/tools/mpqcli-static.exe'
New-Item -ItemType Directory -Force -Path (Split-Path -Parent $destination) | Out-Null
Copy-Item -LiteralPath $binary -Destination $destination
Get-FileHash -LiteralPath $destination -Algorithm SHA256
