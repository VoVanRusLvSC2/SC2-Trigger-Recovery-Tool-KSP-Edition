import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

export interface RecoveryDefaults {
  installation: string;
  benchmark: string;
  installationStatus: string;
  benchmarkStatus: string;
}

export async function findInstallation(candidates: string[]): Promise<string> {
  for (const candidate of [...new Set(candidates.filter(Boolean))]) {
    try {
      const directory = await fs.realpath(candidate);
      if ((await fs.stat(path.join(directory, '.build.info'))).isFile()) return directory;
    } catch {
      /* Continue to the next installation location. */
    }
  }
  return '';
}

async function registryInstallations(): Promise<string[]> {
  if (process.platform !== 'win32') return [];
  const script = `[Console]::OutputEncoding = New-Object Text.UTF8Encoding($false); $keys = @('HKLM:\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\StarCraft II', 'HKLM:\\SOFTWARE\\WOW6432Node\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\StarCraft II', 'HKLM:\\SOFTWARE\\Blizzard Entertainment\\StarCraft II', 'HKCU:\\SOFTWARE\\Blizzard Entertainment\\StarCraft II'); foreach ($key in $keys) { $value = Get-ItemProperty -LiteralPath $key -ErrorAction SilentlyContinue; foreach ($name in @('InstallLocation','InstallPath','GamePath')) { if ($value.$name -is [string] -and $value.$name) { [Console]::WriteLine($value.$name) } } }`;
  try {
    const { stdout } = await promisify(execFile)(
      'powershell.exe',
      ['-NoProfile', '-EncodedCommand', Buffer.from(script, 'utf16le').toString('base64')],
      { windowsHide: true, timeout: 10000 },
    );
    return stdout
      .split(/\r?\n/u)
      .map((line) => line.trim())
      .filter(Boolean);
  } catch {
    return [];
  }
}

export async function discoverDefaults(root: string): Promise<RecoveryDefaults> {
  const installation = await findInstallation([
    process.env.SC2_INSTALL_PATH ?? '',
    process.env.SC2_INSTALLATION ?? '',
    ...(await registryInstallations()),
    path.join(process.env['ProgramFiles(x86)'] ?? 'C:\\Program Files (x86)', 'StarCraft II'),
    path.join(process.env.ProgramFiles ?? 'C:\\Program Files', 'StarCraft II'),
  ]);
  let benchmark = '',
    benchmarkError = '';
  const candidates = process.env.SC2_TRIGGER_BENCHMARK_ROOT
    ? [process.env.SC2_TRIGGER_BENCHMARK_ROOT]
    : [path.join(root, '.runtime', 'pinned-benchmark'), root];
  for (const candidate of candidates) {
    try {
      await fs.access(path.join(candidate, 'benchmark', 'MANIFEST.json'));
    } catch {
      continue;
    }
    try {
      const { openPinnedUserOracle } = await import(
        new URL('../../src/verification/pinned-user-oracle.mjs', import.meta.url).href
      );
      await openPinnedUserOracle({ root: candidate });
      benchmark = await fs.realpath(candidate);
      break;
    } catch {
      benchmarkError =
        'Benchmark integrity check failed. Select the original benchmark in Settings.';
    }
  }
  return {
    installation,
    benchmark,
    installationStatus: installation
      ? 'StarCraft II found automatically'
      : 'StarCraft II not found. Set its folder in Settings.',
    benchmarkStatus: benchmark
      ? 'Strict benchmark enabled'
      : benchmarkError ||
        'Strict benchmark unavailable. Install the complete application or set its folder in Settings.',
  };
}
