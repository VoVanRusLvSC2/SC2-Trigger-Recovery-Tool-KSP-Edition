# Final Modkit vs KSP benchmark (2026-09-26): warm-up, main run, cross-compile check, library-id diagnostic.
# Start it from an elevated terminal: node_modules and KSP's jars are hard links into C:\Users\Admin, which
# an elevated process reads without any ACL change. It detaches itself, so the terminal can be closed.
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\MODDING\galaxy-trigger-benchmark\run-final.ps1
param([switch]$Detached)
$ErrorActionPreference = 'Continue'
if (-not $Detached) {
  Start-Process -FilePath powershell.exe -WindowStyle Hidden -ArgumentList @(
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Detached')
  Write-Host 'Benchmark started in the background; log: C:\MODDING\galaxy-trigger-benchmark\.benchmark-runs\modkit-vs-ksp-final-2026-09-26.log'
  exit 0
}
$bench = $PSScriptRoot
$runs = Join-Path $bench '.benchmark-runs'
$log = Join-Path $runs 'modkit-vs-ksp-final-2026-09-26.log'
function Log($text) { Add-Content -Path $log -Value ("[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $text) -Encoding utf8 }
# node writes UTF-8; cmd redirection keeps the bytes as they are (PowerShell 5.1 would re-encode as UTF-16).
function Run($commandLine) {
  cmd /c "cd /d `"$bench`" && $commandLine >> `"$log`" 2>&1"
  return $LASTEXITCODE
}
$probes = @(
  (Join-Path $bench '..\modkit-extensions-blizzard\node_modules\.pnpm\@modkit+core@file+vendor+modkit-core-0.1.0.tgz\node_modules\@modkit\core\package.json'),
  'C:\Users\Admin\.m2\repository\com\fasterxml\jackson\core\jackson-core\2.17.2\jackson-core-2.17.2.jar'
)
foreach ($probe in $probes) {
  try { [void][IO.File]::ReadAllBytes($probe) } catch { Log "cannot read $probe (not elevated?)"; exit 3 }
}
Log 'access granted (elevated run)'

Log 'smoke: bridges, both converters'
$code = Run 'node src\benchmark.mjs benchmark.modkit-vs-ksp-final-smoke.json --no-open'
$smoke = Get-ChildItem $runs -Directory -Filter 'modkit-vs-ksp-final-smoke-2*' | Sort-Object Name | Select-Object -Last 1
$summaryFile = if ($smoke) { Join-Path $smoke.FullName 'summary.json' } else { '' }
if (-not $smoke -or -not (Test-Path $summaryFile)) { Log "smoke produced no summary (exit $code)"; exit 4 }
$summary = Get-Content $summaryFile -Raw -Encoding utf8 | ConvertFrom-Json
foreach ($item in $summary.results) { Log ("smoke {0}: {1} {2:N1} s, tree {3:N0} MiB {4}" -f $item.converterId, $item.status, ($item.wallTimeMs / 1000), ($item.peakWorkingSetBytes / 1MB), (($item.treeProcessNames) -join ',')) }
$bad = @($summary.results | Where-Object { $_.status -ne 'completed' })
if ($bad.Count) { Log ("smoke failed: " + (($bad | ForEach-Object { "$($_.converterId): $($_.error)" }) -join ' | ')); exit 5 }

Log 'main: modkit-vs-ksp-final'
$code = Run 'node --max-old-space-size=8192 src\benchmark.mjs benchmark.modkit-vs-ksp-final.json --no-open'
Log "main exit $code"
Log 'crosscheck: triggers-to-galaxy matrix'
$code = Run 'node --max-old-space-size=8192 src\t2g-crosscheck.mjs --latest modkit-vs-ksp-final --leak-run .benchmark-runs\modkit-vs-ksp-5-2026-09-26T07-53-05-836Z --run'
Log "crosscheck exit $code"
Log 'diagnostic: AllRacesTester with libraryId 1 (Modkit only)'
$code = Run 'node src\benchmark.mjs benchmark.modkit-vs-ksp-final-lib1.json --no-open'
Log "diagnostic exit $code"
Log 'done'
