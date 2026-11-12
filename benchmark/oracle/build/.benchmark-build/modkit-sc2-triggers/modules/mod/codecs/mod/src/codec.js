import { ModkitError, operationId } from '@modkit/core';
import { isJsonSerializable } from '@modkit/codec-kit/legacy/assets';
import { createInspectionCodec, simpleLease, } from '@modkit/codec-kit';
import { SC2ModReader, collectModEntities, gameDataNamespaceSummaries, } from '../../../shared/core/index.js';
import { exportSc2Components } from './sc2-components-export.js';
import { modCardFacts, modResourceTree } from './mod-card.js';
import { sc2BuiltinDocumentInfo, sc2InstallationDependencies, } from '../../../shared/workspace/implicit-dependencies.js';
import { exportJsonMod } from './portable-json-export.js';
import { addTextLocaleToComponentList, componentListHasLocale, } from '../../document-metadata/core/component-list.js';
import { createSc2NamespaceDefinition, } from '../../../../../shared/package-namespace/runtime.js';
const PACKED_ID = 'blizzard/sc2-mod';
const LOOSE_ID = 'blizzard/sc2-mod-directory';
const ROOT = 'namespace:Active.SC2Mod';
const COMPONENT_LIST = 'ComponentList.SC2Components';
const utf8 = new TextDecoder('utf-8', { fatal: false });
const encoder = new TextEncoder();
/** The `edit-structure` (add-locale) input: a locale code, optionally the strings file stem. */
function addLocaleRequest(input) {
    const value = (input !== null && typeof input === 'object' && !Array.isArray(input) ? input : {});
    const locale = value['locale'];
    const fileStem = value['fileStem'];
    if (typeof locale !== 'string' || locale.trim() === '') {
        throw new TypeError('sc2-mod add-locale needs a non-empty string `locale`');
    }
    if (fileStem !== undefined && typeof fileStem !== 'string') {
        throw new TypeError('sc2-mod add-locale `fileStem` must be a string');
    }
    return fileStem === undefined ? { locale } : { locale, fileStem };
}
export const SC2_MOD_OPERATION_MAP = Object.freeze({
    'view.inspect': { id: 'view.inspect', handlerId: 'inspect', outputKinds: ['json'] },
    'asset.compare': { id: 'asset.compare', handlerId: 'compare', outputKinds: ['json'] },
    'asset.validate': { id: 'asset.validate', handlerId: 'validate', outputKinds: ['json'] },
    'container.extract': {
        id: 'container.extract',
        handlerId: 'extract-entry',
        outputKinds: ['bytes'],
    },
    'edit.structure': {
        id: 'edit.structure',
        handlerId: 'edit-structure',
        outputKinds: ['edit-plan'],
    },
    'export.convert': { id: 'export.convert', handlerId: 'export-convert', outputKinds: ['json'] },
});
export const SC2_MOD_OPERATION_MAP_VERSION = 1;
function portable(value) {
    if (value === null || typeof value === 'string' || typeof value === 'boolean')
        return value;
    if (typeof value === 'number')
        return Number.isFinite(value) ? value : String(value);
    if (typeof value === 'bigint')
        return String(value);
    if (value instanceof Uint8Array)
        return { bytes: [...value] };
    if (Array.isArray(value))
        return value.map(portable);
    if (value instanceof Map) {
        return Object.fromEntries([...value.entries()]
            .map(([key, item]) => [String(key), portable(item)])
            .sort(([a], [b]) => a.localeCompare(b)));
    }
    if (typeof value === 'object' && value !== null) {
        const result = {};
        for (const [key, item] of Object.entries(value).sort(([a], [b]) => a.localeCompare(b))) {
            if (item !== undefined)
                result[key] = portable(item);
        }
        return result;
    }
    return String(value);
}
function json(value) {
    const valueJson = portable(value);
    if (!isJsonSerializable(valueJson))
        throw new TypeError('SC2 mod operation produced non-JSON data');
    return { kind: 'json', value: valueJson };
}
function normalizePath(value) {
    const path = value.replaceAll('\\', '/').replace(/^\/+|\/+$/gu, '');
    if (path.includes('\0') || path.split('/').some(part => part === '..')) {
        throw new TypeError('SC2 mod path is not confined');
    }
    return path;
}
async function detectSc2ModNamespaceMarkers(markers, uri) {
    const normalized = new Map(markers.map(marker => [normalizePath(marker.path).toLowerCase(), marker.kind]));
    const mapMarker = [...normalized].some(([path, kind]) => kind === 'file' &&
        [
            'mapinfo',
            'objects',
            'mapobjects',
            'regions',
            'mapregions',
            't3heightmap',
            'mapheightmap',
        ].includes(path.split('/').at(-1) ?? ''));
    const campaign = normalized.get('base.sc2maps') === 'directory';
    const flatGameData = normalized.get('gamedata') === 'directory';
    const packagedGameData = normalized.get('base.sc2data') === 'directory';
    const documentInfo = normalized.get('documentinfo') === 'file';
    const componentList = normalized.get(COMPONENT_LIST.toLowerCase()) === 'file';
    const sc2ModUri = /\.sc2mod$/iu.test(uri.replaceAll('\\', '/').replace(/\/+$/u, ''));
    if (sc2ModUri && documentInfo && flatGameData && !componentList && !mapMarker && !campaign) {
        return {
            confidence: 0.9,
            kind: 'structure',
            note: 'mod:document-info + mod:data-directory + .sc2mod',
        };
    }
    return sc2ModUri && packagedGameData && !mapMarker && !campaign
        ? {
            confidence: 0.85,
            kind: 'structure',
            note: 'installed-mod:base.sc2data + .sc2mod',
        }
        : {
            confidence: 0,
            kind: 'structure',
            note: 'sc2-mod-directory-markers-missing',
        };
}
async function componentListFallback(namespace, context) {
    let flatGameData = false;
    let packagedGameData = false;
    let componentList = false;
    let documentInfo = false;
    let mapMarker = false;
    let campaign = false;
    let visited = 0;
    for await (const entry of namespace.list('', context.signal)) {
        context.signal?.throwIfAborted();
        if (++visited > 512)
            break;
        const path = normalizePath(entry.path).toLowerCase();
        if (path === 'gamedata' && entry.kind === 'directory')
            flatGameData = true;
        if (path === 'base.sc2data' && entry.kind === 'directory')
            packagedGameData = true;
        if (path === COMPONENT_LIST.toLowerCase() && entry.kind === 'file')
            componentList = true;
        if (path === 'documentinfo' && entry.kind === 'file')
            documentInfo = true;
        if (path === 'base.sc2maps' && entry.kind === 'directory')
            campaign = true;
        if (entry.kind === 'file' &&
            [
                'mapinfo',
                'objects',
                'mapobjects',
                'regions',
                'mapregions',
                't3heightmap',
                'mapheightmap',
            ].includes(path))
            mapMarker = true;
    }
    const uri = context.input.root.uri.replaceAll('\\', '/').replace(/\/+$/u, '');
    if (!/\.sc2mod$/iu.test(uri) || componentList || mapMarker || campaign)
        return undefined;
    if (documentInfo && flatGameData)
        return 'flat';
    return packagedGameData ? 'packaged' : undefined;
}
function legacyFlatNamespace(namespace, context) {
    const bytes = encoder.encode('<?xml version="1.0" encoding="utf-8"?>\n<Components><DataComponent Type="gada">GameData</DataComponent></Components>\n');
    const root = context.input.root;
    const separator = root.uri.includes('?') ? '&' : '?';
    const ref = Object.freeze({
        id: `${root.id}?vfs-path=${encodeURIComponent(COMPONENT_LIST)}`,
        uri: `${root.uri}${separator}vfs-path=${encodeURIComponent(COMPONENT_LIST)}`,
        parentIds: Object.freeze([...(root.parentIds ?? []), root.id]),
    });
    const source = Object.freeze({
        kind: 'bytes',
        ref,
        revision: namespace.revision,
        size: BigInt(bytes.byteLength),
        async read(offset, length, signal) {
            signal?.throwIfAborted();
            return bytes.slice(Number(offset), Number(offset) + length);
        },
        async *stream(_range, signal) {
            signal?.throwIfAborted();
            yield bytes;
        },
    });
    return Object.freeze({
        revision: namespace.revision,
        async *list(prefix, signal) {
            for await (const entry of namespace.list(prefix, signal))
                yield entry;
            if (normalizePath(prefix) === '') {
                yield Object.freeze({
                    path: COMPONENT_LIST,
                    kind: 'file',
                    size: BigInt(bytes.byteLength),
                });
            }
        },
        open(path, signal) {
            return normalizePath(path).toLowerCase() === COMPONENT_LIST.toLowerCase()
                ? Promise.resolve(simpleLease(source))
                : namespace.open(path, signal);
        },
    });
}
function documentDependencies(files) {
    const entry = [...files].find(([path]) => path.toLowerCase() === 'documentinfo');
    if (entry === undefined)
        return Object.freeze([]);
    const dependencies = [];
    for (const match of utf8.decode(entry[1]).matchAll(/<Value(?:\s[^>]*)?>([^<]+)<\/Value>/giu)) {
        const value = match[1]?.trim().replace(/^file:/iu, '');
        if (value !== undefined && /\.sc2(?:mod|campaign)(?:\/|$)/iu.test(value))
            dependencies.push(value);
    }
    return Object.freeze([...new Set(dependencies)]);
}
const SC2_SEMANTIC_EXTENSIONS = Object.freeze(new Set([
    'blizwiz',
    'galaxy',
    'json',
    'sc2components',
    'sc2layout',
    'sc2style',
    'sc2triggers',
    'txt',
    'version',
    'xml',
]));
function isSemanticModEntry(path) {
    const normalized = normalizePath(path).toLowerCase();
    const name = normalized.split('/').at(-1) ?? normalized;
    if (name === 'documentinfo' || name === COMPONENT_LIST.toLowerCase())
        return true;
    const extension = name.includes('.') ? (name.split('.').at(-1) ?? '') : '';
    return SC2_SEMANTIC_EXTENSIONS.has(extension);
}
async function parseNamespace(extension) {
    const files = new Map();
    const failures = [];
    let total = 0;
    const maximum = Math.min(Number(extension.context.budget.maxInputBytes), Number.MAX_SAFE_INTEGER);
    for (const entry of extension.entries) {
        if (entry.kind !== 'file')
            continue;
        extension.context.signal?.throwIfAborted();
        const path = normalizePath(entry.path);
        if (!isSemanticModEntry(path))
            continue;
        let bytes;
        try {
            bytes = await extension.readEntry(path, extension.context.budget.maxScalarBytes, extension.context.signal);
        }
        catch (error) {
            failures.push({ path, message: error instanceof Error ? error.message : String(error) });
            continue;
        }
        total += bytes.byteLength;
        if (total > maximum)
            throw new RangeError('SC2 mod namespace exceeds the input byte budget');
        files.set(path, bytes);
    }
    const byPath = new Map([...files].map(([path, bytes]) => [`${ROOT}/${path}`.toLowerCase(), bytes]));
    const vfs = {
        async list(base) {
            if (normalizePath(base).toLowerCase() !== ROOT.toLowerCase())
                return [];
            return [...files.keys()].sort();
        },
        async get(path) {
            const bytes = byPath.get(normalizePath(path).toLowerCase());
            if (bytes === undefined)
                throw new RangeError(`unknown SC2 mod entry: ${path}`);
            return bytes;
        },
        async getText(path) {
            return utf8.decode(await this.get(path));
        },
        async exists(path) {
            const normalized = normalizePath(path).toLowerCase();
            return (byPath.has(normalized) || [...byPath.keys()].some(item => item.startsWith(`${normalized}/`)));
        },
    };
    let mod;
    try {
        mod = await new SC2ModReader({ vfs }).read(ROOT, { deps: [] });
    }
    catch (error) {
        failures.push({ path: ROOT, message: error instanceof Error ? error.message : String(error) });
        throw error;
    }
    return Object.freeze({
        files,
        mod,
        failures: Object.freeze(failures),
        dependencies: documentDependencies(files),
    });
}
function operationDecls(id, packed) {
    const native = Object.entries(SC2_MOD_OPERATION_MAP)
        .filter(([operation]) => operation !== 'container.extract')
        .map(([operation, mapping]) => {
        const mutatesSource = operation === 'edit.structure';
        return Object.freeze({
            id: operationId(mapping.id, { contributionId: id }),
            handlerId: mapping.handlerId,
            mutatesSource,
            requiredPermissions: Object.freeze(mutatesSource ? ['read-source', 'write-source'] : ['read-source']),
            outputKinds: Object.freeze(mapping.outputKinds),
        });
    });
    return Object.freeze([
        ...native,
        ...(packed
            ? [
                Object.freeze({
                    id: operationId('export.raw', { contributionId: id }),
                    handlerId: 'export-raw',
                    mutatesSource: false,
                    requiredPermissions: Object.freeze(['read-source']),
                    outputKinds: Object.freeze(['bytes']),
                }),
            ]
            : []),
    ]);
}
async function openEntry(extension, path) {
    const lease = await extension.namespace.open(path, extension.context.signal);
    try {
        if (lease.value.kind !== 'bytes' || lease.value.size === undefined)
            throw new TypeError(`${path} is not a sized byte entry`);
        const size = Number(lease.value.size);
        if (!Number.isSafeInteger(size) || size > Number(extension.context.budget.maxScalarBytes)) {
            throw new RangeError(`${path} exceeds the scalar byte budget`);
        }
        const bytes = await lease.value.read(0n, size, extension.context.signal);
        return Object.freeze({ ref: lease.value.ref, revision: lease.value.revision, bytes });
    }
    finally {
        await lease.release();
    }
}
function entryRevision(source) {
    return Object.freeze({
        bindings: Object.freeze({ content: source.revision }),
        namespaceRevision: source.revision,
        compositionFingerprint: `namespace-entry:${String(source.revision)}:${source.ref.id}`,
    });
}
function createExtension() {
    return async function extendModInspection(extension) {
        const parsed = await parseNamespace(extension);
        const namespaces = gameDataNamespaceSummaries(parsed.mod);
        const ownPath = parsed.mod.loadOrder.at(-1) ?? ROOT;
        const summary = Object.freeze({
            semanticNamespaces: namespaces.length,
            semanticEntities: namespaces.reduce((sum, item) => sum + item.total, 0),
            ownEntities: namespaces.reduce((sum, item) => sum + item.own, 0),
            declaredDependencies: parsed.dependencies,
        });
        const card = modCardFacts({
            root: extension.root,
            revision: extension.revision,
            entries: extension.entries,
            files: parsed.files,
            dependencies: parsed.dependencies,
            mod: parsed.mod,
            namespaces,
        });
        return Object.freeze({
            summary,
            factGroups: card.factGroups,
            factRelations: card.factRelations,
            dataSources: Object.freeze({
                'common.view/tree-data-source': modResourceTree({
                    root: extension.root,
                    revision: extension.revision,
                    entries: extension.entries,
                    files: parsed.files,
                    dependencies: parsed.dependencies,
                    // The same engine authority the host asks for when it mounts dependencies, so Resources
                    // shows the chain that is actually loaded — Core first — not only the declared names.
                    dependencyChain: sc2InstallationDependencies(extension.root.uri, parsed.dependencies)
                        .dependencies,
                    mod: parsed.mod,
                    namespaces,
                }),
                'common.view/subject-selector-source': card.selector,
            }),
            metadata: Object.freeze([
                Object.freeze({
                    id: 'sc2-mod-model',
                    label: 'SC2 mod model',
                    entries: Object.freeze([
                        Object.freeze({ key: 'namespaces', value: summary.semanticNamespaces }),
                        Object.freeze({ key: 'entities', value: summary.semanticEntities }),
                        Object.freeze({ key: 'dependencies', value: parsed.dependencies }),
                    ]),
                }),
            ]),
            traits: Object.freeze([
                ...(parsed.dependencies.length === 0
                    ? []
                    : [
                        Object.freeze({
                            id: 'source.dependencies',
                            parameters: { count: parsed.dependencies.length },
                        }),
                    ]),
            ]),
            handlers: Object.freeze({
                inspect: async () => json({ ...summary, namespaces }),
                compare: async (input) => {
                    const locale = input !== null &&
                        typeof input === 'object' &&
                        !Array.isArray(input) &&
                        typeof input['locale'] === 'string'
                        ? String(input['locale']).toLowerCase()
                        : 'enus';
                    return json({
                        ownPath,
                        namespaces,
                        overrides: namespaces.map(item => ({
                            namespace: item.ns,
                            entities: collectModEntities(parsed.mod, item.ns, locale).filter(entity => entity.own),
                        })),
                    });
                },
                validate: async () => json({ valid: parsed.failures.length === 0, diagnostics: parsed.failures }),
                'export-convert': async (input) => {
                    const request = input !== null && typeof input === 'object' && !Array.isArray(input)
                        ? input
                        : {};
                    const format = request['format'] === 'sc2components' ? 'sc2components' : 'json-mod';
                    if (format === 'json-mod') {
                        return json(exportJsonMod(parsed.mod, {
                            ...(Array.isArray(request['namespaces'])
                                ? { namespaces: request['namespaces'].map(String) }
                                : {}),
                            ...(request['mode'] === 'full' ? { mode: 'full' } : {}),
                            ...(typeof request['name'] === 'string' ? { name: request['name'] } : {}),
                        }));
                    }
                    return json({
                        format,
                        files: exportSc2Components(parsed.mod, {
                            ...(Array.isArray(request['namespaces'])
                                ? { namespaces: request['namespaces'].map(String) }
                                : {}),
                            ...(typeof request['name'] === 'string' ? { modName: request['name'] } : {}),
                            ...(typeof request['indent'] === 'string' ? { indent: request['indent'] } : {}),
                            ...(typeof request['writeDefaultAttr'] === 'boolean'
                                ? { writeDefaultAttr: request['writeDefaultAttr'] }
                                : {}),
                        }),
                    });
                },
                'edit-structure': async (input) => {
                    const request = addLocaleRequest(input);
                    const entry = extension.entries.find(item => item.kind === 'file' && item.path.toLowerCase() === COMPONENT_LIST.toLowerCase());
                    if (entry === undefined)
                        throw new TypeError(`SC2 mod has no ${COMPONENT_LIST}`);
                    const xml = utf8.decode(await extension.readEntry(entry.path, extension.context.budget.maxScalarBytes, extension.context.signal));
                    if (componentListHasLocale(xml, request.locale))
                        throw new TypeError(`locale ${request.locale} is already declared`);
                    const next = addTextLocaleToComponentList(xml, request.locale);
                    if (next === xml)
                        throw new ModkitError({
                            code: 'blizzard/sc2-mod-component-list-malformed',
                            message: `${COMPONENT_LIST} has no closing Components element.`,
                            context: { componentListPath: COMPONENT_LIST },
                        });
                    throw new ModkitError({
                        code: 'blizzard/sc2-mod-locale-file-create-unavailable',
                        message: `Adding ${request.locale} requires atomic replacement of ${COMPONENT_LIST} and creation of ${request.locale}.SC2Data/LocalizedData/${request.fileStem ?? 'GameStrings'}.txt; the active container composition does not support new entries.`,
                        context: {
                            locale: request.locale,
                            componentListPath: COMPONENT_LIST,
                            localeFilePath: `${request.locale}.SC2Data/LocalizedData/${request.fileStem ?? 'GameStrings'}.txt`,
                        },
                    });
                },
            }),
            diagnostics: Object.freeze(parsed.failures.map((failure, index) => Object.freeze({
                id: `sc2-mod.parse.${index}`,
                code: 'blizzard/sc2-mod-parse-failed',
                category: 'syntax',
                severity: 'warning',
                message: failure.message,
                data: { path: failure.path },
            }))),
            unsupportedFeatures: Object.freeze([
                'dependency-content-merge-requires-node-workspace-facade',
                'packed-container-new-entry-create',
                'installed-editor-acceptance',
            ]),
        });
    };
}
export const abiVersion = 1;
export function createSc2ModCodec(loose, context) {
    const id = loose ? LOOSE_ID : PACKED_ID;
    const definition = createSc2NamespaceDefinition({
        id,
        kind: 'mod',
        formatId: loose ? 'sc2-mod-directory' : 'sc2-mod',
        displayName: loose ? 'StarCraft II loose mod' : 'StarCraft II mod',
        topology: loose ? 'mounted-directory' : 'mpq-namespace',
        packed: !loose,
        virtualDocumentInfo: sc2BuiltinDocumentInfo,
        operations: operationDecls(id, !loose),
        extendInspection: createExtension(),
    });
    const sharedDetect = definition.namespace.detect;
    const sharedInspect = definition.namespace.inspect;
    return createInspectionCodec(Object.freeze({
        ...definition,
        namespace: Object.freeze({
            ...definition.namespace,
            async detect(markers, uri) {
                const detected = (await sharedDetect(markers));
                return detected.confidence > 0 ? detected : detectSc2ModNamespaceMarkers(markers, uri);
            },
            async inspect(namespace, inspectionContext) {
                const fallback = await componentListFallback(namespace, inspectionContext);
                if (fallback === undefined) {
                    return sharedInspect(namespace, inspectionContext);
                }
                const result = (await sharedInspect(legacyFlatNamespace(namespace, inspectionContext), inspectionContext));
                const summaryValue = result.summary !== null &&
                    typeof result.summary === 'object' &&
                    !Array.isArray(result.summary)
                    ? result.summary
                    : {};
                return Object.freeze({
                    ...result,
                    summary: Object.freeze({
                        ...summaryValue,
                        syntheticComponentListFallback: fallback,
                        ...(fallback === 'flat' ? { legacyFlatGameDataFallback: true } : {}),
                    }),
                    detection: Object.freeze({
                        confidence: fallback === 'flat' ? 0.9 : 0.85,
                        kind: 'structure',
                        note: fallback === 'flat'
                            ? 'mod:document-info + mod:data-directory + .sc2mod'
                            : 'installed-mod:base.sc2data + .sc2mod',
                    }),
                });
            },
        }),
    }), context);
}
export function createCodec(context) {
    return createSc2ModCodec(false, context);
}
