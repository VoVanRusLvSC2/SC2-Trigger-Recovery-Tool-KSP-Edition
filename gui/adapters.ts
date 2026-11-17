import path from 'node:path';
import fs from 'node:fs/promises';
import type { RecoveryAdapter, RecoveryRequest, DocumentPreview } from './contracts.js';

/** New formats register their own fields and argv builder; the view stays generic. */
export interface BackendAdapter {
  info: RecoveryAdapter;
  command(request: RecoveryRequest, root: string): string[];
  inspect(input: string): Promise<DocumentPreview>;
}
const sc2: BackendAdapter = {
  async inspect(input) {
    if (typeof input !== 'string' || !/\.sc2map$/i.test(input))
      throw Error('Choose a packed .SC2Map file.');
    input = await fs.realpath(input);
    if ((await fs.stat(input)).size > 1024 ** 3) throw Error('Map exceeds the preview limit.');
    const { openMpqReader } = await import(
      new URL('../../src/vendor/@modkit/blizzard-mpq/src/mpq/codec.js', import.meta.url).href
    );
    // The reader consumes an in-memory buffer and never opens an archive writer.
    const reader = await openMpqReader(await fs.readFile(input), {
      maxArchiveBytes: 1024 ** 3,
      maxEntries: 100000,
      maxEntryBytes: 16 * 1024 ** 2,
    });
    try {
      async function text(name: string): Promise<string> {
        const entry = reader.find(name);
        return entry ? Buffer.from(await reader.read(entry.id)).toString('utf8') : '';
      }
      return {
        name: input,
        source: await text('MapScript.galaxy'),
        markup: await text('Triggers'),
        hasAttributes: !!reader.find('Attributes'),
        suggestedOutput: path.join(
          path.dirname(input),
          path.basename(input, path.extname(input)) + '-Recovered-' + Date.now(),
        ),
      };
    } finally {
      reader.dispose();
    }
  },
  info: {
    id: 'sc2',
    title: 'StarCraft II',
    description:
      'Recover editable GUI triggers from Galaxy. Preserve existing folders and authored script by default.',
    fields: [
      { key: 'input', label: 'Source map', required: true, picker: 'map' },
      {
        key: 'installation',
        label: 'StarCraft II folder (automatic; override if needed)',
        required: true,
        picker: 'folder',
        help: 'Detected automatically. Only change this if you use another installation.',
      },
      {
        key: 'output',
        label: 'New output folder',
        required: true,
        picker: 'output',
        help: 'Browse selects a parent and proposes a new child folder. The original map is never overwritten.',
      },
      {
        key: 'benchmark',
        label: 'Strict benchmark (enabled by default)',
        required: true,
        picker: 'folder',
        help: 'The verified bundled benchmark is selected automatically. Only change this for an original external benchmark distribution.',
      },
      {
        key: 'attributeIndex',
        label: 'Verified attribute header index (optional)',
        picker: 'json',
        help: 'Galaxy and localization are analyzed automatically. Existing Attributes are retained. An exact header can add verified definitions and defaults; unknown defaults are never guessed.',
      },
    ],
  },
  command({ fields, fullGui }, root) {
    if (!/\.sc2map$/i.test(fields.input ?? '')) throw Error('Select a packed .SC2Map file.');
    const args = [
      path.join(root, 'trigger-recovery.mjs'),
      'recover',
      fields.input!,
      '--sc2',
      fields.installation!,
      '--out',
      fields.output!,
    ];
    if (fields.benchmark?.trim()) args.push('--benchmark', fields.benchmark);
    if (fields.attributeIndex?.trim()) args.push('--attribute-index', fields.attributeIndex);
    if (fullGui) args.push('--full-gui');
    return args;
  },
};
export const adapters: BackendAdapter[] = [sc2];
export function selectAdapter(request: RecoveryRequest): BackendAdapter {
  const adapter = adapters.find((a) => a.info.id === request.adapter);
  if (!adapter) throw Error('Unsupported recovery adapter.');
  if (!request.fields || typeof request.fields !== 'object' || typeof request.fullGui !== 'boolean')
    throw Error('Invalid recovery request.');
  for (const field of adapter.info.fields) {
    const value = request.fields[field.key];
    if ((value !== undefined && typeof value !== 'string') || (field.required && !value?.trim()))
      throw Error('Choose ' + field.label + '.');
    if (value && (value.length > 32000 || /[\x00-\x1f]/u.test(value))) throw Error('Invalid path.');
  }
  return adapter;
}
