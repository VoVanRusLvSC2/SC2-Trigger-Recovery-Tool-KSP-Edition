#!/usr/bin/env node
/** User-facing entry point. Dependency preparation and conversion share the same
 * public worker; this launcher never calls the old archive's converter. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { spawn } from 'node:child_process';

const usage = `SC2 Trigger Recovery KSP 3.0.2
Usage:
  trigger-recovery recover <map.SC2Map> (--sc2 <installation> | --resources <snapshot>) --out <new-directory>
  trigger-recovery prepare <map.SC2Map> (--sc2 <installation> | --resources <snapshot>) --out <new-directory>
  trigger-recovery run <job.json> [--benchmark <distribution>]
  trigger-recovery doctor
  trigger-recovery download-resources <new-directory>

Optional: --mpq <mpqcli.exe>, --benchmark <pinned-distribution>, --full-gui
Additional local dependency locations: --library <SC2-package-or-folder> (repeatable).
Use --download-resources <new-directory> on recover to download the snapshot first.
For recover/prepare: --attribute-index <verified-header-index.json>, --no-attribute-recovery
Attribute recovery is enabled by default; disabling it preserves existing Attributes bytes.
The default preserves authored script and GUI structure. Originals stay unchanged.
Outputs are candidates with explicit offline evidence, not Editor/gameplay acceptance.
The Standalone edition uses its public metadata automatically. Its strict comparisons retain REVIEW for the unknown Editor version.
`;
try {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      sc2: { type: 'string' },
      resources: { type: 'string' },
      'download-resources': { type: 'string' },
      out: { type: 'string' },
      mpq: { type: 'string' },
      benchmark: { type: 'string' },
      library: { type: 'string', multiple: true },
      'attribute-index': { type: 'string' },
      'full-gui': { type: 'boolean' },
      'no-attribute-recovery': { type: 'boolean' },
      help: { type: 'boolean', short: 'h' },
    },
  });
  const [command, input] = positionals;
  if (values.help) console.log(usage);
  else if (command === 'download-resources' && input && positionals.length === 2) {
    const { fetchPublicPack } = await import('./src/resources/fetch-public-pack.mjs');
    const result = await fetchPublicPack(input, {
      onProgress: (value) => console.log(JSON.stringify(value)),
    });
    console.log(JSON.stringify(result));
  } else if (command === 'doctor') {
    await import('./scripts/check-runtime-dependencies.mjs');
    await import('./src/conversion/index.mjs');
    await fs.access(path.join(import.meta.dirname, '.runtime/tools/mpqcli.exe'));
    console.log(
      'Application runtime, conversion API and MPQ tool are available. Game/Editor qualification is separate.',
    );
  } else if (['recover', 'prepare', 'run'].includes(command) && input && positionals.length === 2) {
    if (command === 'run' && values.library?.length)
      throw Error(
        'Set library roots during recover/prepare; prepared runs cannot change dependency sources',
      );
    let jobFile = path.resolve(input);
    if (command !== 'run') {
      if (!values.out) throw Error('--out is required');
      if (values['download-resources']) {
        if (values.sc2 || values.resources) throw Error('Choose one SC2 resource source');
        const original = await fs.realpath(input);
        const info = await fs.stat(original);
        if (!/\.sc2(map|mod)$/iu.test(original) || (!info.isFile() && !info.isDirectory()))
          throw Error('Expected a .SC2Map or .SC2Mod archive or component folder');
        const newPath = async (value) => {
          const resolved = path.resolve(value);
          const parent = await fs.realpath(path.dirname(resolved));
          const target = path.join(parent, path.basename(resolved));
          try {
            await fs.lstat(target);
            throw Error('Output already exists: ' + target);
          } catch (error) {
            if (error.code !== 'ENOENT') throw error;
          }
          return target;
        };
        const resources = await newPath(values['download-resources']);
        const output = await newPath(values.out);
        const inside = (parent, child) => {
          const rel = path.relative(parent, child);
          return (
            !rel || (!rel.startsWith('..' + path.sep) && rel !== '..' && !path.isAbsolute(rel))
          );
        };
        if (
          inside(resources, output) ||
          inside(output, resources) ||
          inside(resources, original) ||
          inside(output, original)
        )
          throw Error('Resource, output and original paths must not overlap');
        const { fetchPublicPack } = await import('./src/resources/fetch-public-pack.mjs');
        console.log(
          'Downloading the optional public SC2 data snapshot; Editor version is not verified.',
        );
        await fetchPublicPack(values['download-resources'], {
          onProgress: (value) => console.log(JSON.stringify(value)),
        });
        values.resources = values['download-resources'];
      }
      if (!values.sc2 && !values.resources) {
        const { bundledSnapshot } = await import('./src/resources/installed-snapshot.mjs');
        values.resources = await bundledSnapshot(import.meta.dirname);
        if (values.resources && !values.benchmark)
          values.benchmark = path.join(import.meta.dirname, '.runtime/pinned-benchmark');
      }
      if (!values.sc2 && !values.resources)
        throw Error(
          'Select --sc2 <installation> or --resources <snapshot>. If SC2 is unavailable, download the optional snapshot with: trigger-recovery download-resources <new-directory>.',
        );
      const { prepareMap } = await import('./src/cli/prepare-map.mjs');
      console.log('Preparing archive, selected metadata and include closure...');
      const result = await prepareMap({
        original: input,
        installation: values.sc2,
        resourceSnapshot: values.resources,
        output: values.out,
        mpq: values.mpq ?? path.join(import.meta.dirname, '.runtime/tools/mpqcli.exe'),
        guiRecoveryMode: values['full-gui'] ? 'full-gui' : 'preserve-source',
        attributeIndex: values['attribute-index'],
        recoverAttributes: !values['no-attribute-recovery'],
        libraryRoots: values.library,
        onProgress: (event) => console.log(JSON.stringify({ type: 'progress', ...event })),
      });
      jobFile = result.jobFile;
      console.log(JSON.stringify(result));
    }
    if (command === 'run' && values['no-attribute-recovery'])
      throw Error(
        'Set recoverAttributes in the prepared job or use recover/prepare --no-attribute-recovery',
      );
    if (command === 'run' && values['attribute-index'])
      throw Error(
        'Set attributeIndex in the prepared job or use recover/prepare --attribute-index',
      );
    if (command !== 'prepare') {
      const job = JSON.parse(await fs.readFile(jobFile, 'utf8'));
      const config = JSON.parse(await fs.readFile(job.config, 'utf8'));
      if (config.resourceSnapshot && !values.benchmark && job.documentKind !== 'mod') {
        const { recoverPublicSnapshot } = await import('./src/cli/recover-public-snapshot.mjs');
        console.log(
          'Public snapshot mode: diagnostic only, no benchmark PASS or Editor verification.',
        );
        const result = await recoverPublicSnapshot(jobFile);
        console.log(JSON.stringify(result));
        process.exitCode = 1;
      } else {
        const env = { ...process.env };
        if (values.benchmark) env.SC2_TRIGGER_BENCHMARK_ROOT = path.resolve(values.benchmark);
        const child = spawn(
          process.execPath,
          [
            path.join(
              import.meta.dirname,
              job.documentKind === 'mod' || config.resourceSnapshot
                ? 'src/cli/convert-mod.mjs'
                : 'src/cli/convert.mjs',
            ),
            jobFile,
          ],
          { env, stdio: 'inherit', windowsHide: true },
        );
        const code = await new Promise((resolve, reject) => {
          child.once('error', reject);
          child.once('exit', (code) => resolve(code ?? 1));
        });
        process.exitCode = code;
      }
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
