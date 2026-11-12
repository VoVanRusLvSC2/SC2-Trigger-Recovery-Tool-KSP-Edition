import { createInspectionCodec, createTreeDataSource, simpleLease } from '@modkit/codec-kit';
import { createTableDataSource } from '../inspection/structured-text.js';
import { inspectSc2BankWorkspace } from '../../modules/banks/shared/workspace.js';
const MAX_PATH_CHARS = 4_096;
const MAX_PAGE_ITEMS = 20_000;
const MAX_METADATA_BYTES = 1_048_576;
const DOCUMENT_INFO = 'DocumentInfo';
const MAP_MARKERS = Object.freeze(new Set([
    'mapinfo',
    'objects',
    'mapobjects',
    'regions',
    'mapregions',
    't3heightmap',
    'mapheightmap',
    't3terrain.xml',
]));
function abort(signal) {
    signal?.throwIfAborted();
}
export function normalizeSc2NamespacePath(value) {
    const path = String(value)
        .replaceAll('\\', '/')
        .replace(/^\/+|\/+$/gu, '');
    if (path.length > MAX_PATH_CHARS ||
        path.includes('\0') ||
        path.split('/').some(part => part === '..')) {
        throw new TypeError('SC2 workspace entry path is not confined');
    }
    return path;
}
function basename(path) {
    return normalizeSc2NamespacePath(path).split('/').at(-1)?.toLowerCase() ?? '';
}
function markerMap(markers) {
    return new Map(markers.map(marker => [normalizeSc2NamespacePath(marker.path).toLowerCase(), marker.kind]));
}
function hasMapMarker(markers) {
    return [...markerMap(markers)].some(([path, kind]) => kind === 'file' && MAP_MARKERS.has(basename(path)));
}
export async function detectSc2MapDirectoryMarkers(markers) {
    const observed = markerMap(markers);
    const file = path => observed.get(path) === 'file';
    const objects = file('objects') || file('mapobjects');
    const height = file('t3heightmap') || file('mapheightmap');
    const regionsOrMapInfo = file('regions') || file('mapregions') || file('mapinfo');
    const matches = objects && height && regionsOrMapInfo;
    return matches
        ? {
            confidence: 0.999,
            kind: 'structure',
            note: 'loose-sc2-map-world-documents',
        }
        : {
            confidence: 0,
            kind: 'structure',
            note: 'loose-sc2-map-world-documents-missing',
        };
}
export async function detectSc2ModDirectoryMarkers(markers) {
    const observed = markerMap(markers);
    const componentList = observed.get('componentlist.sc2components') === 'file';
    /*
     * `ComponentList.SC2Components` is the mod's own manifest: it names the data, asset and map
     * components the game loads. A directory that has one is a mod unless it is a map or a campaign,
     * both of which are excluded by their own markers below.
     *
     * Corroborating content raises the score but is not required. The host hands `detect` only the
     * markers this manifest declares, and a mod's content layer is named after a locale — a
     * localization-only mod ships `enUS.SC2Data` and nothing a fixed marker list can name, so
     * requiring a named layer made every such mod unopenable.
     */
    const packageContents = [...observed].some(([path, kind]) => kind === 'directory' &&
        (path === 'assets' || /^[a-z0-9_-]+\.sc2(?:data|assets|maps)$/u.test(path)));
    const map = hasMapMarker(markers);
    const campaign = observed.get('base.sc2maps') === 'directory';
    return componentList && !map && !campaign
        ? {
            confidence: packageContents ? 0.997 : 0.95,
            kind: 'structure',
            note: packageContents
                ? 'loose-sc2-mod-components-and-data'
                : 'loose-sc2-mod-components-only',
        }
        : {
            confidence: 0,
            kind: 'structure',
            note: map
                ? 'loose-sc2-map-not-mod'
                : campaign
                    ? 'loose-sc2-campaign-not-mod'
                    : 'loose-sc2-mod-markers-missing',
        };
}
export async function detectSc2CampaignDirectoryMarkers(markers) {
    const observed = markerMap(markers);
    const componentList = observed.get('componentlist.sc2components') === 'file';
    const baseMaps = observed.get('base.sc2maps') === 'directory';
    const map = hasMapMarker(markers);
    return componentList && baseMaps && !map
        ? {
            confidence: 0.998,
            kind: 'structure',
            note: 'loose-sc2-campaign-components-and-maps',
        }
        : {
            confidence: 0,
            kind: 'structure',
            note: map ? 'loose-sc2-map-not-campaign' : 'loose-sc2-campaign-markers-missing',
        };
}
function checkPage(page) {
    if (page === null ||
        typeof page !== 'object' ||
        !Number.isSafeInteger(page.limit) ||
        page.limit <= 0 ||
        page.limit > MAX_PAGE_ITEMS) {
        throw new RangeError(`SC2 workspace page limit must be between 1 and ${MAX_PAGE_ITEMS}`);
    }
}
function pageOf(items, page, signal) {
    abort(signal);
    checkPage(page);
    const start = page.cursor === undefined ? 0 : Number(page.cursor);
    if (!Number.isSafeInteger(start) || start < 0 || start > items.length) {
        throw new RangeError('SC2 workspace page cursor is invalid');
    }
    const end = Math.min(items.length, start + page.limit);
    return Object.freeze({
        items: Object.freeze(items.slice(start, end)),
        ...(end < items.length ? { nextCursor: String(end) } : {}),
    });
}
/** The subject address a namespace member opens under (`namespace-entry-source` `openEntry`). */
export function sc2NamespaceEntrySubjectId(root, path) {
    return entryRef(root, normalizeSc2NamespacePath(path)).uri;
}
function entryRef(root, path) {
    const separator = root.uri.includes('?') ? '&' : '?';
    return Object.freeze({
        id: `${root.id}?vfs-path=${encodeURIComponent(path)}`,
        uri: `${root.uri}${separator}vfs-path=${encodeURIComponent(path)}`,
        parentIds: Object.freeze([...(root.parentIds ?? []), root.id]),
    });
}
export function createSc2NamespaceEntrySource(entries, namespace, root) {
    const byPath = new Map(entries.map(entry => [entry.path, entry]));
    const files = entries.filter(entry => entry.kind === 'file');
    return Object.freeze({
        async list(prefix, page, signal) {
            const normalized = normalizeSc2NamespacePath(prefix).toLowerCase();
            // A prefix selects a path and what is under it, never a sibling whose name starts with the
            // same text (`Base.SC2Data/GameData.xml` is not under `Base.SC2Data/GameData`).
            return pageOf(entries.filter(entry => {
                const path = entry.path.toLowerCase();
                return normalized === '' || path === normalized || path.startsWith(`${normalized}/`);
            }), page, signal);
        },
        async search(query, page, signal) {
            abort(signal);
            if (query === null ||
                typeof query !== 'object' ||
                query.kind !== 'basename-any' ||
                !Array.isArray(query.basenames) ||
                query.basenames.length === 0 ||
                query.basenames.length > 64 ||
                typeof query.caseSensitive !== 'boolean') {
                throw new TypeError('SC2 workspace search requires bounded basename-any terms');
            }
            const terms = new Set(query.basenames.map(value => query.caseSensitive ? String(value) : String(value).toLowerCase()));
            return pageOf(files.filter(entry => {
                const name = entry.name;
                return terms.has(query.caseSensitive ? name : name.toLowerCase());
            }), page, signal);
        },
        async openEntry(entryId, signal) {
            abort(signal);
            const path = normalizeSc2NamespacePath(entryId);
            const entry = byPath.get(path);
            if (entry === undefined || entry.kind !== 'file') {
                throw new RangeError(`unknown SC2 workspace file: ${path}`);
            }
            const lease = await namespace.open(path, signal);
            try {
                if (lease.value.kind !== 'bytes')
                    throw new TypeError(`${path} is not a byte file`);
            }
            finally {
                await lease.release();
            }
            return simpleLease(entryRef(root, path));
        },
    });
}
export async function walkSc2Namespace(namespace, budget, signal) {
    const entries = [];
    const seen = new Set();
    const queue = [''];
    while (queue.length > 0) {
        abort(signal);
        const directory = queue.shift();
        if (directory === undefined)
            break;
        for await (const raw of namespace.list(directory, signal)) {
            abort(signal);
            const path = normalizeSc2NamespacePath(raw.path);
            if (path === '' || seen.has(path))
                continue;
            seen.add(path);
            if (entries.length >= budget.maxNodes) {
                throw new RangeError(`SC2 workspace exceeds the ${budget.maxNodes}-entry inspection budget`);
            }
            const depth = path.split('/').length;
            if (depth > budget.maxDepth) {
                throw new RangeError(`SC2 workspace path depth exceeds the ${budget.maxDepth} limit`);
            }
            const entry = Object.freeze({
                id: path,
                path,
                name: path.split('/').at(-1) ?? path,
                kind: raw.kind,
                ...(raw.size === undefined ? {} : { size: raw.size }),
                revision: namespace.revision,
            });
            entries.push(entry);
            if (raw.kind === 'directory')
                queue.push(path);
        }
    }
    return Object.freeze(entries.sort((left, right) => left.path.localeCompare(right.path)));
}
export async function readSc2NamespaceEntry(namespace, path, limit, signal) {
    abort(signal);
    const lease = await namespace.open(normalizeSc2NamespacePath(path), signal);
    try {
        if (lease.value.kind !== 'bytes' || lease.value.size === undefined) {
            throw new TypeError(`SC2 workspace entry is not a sized byte file: ${path}`);
        }
        if (lease.value.size > BigInt(limit) || lease.value.size > BigInt(Number.MAX_SAFE_INTEGER)) {
            throw new RangeError(`SC2 workspace entry exceeds its ${limit}-byte read budget: ${path}`);
        }
        const bytes = new Uint8Array(Number(lease.value.size));
        let offset = 0;
        while (offset < bytes.byteLength) {
            abort(signal);
            const chunk = await lease.value.read(BigInt(offset), Math.min(64 * 1024, bytes.byteLength - offset), signal);
            if (chunk.byteLength === 0)
                throw new RangeError(`SC2 workspace entry ended early: ${path}`);
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return bytes;
    }
    finally {
        await lease.release();
    }
}
async function namespaceWithVirtualDocumentInfo(namespace, context, createText) {
    if (typeof createText !== 'function')
        return namespace;
    const text = createText(context.input.root.uri);
    if (typeof text !== 'string')
        return namespace;
    let visited = 0;
    for await (const entry of namespace.list('', context.signal)) {
        abort(context.signal);
        if (normalizeSc2NamespacePath(entry.path).toLowerCase() === 'documentinfo')
            return namespace;
        if (++visited >= 4_096)
            break;
    }
    const bytes = new TextEncoder().encode(text);
    const ref = entryRef(context.input.root, DOCUMENT_INFO);
    const source = Object.freeze({
        kind: 'bytes',
        ref,
        revision: namespace.revision,
        size: BigInt(bytes.byteLength),
        async read(offset, length, signal) {
            abort(signal);
            return bytes.slice(Number(offset), Number(offset) + length);
        },
        async *stream(_range, signal) {
            abort(signal);
            yield bytes;
        },
    });
    return Object.freeze({
        revision: namespace.revision,
        async *list(prefix, signal) {
            for await (const entry of namespace.list(prefix, signal))
                yield entry;
            if (normalizeSc2NamespacePath(prefix) === '') {
                yield Object.freeze({
                    path: DOCUMENT_INFO,
                    kind: 'file',
                    size: BigInt(bytes.byteLength),
                });
            }
        },
        open(path, signal) {
            return normalizeSc2NamespacePath(path).toLowerCase() === 'documentinfo'
                ? Promise.resolve(simpleLease(source))
                : namespace.open(path, signal);
        },
    });
}
function decodeEntities(value) {
    return value
        .replaceAll('&amp;', '&')
        .replaceAll('&lt;', '<')
        .replaceAll('&gt;', '>')
        .replaceAll('&quot;', '"')
        .replaceAll('&apos;', "'");
}
function documentDependencies(text) {
    const dependencies = [];
    for (const match of text.matchAll(/<Value(?:\s[^>]*)?>([^<]+)<\/Value>/giu)) {
        const value = decodeEntities(match[1].trim()).replace(/^file:/iu, '');
        if (/\.sc2(?:mod|campaign)(?:\/|$)/iu.test(value))
            dependencies.push(value);
    }
    return Object.freeze([...new Set(dependencies)]);
}
function packageLabel(uri, fallback) {
    const path = String(uri).replaceAll('\\', '/').replace(/\/$/u, '');
    try {
        return decodeURIComponent(path.split('/').at(-1) || fallback);
    }
    catch {
        return path.split('/').at(-1) || fallback;
    }
}
function createFactsSource({ root, revision, label, kind, counts, dependencies, bankSemantic, extraGroups = [], extraRelations = [], }) {
    const provenance = Object.freeze([
        Object.freeze({ label: root.uri, source: root, semanticPath: Object.freeze([]) }),
    ]);
    const factsByGroup = new Map();
    const makeFacts = (id, entries) => {
        const facts = Object.freeze(entries.map(([factId, factLabel, value, semanticPath]) => Object.freeze({
            id: factId,
            label: factLabel,
            value,
            provenance: Object.freeze([
                Object.freeze({
                    label: root.uri,
                    source: root,
                    semanticPath: Object.freeze(semanticPath),
                }),
            ]),
        })));
        factsByGroup.set(id, facts);
        return facts;
    };
    const identityFacts = makeFacts('package', [
        ['kind', 'Package kind', kind, ['package', 'kind']],
        ['revision', 'Revision', revision, ['package', 'revision']],
    ]);
    const contentFacts = makeFacts('contents', [
        ['entries', 'Entries', counts.entries, ['contents', 'entries']],
        ['files', 'Files', counts.files, ['contents', 'files']],
        ['directories', 'Directories', counts.directories, ['contents', 'directories']],
        ['gameData', 'Game data files', counts.gameData, ['contents', 'gameData']],
        ['scripts', 'Galaxy and trigger documents', counts.scripts, ['contents', 'scripts']],
        ['layouts', 'Layout files', counts.layouts, ['contents', 'layouts']],
        ['localization', 'Localized data files', counts.localization, ['contents', 'localization']],
        ['models', 'Model files', counts.models, ['contents', 'models']],
        ['textures', 'Texture files', counts.textures, ['contents', 'textures']],
    ]);
    const dependencyFacts = makeFacts('dependencies', [
        ['count', 'Declared dependencies', dependencies.length, ['dependencies']],
        ['references', 'Dependency references', dependencies, ['dependencies']],
    ]);
    factsByGroup.set('banks', bankSemantic.facts);
    for (const group of extraGroups)
        factsByGroup.set(group.id, Object.freeze([...group.facts]));
    const groups = Object.freeze([
        Object.freeze({ id: 'package', label: 'Package', factCount: identityFacts.length }),
        Object.freeze({ id: 'contents', label: 'Contents', factCount: contentFacts.length }),
        Object.freeze({
            id: 'dependencies',
            label: 'Dependencies',
            factCount: dependencyFacts.length,
        }),
        Object.freeze({ id: 'banks', label: 'Banks', factCount: bankSemantic.facts.length }),
        ...extraGroups.map(group => Object.freeze({
            id: group.id,
            label: group.label,
            factCount: group.facts.length,
        })),
    ]);
    const relations = Object.freeze([
        ...dependencies.map(value => Object.freeze({
            role: 'depends-on',
            subjectId: `sc2-dependency:${encodeURIComponent(value.toLowerCase())}`,
            label: value,
            kind: 'dependency',
            provenance,
        })),
        ...bankSemantic.relations,
        ...extraRelations,
    ]);
    const summary = Object.freeze({
        snapshotId: revision,
        identity: Object.freeze({
            subjectId: root.id,
            label,
            kind,
            type: kind === 'map'
                ? 'StarCraft II loose map'
                : kind === 'campaign'
                    ? 'StarCraft II loose campaign'
                    : 'StarCraft II loose mod',
            origins: provenance,
        }),
        groupCount: groups.length,
        relationCount: relations.length,
        ...(kind === 'map'
            ? {
                preview: Object.freeze({
                    source: root,
                    label: 'SC2 map preview (invoke view.render for PNG bytes)',
                }),
            }
            : {}),
    });
    return Object.freeze({
        summary: async (signal) => {
            abort(signal);
            return summary;
        },
        groups: (page, signal) => Promise.resolve(pageOf(groups, page, signal)),
        facts: (groupId, page, signal) => {
            const facts = factsByGroup.get(groupId);
            if (facts === undefined)
                throw new RangeError(`unknown SC2 package fact group: ${groupId}`);
            return Promise.resolve(pageOf(facts, page, signal));
        },
        relations: (page, signal) => Promise.resolve(pageOf(relations, page, signal)),
    });
}
function classify(entries) {
    const files = entries.filter(entry => entry.kind === 'file');
    const lower = files.map(entry => entry.path.toLowerCase());
    return Object.freeze({
        entries: entries.length,
        files: files.length,
        directories: entries.length - files.length,
        gameData: lower.filter(path => /(?:^|\/)gamedata\/[^/]+\.xml$/u.test(path)).length,
        scripts: lower.filter(path => path.endsWith('.galaxy') || basename(path) === 'triggers').length,
        layouts: lower.filter(path => path.endsWith('.sc2layout')).length,
        localization: lower.filter(path => /(?:^|\/)[a-z]{4}\.sc2data\/localizeddata\//u.test(path))
            .length,
        models: lower.filter(path => path.endsWith('.m3') || path.endsWith('.m3a')).length,
        textures: lower.filter(path => /\.(?:dds|tga|png)$/u.test(path)).length,
        mapDocuments: lower.filter(path => MAP_MARKERS.has(basename(path))),
    });
}
function topLevelTree(entries, label, kind, semanticChildren = []) {
    return createTreeDataSource({
        kind,
        label,
        preview: `${entries.filter(entry => entry.kind === 'file').length} files`,
        children: [
            ...entries
                .filter(entry => !entry.path.includes('/'))
                .map(entry => ({
                kind: entry.kind,
                label: entry.name,
                preview: entry.size === undefined ? undefined : `${entry.size} bytes`,
            })),
            ...semanticChildren,
        ],
    });
}
export function createSc2NamespaceDefinition(options) {
    const kind = options.kind;
    const formatId = options.formatId ??
        (kind === 'map'
            ? 'sc2-map-directory'
            : kind === 'campaign'
                ? 'sc2-campaign-directory'
                : 'sc2-mod-directory');
    const displayName = options.displayName ??
        (kind === 'map'
            ? 'StarCraft II loose map'
            : kind === 'campaign'
                ? 'StarCraft II loose campaign'
                : 'StarCraft II loose mod');
    const topology = options.topology ?? 'mounted-directory';
    const packed = options.packed ?? false;
    const detector = kind === 'map'
        ? detectSc2MapDirectoryMarkers
        : kind === 'campaign'
            ? detectSc2CampaignDirectoryMarkers
            : detectSc2ModDirectoryMarkers;
    const detect = async (markers, uri = '') => {
        const detected = await detector(markers);
        if (detected.confidence > 0 || kind !== 'campaign')
            return detected;
        const observed = markerMap(markers);
        const installed = /\.sc2campaign$/iu.test(String(uri).replaceAll('\\', '/').replace(/\/+$/u, '')) &&
            observed.get('base.sc2data') === 'directory' &&
            !hasMapMarker(markers);
        return installed
            ? {
                confidence: 0.96,
                kind: 'structure',
                note: 'installed-sc2-campaign-data',
            }
            : detected;
    };
    return Object.freeze({
        id: options.id,
        version: '1.0.0',
        format: Object.freeze({ id: formatId, label: displayName }),
        operations: Object.freeze([
            Object.freeze({
                id: 'container.extract',
                handlerId: 'extract-entry',
                mutatesSource: false,
                requiredPermissions: Object.freeze(['read-source']),
                outputKinds: Object.freeze(['bytes']),
            }),
            ...(options.operations ?? []),
        ]),
        namespace: Object.freeze({
            detect,
            async inspect(namespace, context) {
                abort(context.signal);
                const effectiveNamespace = await namespaceWithVirtualDocumentInfo(namespace, context, options.virtualDocumentInfo);
                const entries = await walkSc2Namespace(effectiveNamespace, context.budget, context.signal);
                const counts = classify(entries);
                if (kind === 'map' && counts.mapDocuments.length < 3) {
                    throw new TypeError('SC2 loose map does not contain the required world documents');
                }
                const componentList = entries.some(entry => entry.path.toLowerCase() === 'componentlist.sc2components');
                const installedCampaign = kind === 'campaign' &&
                    /\.sc2campaign$/iu.test(context.input.root.uri.replaceAll('\\', '/').replace(/\/+$/u, '')) &&
                    entries.some(entry => entry.kind === 'directory' && entry.path.toLowerCase() === 'base.sc2data');
                if (kind !== 'map' && !componentList && !installedCampaign) {
                    throw new TypeError('SC2 loose package does not contain ComponentList.SC2Components');
                }
                const info = entries.find(entry => entry.kind === 'file' && entry.path.toLowerCase() === 'documentinfo');
                let dependencies = Object.freeze([]);
                const diagnostics = [];
                if (info !== undefined) {
                    try {
                        const text = new TextDecoder('utf-8', { fatal: false }).decode(await readSc2NamespaceEntry(effectiveNamespace, info.path, MAX_METADATA_BYTES, context.signal));
                        dependencies = documentDependencies(text);
                    }
                    catch (error) {
                        diagnostics.push({
                            id: 'sc2-workspace-document-info-unreadable',
                            code: 'blizzard/sc2-workspace-document-info-unreadable',
                            category: 'structure',
                            severity: 'warning',
                            message: `DocumentInfo could not be summarized: ${error instanceof Error ? error.message : String(error)}`,
                        });
                    }
                }
                const root = context.input.root;
                const revision = String(context.input.revisions.namespaceRevision);
                const label = packageLabel(root.uri, displayName);
                const bankSemantic = await inspectSc2BankWorkspace({
                    entries,
                    namespace: effectiveNamespace,
                    budget: context.budget,
                    signal: context.signal,
                    root,
                    revision,
                    label,
                    kind,
                    readEntry: (path, limit, signal) => readSc2NamespaceEntry(effectiveNamespace, path, limit, signal),
                });
                diagnostics.push(...bankSemantic.diagnostics);
                const namespaceSource = createSc2NamespaceEntrySource(entries, effectiveNamespace, root);
                const extension = (await options.extendInspection?.({
                    entries,
                    namespace: effectiveNamespace,
                    context,
                    root,
                    revision,
                    declaredDependencies: dependencies,
                    namespaceSource,
                    bankSemantic,
                    readEntry: (path, limit = context.budget.maxScalarBytes, signal = context.signal) => readSc2NamespaceEntry(effectiveNamespace, path, limit, signal),
                })) ?? {};
                return {
                    detection: await detect(entries
                        .filter(entry => [
                        'componentlist.sc2components',
                        'base.sc2data',
                        'base.sc2assets',
                        'base.sc2maps',
                        'assets',
                        'mapinfo',
                        'objects',
                        'regions',
                        't3heightmap',
                    ].includes(entry.path.toLowerCase()))
                        .map(entry => ({ path: entry.path, kind: entry.kind, size: entry.size })), root.uri),
                    summary: {
                        format: formatId,
                        topology,
                        packageKind: kind,
                        entries: counts.entries,
                        files: counts.files,
                        directories: counts.directories,
                        gameDataEntries: counts.gameData,
                        scripts: counts.scripts,
                        layouts: counts.layouts,
                        localizedData: counts.localization,
                        models: counts.models,
                        textures: counts.textures,
                        mapDocuments: counts.mapDocuments,
                        dependencies,
                        ...bankSemantic.summary,
                        ...(extension.summary ?? {}),
                    },
                    metadata: [
                        {
                            id: 'sc2-workspace',
                            label: displayName,
                            entries: [
                                { key: 'topology', value: topology },
                                { key: 'packageKind', value: kind },
                                { key: 'entries', value: counts.entries },
                                { key: 'files', value: counts.files },
                                { key: 'gameDataEntries', value: counts.gameData },
                                { key: 'scripts', value: counts.scripts },
                                { key: 'layouts', value: counts.layouts },
                                { key: 'localizedData', value: counts.localization },
                                { key: 'dependencies', value: dependencies },
                                { key: 'bankLists', value: bankSemantic.summary.bankLists },
                                { key: 'declaredBanks', value: bankSemantic.summary.declaredBanks },
                                { key: 'bankFiles', value: bankSemantic.summary.bankFiles },
                                { key: 'bankSections', value: bankSemantic.summary.bankSections },
                                { key: 'bankKeys', value: bankSemantic.summary.bankKeys },
                                { key: 'galaxyBankLoads', value: bankSemantic.summary.galaxyBankLoads },
                            ],
                        },
                        ...(extension.metadata ?? []),
                    ],
                    traits: [
                        { id: 'container.entries', parameters: { count: counts.entries } },
                        { id: 'structure.hierarchy', parameters: { entries: counts.entries } },
                        ...(kind === 'map'
                            ? [
                                {
                                    id: 'game.map',
                                    parameters: { packed, documents: counts.mapDocuments.length },
                                },
                            ]
                            : []),
                        ...(counts.gameData === 0
                            ? []
                            : [{ id: 'game.catalog', parameters: { files: counts.gameData } }]),
                        ...(counts.layouts === 0
                            ? []
                            : [{ id: 'game.layout', parameters: { files: counts.layouts } }]),
                        ...(counts.localization === 0
                            ? []
                            : [{ id: 'game.localization', parameters: { files: counts.localization } }]),
                        ...(counts.scripts === 0
                            ? []
                            : [{ id: 'content.scripts', parameters: { files: counts.scripts } }]),
                        ...(extension.traits ?? []),
                    ],
                    dataSources: {
                        'common.view/namespace-entry-source': namespaceSource,
                        'common.view/tree-data-source': topLevelTree(entries, label, kind, [
                            bankSemantic.treeNode,
                            ...(extension.treeNodes ?? []),
                        ]),
                        'common.view/table-data-source': createTableDataSource(['Path', 'Bank', 'Section', 'Key', 'Type', 'Value'], bankSemantic.tableRows),
                        'common.view/relation-graph-source': bankSemantic.relationGraphSource,
                        'common.view/subject-facts-source': createFactsSource({
                            root,
                            revision,
                            label,
                            kind,
                            counts,
                            dependencies,
                            bankSemantic,
                            extraGroups: extension.factGroups,
                            extraRelations: extension.factRelations,
                        }),
                        ...(extension.dataSources ?? {}),
                    },
                    handlers: {
                        'extract-entry': async (input) => {
                            if (input === null || typeof input !== 'object' || Array.isArray(input)) {
                                throw new TypeError('container.extract requires {entryId}');
                            }
                            const path = normalizeSc2NamespacePath(input.entryId ?? '');
                            const entry = entries.find(value => value.path === path && value.kind === 'file');
                            if (entry === undefined)
                                throw new RangeError(`unknown SC2 workspace file: ${path}`);
                            const maximum = Math.min(Number(context.budget.maxScalarBytes), Number(context.budget.maxInputBytes));
                            return {
                                kind: 'bytes',
                                value: await readSc2NamespaceEntry(effectiveNamespace, path, maximum, context.signal),
                            };
                        },
                        ...(extension.handlers ?? {}),
                    },
                    diagnostics: [...diagnostics, ...(extension.diagnostics ?? [])],
                    maxDecodedBytes: context.budget.maxScalarBytes,
                    unsupportedFeatures: [
                        'dependency-roots-not-resolved-by-codec',
                        'directory-writeback-not-advertised',
                        'bank-and-bank-list-writeback-not-advertised',
                        'native-signing-and-launch',
                        ...(extension.unsupportedFeatures ?? []),
                    ],
                };
            },
        }),
    });
}
export function createSc2DirectoryCodec(options, context) {
    return createInspectionCodec(createSc2NamespaceDefinition(options), context);
}
// Kept as a source-compatible name for the existing loose-directory adapters. Both loose and
// packed aliases now execute the same namespace semantic definition.
export const createSc2DirectoryDefinition = createSc2NamespaceDefinition;
//# sourceMappingURL=runtime.js.map