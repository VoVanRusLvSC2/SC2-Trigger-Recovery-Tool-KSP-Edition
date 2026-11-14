# Launch the local TypeScript interface with bundled Node. No Java runtime.
param([switch]$ValidateOnly)
$ErrorActionPreference = 'Stop'
$applicationRoot = Split-Path -Parent $PSScriptRoot
$server = Join-Path $applicationRoot 'gui/dist/server.js'
if (-not (Test-Path -LiteralPath $server)) { throw 'GUI is not built. Run npm run build:gui first.' }
$node = Join-Path $applicationRoot 'node/node.exe'
if (-not (Test-Path -LiteralPath $node)) { $node = (Get-Command node.exe -ErrorAction Stop).Source }
if ($ValidateOnly) {
  foreach ($asset in @('gui/dist/server.js', 'gui/dist/app.js', 'gui/dist/adapters.js', 'gui/index.html', 'gui/style.css')) {
    if (-not (Test-Path -LiteralPath (Join-Path $applicationRoot $asset))) { throw "Missing GUI asset: $asset" }
  }
  Write-Output 'TypeScript GUI assets available. No server or browser opened.'
} else {
  Start-Process -FilePath $node -ArgumentList @('"' + $server + '"') -WorkingDirectory $applicationRoot -WindowStyle Hidden | Out-Null
}
