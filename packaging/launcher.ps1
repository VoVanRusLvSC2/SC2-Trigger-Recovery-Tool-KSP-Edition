# Native Windows front end; all conversion runs through the public Node CLI.
param([switch]$ValidateOnly)
Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing
$ErrorActionPreference = 'Stop'
$applicationRoot = Split-Path -Parent $PSScriptRoot
$form = New-Object Windows.Forms.Form
$form.Text = 'SC2 Trigger Recovery KSP'
$form.ClientSize = New-Object Drawing.Size(730, 510)
$form.StartPosition = 'CenterScreen'
$form.Font = New-Object Drawing.Font('Segoe UI', 10)
$fields = @{}
$labels = @('Map (.SC2Map)', 'StarCraft II folder', 'New output folder', 'Benchmark folder (optional)')
for ($i = 0; $i -lt $labels.Count; $i++) {
  $label = New-Object Windows.Forms.Label
  $label.Text = $labels[$i]; $label.Location = New-Object Drawing.Point(15, (16 + $i * 57)); $label.AutoSize = $true
  $form.Controls.Add($label)
  $box = New-Object Windows.Forms.TextBox
  $box.Location = New-Object Drawing.Point(15, (38 + $i * 57)); $box.Width = 610
  $form.Controls.Add($box); $fields[$i] = $box
  $button = New-Object Windows.Forms.Button
  $button.Text = 'Browse'; $button.Location = New-Object Drawing.Point(635, (36 + $i * 57)); $button.Width = 80; $button.Tag = $i
  $button.Add_Click({
    $index = [int]$this.Tag
    if ($index -eq 0) {
      $dialog = New-Object Windows.Forms.OpenFileDialog
      $dialog.Filter = 'StarCraft II maps|*.SC2Map'
    } else { $dialog = New-Object Windows.Forms.FolderBrowserDialog }
    if ($dialog.ShowDialog() -eq 'OK') {
      if ($index -eq 0) { $fields[$index].Text = $dialog.FileName }
      elseif ($index -eq 2) { $fields[$index].Text = Join-Path $dialog.SelectedPath ('Recovered-' + (Get-Date -Format 'yyyyMMdd-HHmmss')) }
      else { $fields[$index].Text = $dialog.SelectedPath }
    }
    $dialog.Dispose()
  })
  $form.Controls.Add($button)
}
$fields[1].Text = Join-Path ${env:ProgramFiles(x86)} 'StarCraft II'
$fields[2].Text = Join-Path ([Environment]::GetFolderPath('MyDocuments')) ('SC2-Recovered-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
$run = New-Object Windows.Forms.Button
$run.Text = 'Recover triggers'; $run.Location = New-Object Drawing.Point(15, 270); $run.Width = 170
$form.Controls.Add($run)
$notice = New-Object Windows.Forms.Label
$notice.Text = 'Original files stay unchanged. Review RESULT.json; output is not Editor acceptance.'
$notice.Location = New-Object Drawing.Point(15, 307); $notice.Size = New-Object Drawing.Size(700, 24)
$form.Controls.Add($notice)
$log = New-Object Windows.Forms.TextBox
$log.Multiline = $true; $log.ReadOnly = $true; $log.ScrollBars = 'Vertical'; $log.Location = New-Object Drawing.Point(15, 337); $log.Size = New-Object Drawing.Size(700, 155)
$form.Controls.Add($log)
$script:worker = $null
$timer = New-Object Windows.Forms.Timer
$timer.Interval = 500
$timer.Add_Tick({
  if ($null -eq $script:worker) { return }
  $text = ''
  foreach ($file in @($script:stdout, $script:stderr)) {
    if (Test-Path -LiteralPath $file) { $text += [IO.File]::ReadAllText($file) }
  }
  $log.Text = $text; $log.SelectionStart = $log.Text.Length; $log.ScrollToCaret()
  if ($script:worker.HasExited) {
    $log.AppendText("`r`nProcess exit code: $($script:worker.ExitCode). See the output folder for candidate/evidence.`r`n")
    $timer.Stop(); $run.Enabled = $true; $script:worker.Dispose(); $script:worker = $null
  }
})
$run.Add_Click({
  try {
    foreach ($i in @(0, 1, 2)) { if ([string]::IsNullOrWhiteSpace($fields[$i].Text)) { throw 'Choose a map, game folder and new output folder.' } }
    $output = [IO.Path]::GetFullPath($fields[2].Text)
    if (Test-Path -LiteralPath $output) { throw 'Choose a NEW output directory. Existing outputs will not be overwritten.' }
    $logRoot = Join-Path ([IO.Path]::GetTempPath()) ('TriggerRecovery-' + [Guid]::NewGuid().ToString('N'))
    New-Item -ItemType Directory -Path $logRoot | Out-Null
    $script:stdout = Join-Path $logRoot 'stdout.txt'; $script:stderr = Join-Path $logRoot 'stderr.txt'
    $arguments = @((Join-Path $applicationRoot 'trigger-recovery.mjs'), 'recover', $fields[0].Text, '--sc2', $fields[1].Text, '--out', $output)
    if ($fields[3].Text.Trim()) { $arguments += @('--benchmark', $fields[3].Text) }
    # Windows paths cannot contain quotes. Reject them before constructing the
    # native argv string; no shell evaluates map/output values.
    foreach ($argument in $arguments) { if ($argument.Contains('"') -or $argument.EndsWith('\')) { throw 'Remove quotes and trailing backslashes from paths.' } }
    $quoted = ($arguments | ForEach-Object { '"' + $_ + '"' }) -join ' '
    $script:worker = Start-Process -FilePath (Join-Path $applicationRoot 'node/node.exe') -ArgumentList $quoted -WindowStyle Hidden -RedirectStandardOutput $script:stdout -RedirectStandardError $script:stderr -PassThru
    $run.Enabled = $false; $log.Text = 'Running...'; $timer.Start()
  } catch { [Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Cannot start recovery') | Out-Null }
})
$form.Add_FormClosing({
  param($sender, $eventArguments)
  if ($null -ne $script:worker -and -not $script:worker.HasExited) {
    [Windows.Forms.MessageBox]::Show('Wait for the current recovery process to finish.', 'Recovery running') | Out-Null
    $eventArguments.Cancel = $true
  }
})
if ($ValidateOnly) {
  Write-Output ('Launcher constructed: ' + $form.Controls.Count + ' controls; no window opened.')
} else { [void]$form.ShowDialog() }
$timer.Dispose(); $form.Dispose()
