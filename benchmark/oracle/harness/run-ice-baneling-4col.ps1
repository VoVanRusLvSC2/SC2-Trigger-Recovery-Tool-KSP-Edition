# Ice Baneling in four columns: Modkit and KSP, each without and with TextureMap.galaxy turned into triggers.
# Galaxy -> Triggers and Triggers -> Galaxy run as separate commands in fresh processes. KSP with
# TextureMap.galaxy is taken from the finished run modkit-vs-ksp-final-2026-09-26T14-51-17-890Z (not rerun).
# Start it from an elevated terminal: node_modules and KSP's jars are hard links into C:\Users\Admin.
#   powershell -NoProfile -ExecutionPolicy Bypass -File C:\MODDING\galaxy-trigger-benchmark\run-ice-baneling-4col.ps1
param([switch]$Detached)
$ErrorActionPreference = 'Continue'
if (-not $Detached) {
  Start-Process -FilePath powershell.exe -WindowStyle Hidden -ArgumentList @(
    '-NoLogo', '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', $PSCommandPath, '-Detached')
  Write-Host 'Started in the background; log: C:\MODDING\galaxy-trigger-benchmark\.benchmark-runs\ice-baneling-4col-2026-09-26.log'
  exit 0
}
$bench = $PSScriptRoot
$fix = Join-Path $bench '..\.wt-sc2-triggers-fix'
$runs = Join-Path $bench '.benchmark-runs'
$log = Join-Path $runs 'ice-baneling-4col-2026-09-26.log'
$checks = Join-Path $runs 'fix-checks-2026-09-26.log'
$finalRun = '.benchmark-runs\modkit-vs-ksp-final-2026-09-26T14-51-17-890Z'
function Log($text) { Add-Content -Path $log -Value ("[{0:yyyy-MM-dd HH:mm:ss}] {1}" -f (Get-Date), $text) -Encoding utf8 }
# node writes UTF-8; cmd redirection keeps the bytes (PowerShell 5.1 would re-encode as UTF-16).
function Run($directory, $commandLine, $target = $log) {
  cmd /c "cd /d `"$directory`" && $commandLine >> `"$target`" 2>&1"
  return $LASTEXITCODE
}
function Latest($prefix) {
  $dir = Get-ChildItem $runs -Directory -Filter "$prefix-2*" | Where-Object { Test-Path (Join-Path $_.FullName 'summary.json') } | Sort-Object Name | Select-Object -Last 1
  if ($dir) { return ".benchmark-runs\$($dir.Name)" }
  return $null
}

# 0. The owner stopped KSP: end the previous run (run-final.ps1, its harness and KSP) before measuring.
foreach ($process in Get-CimInstance Win32_Process) {
  if ($process.CommandLine -match 'run-final\.ps1|benchmark\.modkit-vs-ksp-final|t2g-crosscheck\.mjs --latest modkit-vs-ksp-final|adapters\\ksp\.mjs|ru\.ksp\.triggerrevize') {
    Log "stop previous run: $($process.ProcessId) $($process.Name)"
    Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue
  }
}
Start-Sleep -Seconds 5

# 1. Official build and tests of the fix worktree (the benchmark reads its dist).
Log 'tsc: starcraft2/tsconfig.sc2-triggers.json'
$code = Run $fix 'npx tsc -p starcraft2/tsconfig.sc2-triggers.json' $checks
Log "tsc exit $code"
$env:MODKIT_TEST_TIER = 'owner'
Log 'vitest: triggers + galaxy, owner tier'
$code = Run $fix 'npx vitest run --config test/vitest.config.mjs starcraft2/modules/triggers starcraft2/modules/galaxy' $checks
Log "vitest exit $code"
Remove-Item Env:MODKIT_TEST_TIER

# 2. Modkit, Galaxy -> Triggers: without and with TextureMap.galaxy, three processes each.
Log 'modkit g2t: ice-baneling-no-texturemap, ice-baneling (TextureMap converted)'
$code = Run $bench 'node --max-old-space-size=8192 src\benchmark.mjs benchmark.ice-baneling-4col-modkit-g2t.json --no-open'
$modkitRun = Latest 'ice-baneling-4col-modkit-g2t'
Log "modkit g2t exit $code -> $modkitRun"
if (-not $modkitRun) { Log 'no Modkit run, stop'; exit 4 }

# 3. Triggers -> Galaxy in fresh processes with TextureMap: the Modkit compiler on the original, Modkit
# and KSP (final run) Triggers.
Log 't2g with TextureMap, Modkit compiler'
$code = Run $bench "node --max-old-space-size=8192 src\t2g-crosscheck.mjs `"$modkitRun`" --cases ice-baneling --sources original,modkit,ksp --ksp-run $finalRun --compilers modkit --repetitions 3 --name ice-baneling-4col-t2g-texturemap --run"
Log "t2g texturemap exit $code"

# 4. KSP, Galaxy -> Triggers without TextureMap.galaxy (about an hour).
Log 'ksp g2t: ice-baneling-no-texturemap'
$code = Run $bench 'node --max-old-space-size=8192 src\benchmark.mjs benchmark.ice-baneling-4col-ksp-g2t.json --no-open'
$kspRun = Latest 'ice-baneling-4col-ksp-g2t'
Log "ksp g2t exit $code -> $kspRun"

# 5. Triggers -> Galaxy without TextureMap: the Modkit compiler on Modkit and KSP Triggers, KSP's own
# compiler on its Triggers.
if ($kspRun) {
  Log 't2g without TextureMap, Modkit compiler'
  $code = Run $bench "node --max-old-space-size=8192 src\t2g-crosscheck.mjs `"$modkitRun`" --cases ice-baneling-no-texturemap --sources modkit,ksp --ksp-run `"$kspRun`" --compilers modkit --repetitions 3 --name ice-baneling-4col-t2g-no-texturemap --run"
  Log "t2g no-texturemap exit $code"
  Log 't2g without TextureMap, KSP compiler on its own Triggers'
  $code = Run $bench "node --max-old-space-size=8192 src\t2g-crosscheck.mjs `"$modkitRun`" --cases ice-baneling-no-texturemap --sources ksp --ksp-run `"$kspRun`" --compilers ksp --repetitions 1 --name ice-baneling-4col-t2g-ksp-own --run"
  Log "t2g ksp-own exit $code"
}
Log 'done'
