$ErrorActionPreference = 'Stop'
[Console]::Out.WriteLine('ready')
$pidText = [Console]::In.ReadLine()
if ([string]::IsNullOrWhiteSpace($pidText)) { exit 2 }
$rootId = [int]$pidText
$target = [System.Diagnostics.Process]::GetProcessById($rootId)

# A converter may do its work in child processes (KSP runs java under the node adapter), so the whole
# process tree is measured: the peak of the summed working sets, never below any one process's own peak.
$tracked = @{ $rootId = $target }
$processPeaks = @{}
$processNames = @{}
$peakWorkingSetBytes = [long]0
$peakPagefileUsageBytes = [long]0
$treePeakWorkingSetBytes = [long]0
# Committed private memory of the tree (a JVM commits its heap as it grows, even when pages are trimmed).
$treePeakPrivateBytes = [long]0
$nextDiscovery = [DateTime]::MinValue
function Update-Descendants {
    $childrenOf = @{}
    foreach ($row in Get-CimInstance Win32_Process -Property ProcessId, ParentProcessId) {
        $parent = [int]$row.ParentProcessId
        if (-not $childrenOf.ContainsKey($parent)) { $childrenOf[$parent] = New-Object System.Collections.Generic.List[int] }
        $childrenOf[$parent].Add([int]$row.ProcessId)
    }
    $queue = New-Object System.Collections.Generic.Queue[int]
    $visited = New-Object System.Collections.Generic.HashSet[int]
    $queue.Enqueue($rootId)
    [void]$visited.Add($rootId)
    while ($queue.Count) {
        $parent = $queue.Dequeue()
        if (-not $childrenOf.ContainsKey($parent)) { continue }
        foreach ($child in $childrenOf[$parent]) {
            if (-not $visited.Add($child)) { continue }
            if (-not $tracked.ContainsKey($child)) {
                try { $tracked[$child] = [System.Diagnostics.Process]::GetProcessById($child) } catch { continue }
            }
            $queue.Enqueue($child)
        }
    }
}
function Sample {
    $sum = [long]0
    $sumPrivate = [long]0
    foreach ($id in @($tracked.Keys)) {
        $process = $tracked[$id]
        try {
            $process.Refresh()
            if ($process.HasExited) { continue }
            if (-not $processNames.ContainsKey($id)) { $processNames[$id] = $process.ProcessName }
            $sum += $process.WorkingSet64
            $sumPrivate += $process.PrivateMemorySize64
            $peak = $process.PeakWorkingSet64
            if (-not $processPeaks.ContainsKey($id) -or $processPeaks[$id] -lt $peak) { $processPeaks[$id] = $peak }
            if ($id -eq $rootId) {
                $script:peakWorkingSetBytes = [Math]::Max($script:peakWorkingSetBytes, $peak)
                $script:peakPagefileUsageBytes = [Math]::Max($script:peakPagefileUsageBytes, $process.PeakPagedMemorySize64)
            }
        } catch { }
    }
    $script:treePeakWorkingSetBytes = [Math]::Max($script:treePeakWorkingSetBytes, $sum)
    $script:treePeakPrivateBytes = [Math]::Max($script:treePeakPrivateBytes, $sumPrivate)
}
while (-not $target.HasExited) {
    if ([DateTime]::UtcNow -ge $nextDiscovery) {
        try { Update-Descendants } catch { }
        $nextDiscovery = [DateTime]::UtcNow.AddMilliseconds(500)
    }
    Sample
    Start-Sleep -Milliseconds 20
}
Sample
$largestProcessPeak = [long]0
foreach ($value in $processPeaks.Values) { $largestProcessPeak = [Math]::Max($largestProcessPeak, $value) }
$treePeakWorkingSetBytes = [Math]::Max($treePeakWorkingSetBytes, $largestProcessPeak)
foreach ($process in $tracked.Values) { $process.Dispose() }
[Console]::Out.WriteLine((@{
    peakWorkingSetBytes = $peakWorkingSetBytes
    peakPagedMemorySizeBytes = $peakPagefileUsageBytes
    treePeakWorkingSetBytes = $treePeakWorkingSetBytes
    treePeakPrivateBytes = $treePeakPrivateBytes
    treeProcessCount = $tracked.Count
    treeProcessNames = @($processNames.Values | Sort-Object -Unique)
} | ConvertTo-Json -Compress))
