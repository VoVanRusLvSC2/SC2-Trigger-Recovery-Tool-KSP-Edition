import path from 'node:path';
import fs from 'node:fs/promises';
import {
  triggerPreviewLimit,
  type AttributePreview,
  type RecoveryAdapter,
  type RecoveryRequest,
  type DocumentPreview,
} from './contracts.js';

export async function inspectSc2Attributes(input: string): Promise<AttributePreview> {
  const { openSc2Package } = await import(
    new URL('../../src/cli/sc2-package.mjs', import.meta.url).href
  );
  const reader = await openSc2Package(input, { maxEntryBytes: 16 * 1024 ** 2 });
  try {
    const entry = reader.find('Attributes');
    if (!entry) return { present: false, definitions: [], variants: 0 };
    const xml = Buffer.from(await reader.read(entry.id)).toString('utf8');
    try {
      const { readAttributes } = await import(
        new URL(
          '../../src/sdk/core/modules/map/shared/format/formats/attributes.js',
          import.meta.url,
        ).href
      );
      const { localizationTable } = await import(
        new URL('../../src/utilities/merge-localization.mjs', import.meta.url).href
      );
      const labels = new Map<string, string>();
      for (const locale of ['enUS', 'ruRU']) {
        const strings = reader.find(`${locale}.SC2Data/LocalizedData/GameStrings.txt`);
        if (!strings) continue;
        const text = Buffer.from(await reader.read(strings.id)).toString('utf8');
        for (const [key, value] of localizationTable(text))
          if (!labels.has(key)) labels.set(key, value);
      }
      const { attributes, variants } = readAttributes(xml) as {
        attributes: {
          id: string;
          name?: string;
          type?: string;
          values: { id: string; name?: string }[];
        }[];
        variants: unknown[];
      };
      const name = (row: { id: string; name?: string }) =>
        row.name ? labels.get(row.name) || row.name : row.id;
      return {
        present: true,
        definitions: attributes.map((row) => ({
          id: row.id,
          name: name(row),
          type: row.type,
          values: row.values.map((value) => ({ id: value.id, name: name(value) })),
        })),
        variants: variants.length,
        xml,
      };
    } catch (error) {
      return { present: true, definitions: [], variants: 0, xml, error: (error as Error).message };
    }
  } finally {
    reader.dispose();
  }
}

/** New formats register their own fields and argv builder; the view stays generic. */
export interface BackendAdapter {
  info: RecoveryAdapter;
  command(request: RecoveryRequest, root: string): string[];
  inspect(input: string): Promise<DocumentPreview>;
}
const sc2: BackendAdapter = {
  async inspect(input) {
    if (typeof input !== 'string' || !/\.sc2(map|mod)$/i.test(input))
      throw Error('Choose a .SC2Map or .SC2Mod archive or component folder.');
    input = await fs.realpath(input);
    const info = await fs.stat(input);
    if (!info.isFile() && !info.isDirectory())
      throw Error('Choose an SC2 archive or component folder.');
    const { openSc2Package } = await import(
      new URL('../../src/cli/sc2-package.mjs', import.meta.url).href
    );
    // Both package forms are read-only; preview never opens an archive writer.
    const reader = await openSc2Package(input, {
      maxArchiveBytes: 1024 ** 3,
      maxEntries: 100000,
      maxEntryBytes: triggerPreviewLimit,
    });
    try {
      async function text(name: string): Promise<string> {
        const entry = reader.find(name);
        return entry ? Buffer.from(await reader.read(entry.id)).toString('utf8') : '';
      }
      const mapScript = reader.find('MapScript.galaxy');
      // Keep ordinary map opening as cheap as before. A mod has no single map
      // entry point: expose its real library bodies and headers instead.
      const paths =
        /\.sc2map$/i.test(input) && mapScript
          ? [mapScript.path as string]
          : (reader.entries
              .filter((entry: { path: string }) => /\.galaxy$/i.test(entry.path))
              .map((entry: { path: string }) => entry.path) as string[]);
      const rank = (name: string) =>
        /^MapScript\.galaxy$/i.test(name)
          ? 0
          : /(?:^|[/\\])MapScript\.galaxy$/i.test(name)
            ? 1
            : /_h\.galaxy$/i.test(name)
              ? 3
              : 2;
      paths.sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
      if (paths.length > 1024) throw Error('Archive contains too many Galaxy files for preview.');
      const sourceFiles = [];
      let sourceBytes = 0;
      for (const file of paths) {
        const value = await text(file);
        sourceBytes += Buffer.byteLength(value);
        if (sourceBytes > 64 * 1024 ** 2) throw Error('Combined Galaxy preview exceeds 64 MiB.');
        sourceFiles.push({ path: file, text: value });
      }
      // Opening a valid package enables an attempt. Source completeness and
      // conversion fidelity belong to the worker report, not button availability.
      return {
        name: input,
        source: sourceFiles[0]?.text ?? '',
        sourceFiles,
        canRecover: true,
        ...(info.isFile() && /\.sc2map$/iu.test(input) && reader.find('SC1Backend.galaxy')
          ? {
              canRepairGalaxyCopy: await (
                await import(
                  new URL('../../src/cli/repair-legacy-galaxy-copy.mjs', import.meta.url).href
                )
              ).hasRepairableLegacyGalaxy(reader),
            }
          : {}),
        ...(!sourceFiles.length
          ? {
              recoveryNotice:
                'No Galaxy source was found. Generate Triggers will validate the package and report what can be recovered.',
            }
          : {}),
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
      { key: 'input', label: 'Source map or mod', required: true, picker: 'map' },
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
  command({ fields, fullGui, recoverAttributes, libraryRoots, repairGalaxyCopy }, root) {
    if (!/\.sc2(map|mod)$/i.test(fields.input ?? ''))
      throw Error('Recovery requires a .SC2Map or .SC2Mod package.');
    const args = [
      path.join(root, 'trigger-recovery.mjs'),
      'recover',
      fields.input!,
      path.resolve(fields.installation!) === path.join(root, '.runtime', 'public-resources')
        ? '--resources'
        : '--sc2',
      fields.installation!,
      '--out',
      fields.output!,
    ];
    if (fields.benchmark?.trim()) args.push('--benchmark', fields.benchmark);
    if (fields.attributeIndex?.trim()) args.push('--attribute-index', fields.attributeIndex);
    if (fullGui) args.push('--full-gui');
    if (repairGalaxyCopy) args.push('--repair-galaxy-copy');
    if (recoverAttributes === false) args.push('--no-attribute-recovery');
    for (const directory of libraryRoots ?? []) args.push('--library', directory);
    return args;
  },
};
export const adapters: BackendAdapter[] = [sc2];
export function selectAdapter(request: RecoveryRequest): BackendAdapter {
  const adapter = adapters.find((a) => a.info.id === request.adapter);
  if (!adapter) throw Error('Unsupported recovery adapter.');
  if (!request.fields || typeof request.fields !== 'object' || typeof request.fullGui !== 'boolean')
    throw Error('Invalid recovery request.');
  if (request.recoverAttributes !== undefined && typeof request.recoverAttributes !== 'boolean')
    throw Error('Invalid attribute recovery option.');
  if (request.repairGalaxyCopy !== undefined && typeof request.repairGalaxyCopy !== 'boolean')
    throw Error('Invalid Galaxy repair option.');
  if (
    request.libraryRoots !== undefined &&
    (!Array.isArray(request.libraryRoots) ||
      request.libraryRoots.length > 100 ||
      request.libraryRoots.some(
        (p) => typeof p !== 'string' || !p.trim() || p.length > 32767 || /[\x00-\x1f]/.test(p),
      ))
  )
    throw Error('Invalid local library roots.');
  for (const field of adapter.info.fields) {
    const value = request.fields[field.key];
    if ((value !== undefined && typeof value !== 'string') || (field.required && !value?.trim()))
      throw Error('Choose ' + field.label + '.');
    if (value && (value.length > 32000 || /[\x00-\x1f]/u.test(value))) throw Error('Invalid path.');
  }
  return adapter;
}
