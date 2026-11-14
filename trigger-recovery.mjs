#!/usr/bin/env node
/** User-facing entry point. Dependency preparation and conversion share the same
 * public worker; this launcher never calls the old archive's converter. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';

const usage = `SC2 Trigger Recovery KSP 3.0.0-rc.2
Usage:
  trigger-recovery recover <map.SC2Map> --sc2 <installation> --out <new-directory>
  trigger-recovery prepare <map.SC2Map> --sc2 <installation> --out <new-directory>
  trigger-recovery run <job.json> [--benchmark <distribution>]
  trigger-recovery doctor

Optional: --mpq <mpqcli.exe>, --benchmark <pinned-distribution>, --full-gui
For recover/prepare: --attribute-index <verified-header-index.json>
The default preserves authored script and GUI structure. Originals stay unchanged.
Outputs are candidates with explicit offline evidence, not Editor/gameplay acceptance.
An installed StarCraft II supplies NativeLib and dependency metadata.
`;
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      sc2: { type: 'string' },
      out: { type: 'string' },
      mpq: { type: 'string' },
      benchmark: { type: 'string' },
      'attribute-index': { type: 'string' },
      'full-gui': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, input] = positionals;
  if (values.help) console.log(usage);
  else if (command === 'doctor') {
    await import('./scripts/check-runtime-dependencies.mjs');
    await import('./src/conversion/index.mjs');
    await fs.access(path.join(import.meta.dirname, '.runtime/tools/mpqcli.exe'));
    console.log(
      'Application runtime, conversion API and MPQ tool are available. Game/Editor qualification is separate.',
    );
  } else if (['recover', 'prepare', 'run'].includes(command) && input && positionals.length === 2) {
    let jobFile = path.resolve(input);
    if (command !== 'run') {
      if (!values.sc2 || !values.out) throw Error('--sc2 and --out are required');
      const { prepareMap } = await import('./src/cli/prepare-map.mjs');
      console.log('Preparing archive, installed metadata and include closure...');
      const result = await prepareMap({
        original: input,
        installation: values.sc2,
        output: values.out,
        mpq: values.mpq ?? path.join(import.meta.dirname, '.runtime/tools/mpqcli.exe'),
        guiRecoveryMode: values['full-gui'] ? 'full-gui' : 'preserve-source',
        attributeIndex: values['attribute-index'],
      });
      jobFile = result.jobFile;
      console.log(JSON.stringify(result));
    }
    if (command === 'run' && values['attribute-index'])
      throw Error(
        'Set attributeIndex in the prepared job or use recover/prepare --attribute-index',
      );
    if (command !== 'prepare') {
      const env = { ...process.env };
      if (values.benchmark) env.SC2_TRIGGER_BENCHMARK_ROOT = path.resolve(values.benchmark);
      const child = spawn(
        process.execPath,
        [path.join(import.meta.dirname, 'src/cli/convert.mjs'), jobFile],
        { env, stdio: 'inherit', windowsHide: true },
      );
      const code = await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', (code) => resolve(code ?? 1));
      });
      process.exitCode = code;
    }
  } else {
    console.log(usage);
    process.exitCode = 2;
  }
} catch (error) {
  console.error('trigger-recovery: ' + error.message);
  if (process.env.TRIGGER_RECOVERY_DEBUG === '1') console.error(error.stack);
  process.exitCode = 1;
}
