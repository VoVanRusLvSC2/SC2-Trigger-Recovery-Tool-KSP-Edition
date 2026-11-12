/**
 * The Mod card: what a reader wants to know about a mod before opening any of its files.
 *
 * Identity comes from the package's own documents (the localized names in DocumentHeader, the icon
 * in DocumentInfo), then what it depends on, what the component list says the game loads, how
 * much data, text and art it carries, and links to the documents a modder opens next. Every entity
 * of the mod is lent through the selector the entity cards use, so a unit listed here opens its own
 * card, resolved against the whole mod and its strings.
 */
import { getAttr, provenanceOf, scanXml } from '@modkit/codec-kit';
import { starcraft2NamespaceForType } from '@modkit/blizzard-starcraft2/schema';
import { entitySubjectId, entitySubjects } from '../../../../data/codecs/sc2data/src/entity-cards.js';
import { parseComponentListEntries } from '../../document-metadata/core/component-list.js';
import { parseDependency, entryLocale } from '../../document-metadata/facts.js';
import { sc2NamespaceEntrySubjectId } from '../../../../../shared/package-namespace/runtime.js';
const utf8 = new TextDecoder('utf-8', { fatal: false });
function fileText(files, name) {
    const lower = name.toLowerCase();
    const found = [...files].find(([path]) => path.toLowerCase() === lower);
    return found === undefined ? undefined : utf8.decode(found[1]);
}
/** Documents a modder opens next, in the order they are usually wanted. */
const MAIN_DOCUMENTS = [
    /^documentinfo$/iu,
    /^documentheader$/iu,
    /^componentlist\.sc2components$/iu,
    /(^|\/)gamedata\.xml$/iu,
    /(^|\/)gamedata\/[^/]+\.xml$/iu,
    /(^|\/)localizeddata\/gamestrings\.txt$/iu,
    /(^|\/)gametext\//iu,
    /(^|\/)triggers$/iu,
];
const ASSET = /\.(dds|tga|png|jpg|m3|m3a|m3h|ogg|wav|mp3|ogv|webm|fx)$/iu;
const encode = (value) => encodeURIComponent(value);
const decode = (value) => decodeURIComponent(value);
function resourcePage(items, cursor, limit) {
    if (!Number.isSafeInteger(limit) || limit <= 0)
        throw new TypeError('tree page limit must be positive');
    const start = cursor === undefined ? 0 : Number(cursor);
    if (!Number.isSafeInteger(start) || start < 0 || start > items.length) {
        throw new RangeError('tree page cursor is invalid');
    }
    const page = items.slice(start, start + limit);
    return Object.freeze({
        items: Object.freeze(page),
        ...(start + page.length < items.length ? { nextCursor: String(start + page.length) } : {}),
    });
}
/** Legacy Resources coverage over the one resolved mod model, exposed through the common tree ABI. */
export function modResourceTree(input) {
    const files = Object.freeze(input.entries.filter(entry => entry.kind === 'file'));
    const fileByPath = new Map(files.map(entry => [entry.path, entry]));
    const entryByLowerPath = new Map(files.map(entry => [entry.path.toLowerCase(), entry]));
    /*
     * Files lists what Modkit actually read into the model, not every byte the package happens to
     * carry: an installed package holds tens of thousands of assets no reader ever opens, and a tree
     * of those answers no authoring question. Grouping is by file type, which is what the reader
     * routes on anyway.
     */
    const loadedPaths = Object.freeze([...input.files.keys()].sort());
    const fileTypeOf = (path) => {
        const name = path.split('/').at(-1) ?? path;
        const dot = name.lastIndexOf('.');
        return dot <= 0 ? 'No extension' : name.slice(dot + 1).toLowerCase();
    };
    const pathsByType = new Map();
    for (const path of loadedPaths) {
        const type = fileTypeOf(path);
        const known = pathsByType.get(type);
        if (known === undefined)
            pathsByType.set(type, [path]);
        else
            known.push(path);
    }
    const fileTypes = Object.freeze([...pathsByType.keys()].sort());
    /*
     * Dependencies shows the whole chain the engine loads, Core first, not only what this package
     * declares: a package that names Void alone still loads Core, Liberty and Swarm underneath it,
     * and an author who cannot see that cannot reason about where a value comes from.
     */
    const chain = input.dependencyChain !== undefined && input.dependencyChain.length > 0
        ? input.dependencyChain
        : Object.freeze(input.dependencies.map(value => Object.freeze({ path: value, required: true, basis: 'declared' })));
    const documentInfoPath = loadedPaths.find(path => path.toLowerCase() === 'documentinfo');
    const DEFAULT_KEY_PREFIX = 'default/';
    const declarationCache = new Map();
    let declarationsIndexed = false;
    const declarationsOf = (namespace) => {
        if (declarationsIndexed)
            return declarationCache.get(namespace) ?? new Map();
        for (const [path, bytes] of input.files) {
            if (!/\.xml$/iu.test(path))
                continue;
            const text = utf8.decode(bytes);
            let line = 0;
            let lineStart = 0;
            let scanned = 0;
            const entities = scanXml(text).filter(root => root.tag === 'Catalog').flatMap(root => root.children);
            for (const element of entities) {
                const entityNamespace = starcraft2NamespaceForType(element.tag);
                if (entityNamespace === undefined)
                    continue;
                const at = element.start;
                for (let index = scanned; index < at; index += 1) {
                    if (text.charCodeAt(index) === 10) {
                        line += 1;
                        lineStart = index + 1;
                    }
                }
                scanned = at;
                const id = getAttr(element, 'id')?.value;
                const key = id !== undefined && id !== ''
                    ? `entity/${id}`
                    : `${DEFAULT_KEY_PREFIX}${element.tag}`;
                let found = declarationCache.get(entityNamespace);
                if (found === undefined)
                    declarationCache.set(entityNamespace, found = new Map());
                // Later loaded declarations override earlier ones, including repeats within a document.
                found.set(key, Object.freeze({
                    path,
                    utf16Offset: at,
                    utf16Length: element.openEnd - at,
                    line,
                    column: at - lineStart,
                }));
            }
        }
        declarationsIndexed = true;
        return declarationCache.get(namespace) ?? new Map();
    };
    const matching = (pattern) => Object.freeze(files.filter(entry => pattern.test(entry.path)));
    const categories = Object.freeze([
        { id: 'gamedata', label: 'GameData', kind: 'data-category' },
        { id: 'strings', label: 'Strings', kind: 'strings-category' },
        { id: 'galaxy', label: 'Galaxy', kind: 'script-category', files: matching(/(?:\.galaxy$|(?:^|\/)triggers$)/iu) },
        { id: 'layouts', label: 'Layouts', kind: 'layout-category', files: matching(/\.sc2layout$/iu) },
        { id: 'asset-aliases', label: 'Asset aliases', kind: 'asset-alias-category', files: matching(/(?:^|\/)(?:assets|assetsproduct|assetaliases)\.txt$/iu) },
        { id: 'editor-categories', label: 'EditorCategories', kind: 'editor-category', files: matching(/(?:^|\/)editorcategories\.(?:xml|txt)$/iu) },
        { id: 'font-styles', label: 'FontStyles', kind: 'style-category', files: matching(/(?:^|\/)fontstyles(?:\.sc2style|\.txt)?$/iu) },
        { id: 'files', label: 'Files', kind: 'files-category' },
        { id: 'dependencies', label: 'Dependencies', kind: 'dependency-category' },
    ]);
    const categoryById = new Map(categories.map(category => [category.id, category]));
    const namespaceByName = new Map(input.namespaces.map(item => [item.ns, item]));
    const ref = (id, hasChildren = false) => Object.freeze({ id, hasChildren });
    const hasChildren = (category) => {
        if (category.id === 'files')
            return loadedPaths.length > 0;
        if (category.id === 'gamedata' || category.id === 'strings')
            return true;
        if (category.id === 'dependencies')
            return true;
        return (category.files?.length ?? 0) > 0;
    };
    const categoryRef = (category) => ref(`category/${category.id}`, hasChildren(category));
    const fileRef = (path) => ref(`file/${encode(path)}`);
    const fileTypeRef = (type) => ref(`filetype/${encode(type)}`, true);
    const namespaceRef = (namespace) => ref(`namespace/${encode(namespace)}`, true);
    const entityRef = (namespace, id) => ref(`entity/${encode(namespace)}/${encode(id)}`);
    const defaultsRef = (namespace) => ref(`defaults/${encode(namespace)}`, true);
    const defaultRef = (namespace, className) => ref(`default/${encode(namespace)}/${encode(className)}`);
    const defaultClasses = (namespace) => {
        const all = input.mod.all(namespace);
        return [...new Set(all.filter(entity => !entity.id).map(entity => entity.class ?? `C${namespace}`))];
    };
    const localeRef = (locale) => ref(`locale/${encode(locale)}`, true);
    const stringCatalogRef = (locale, catalog) => ref(`strings/${encode(locale)}/${encode(catalog)}`, true);
    const stringRef = (locale, catalog, key) => ref(`string/${encode(locale)}/${encode(catalog)}/${encode(key)}`);
    const stringGroupRef = (locale, catalog, group) => ref(`stringgroup/${encode(locale)}/${encode(catalog)}/${encode(group)}`, true);
    /**
     * String keys are a path namespace — `Unit/Name/Zealot`, `Button/Tooltip/Attack` — so a flat list
     * of thousands is unusable. The leading segment is the grouping the game itself uses; a key with
     * no separator has none and is listed on its own.
     */
    const UNGROUPED = '(no category)';
    const stringGroupOf = (key) => {
        const cut = key.indexOf('/');
        return cut <= 0 ? UNGROUPED : key.slice(0, cut);
    };
    const stringGroups = (locale, catalog) => {
        const keys = input.mod.locales.get(locale)?.get(catalog)?.keys() ?? [];
        return Object.freeze([...new Set([...keys].map(stringGroupOf))].sort());
    };
    const stringKeysIn = (locale, catalog, group) => {
        const keys = input.mod.locales.get(locale)?.get(catalog)?.keys() ?? [];
        return Object.freeze([...keys].filter(key => stringGroupOf(key) === group).sort());
    };
    /** Where each key of one locale's catalog is written, built once per catalog on first use. */
    const stringDeclarationCache = new Map();
    const stringDeclarationsOf = (locale, catalog) => {
        const cacheKey = `${locale.toLowerCase()}|${catalog.toLowerCase()}`;
        const known = stringDeclarationCache.get(cacheKey);
        if (known !== undefined)
            return known;
        const wanted = `${locale.toLowerCase()}.sc2data/localizeddata/${catalog.toLowerCase()}.txt`;
        const found = new Map();
        const path = loadedPaths.find(item => item.toLowerCase().endsWith(wanted));
        const bytes = path === undefined ? undefined : input.files.get(path);
        if (path !== undefined && bytes !== undefined) {
            const text = utf8.decode(bytes);
            let offset = 0;
            let line = 0;
            for (const raw of text.split('\n')) {
                const separator = raw.indexOf('=');
                const key = separator <= 0 ? undefined : raw.slice(0, separator).trim();
                if (key !== undefined && key !== '' && !key.startsWith('//') && !found.has(key)) {
                    found.set(key, Object.freeze({ path, utf16Offset: offset, utf16Length: key.length, line, column: 0 }));
                }
                offset += raw.length + 1;
                line += 1;
            }
        }
        stringDeclarationCache.set(cacheKey, found);
        return found;
    };
    const dependencyRef = (index) => ref(`dependency/${index}`);
    const children = (node) => {
        if (node.id === 'root')
            return categories.map(categoryRef);
        const parts = node.id.split('/');
        if (parts[0] === 'category') {
            const category = categoryById.get(parts[1] ?? '');
            if (category === undefined)
                return [];
            if (category.id === 'gamedata')
                return input.namespaces.map(item => namespaceRef(item.ns));
            if (category.id === 'strings')
                return [...input.mod.locales.keys()].sort().map(localeRef);
            if (category.id === 'dependencies')
                return chain.map((_, index) => dependencyRef(index));
            if (category.id === 'files')
                return fileTypes.map(fileTypeRef);
            return (category.files ?? []).map(entry => fileRef(entry.path));
        }
        if (parts[0] === 'filetype') {
            return (pathsByType.get(decode(parts[1] ?? '')) ?? []).map(fileRef);
        }
        if (parts[0] === 'namespace') {
            const namespace = decode(parts[1] ?? '');
            const all = input.mod.all(namespace);
            /*
             * A catalog's declaration defaults — `<CAlert default="1">` with no id — are entities of the
             * data space, and the count includes them. Dropping them silently left a namespace that
             * reads «1» and opens to nothing, which is how Accumulator and Achievement looked.
             */
            const defaults = all.filter(entity => typeof entity.id !== 'string' || entity.id === '');
            return [
                ...(defaults.length === 0 ? [] : [defaultsRef(namespace)]),
                ...all
                    .filter(entity => typeof entity.id === 'string' && entity.id !== '')
                    .map(entity => entityRef(namespace, entity.id)),
            ];
        }
        if (parts[0] === 'defaults') {
            const namespace = decode(parts[1] ?? '');
            return defaultClasses(namespace).map(className => defaultRef(namespace, className));
        }
        if (parts[0] === 'locale') {
            const locale = decode(parts[1] ?? '');
            return [...(input.mod.locales.get(locale)?.keys() ?? [])].sort().map(catalog => stringCatalogRef(locale, catalog));
        }
        if (parts[0] === 'strings') {
            const locale = decode(parts[1] ?? '');
            const catalog = decode(parts[2] ?? '');
            return stringGroups(locale, catalog).map(group => stringGroupRef(locale, catalog, group));
        }
        if (parts[0] === 'stringgroup') {
            const locale = decode(parts[1] ?? '');
            const catalog = decode(parts[2] ?? '');
            const group = decode(parts.slice(3).join('/'));
            return stringKeysIn(locale, catalog, group).map(key => stringRef(locale, catalog, key));
        }
        return [];
    };
    const facts = (node) => {
        if (node.id === 'root')
            return Object.freeze({ kind: 'resources', label: 'Resources', preview: `${files.length} files` });
        const parts = node.id.split('/');
        if (parts[0] === 'category') {
            const category = categoryById.get(parts[1] ?? '');
            if (category === undefined)
                throw new TypeError(`unknown resource category ${node.id}`);
            const count = category.id === 'gamedata'
                ? input.namespaces.reduce((sum, item) => sum + item.total, 0)
                : category.id === 'strings'
                    ? [...input.mod.locales.values()].reduce((sum, catalogs) => sum + [...catalogs.values()].reduce((catalogSum, values) => catalogSum + values.size, 0), 0)
                    : category.id === 'dependencies'
                        ? chain.length
                        : category.id === 'files'
                            ? loadedPaths.length
                            : category.files?.length ?? 0;
            // This count describes this model only. A layer overlay must not sum it: declarations
            // can override the same resource, and category totals need not count immediate children.
            return Object.freeze({ kind: category.kind, label: category.label, preview: String(count), value: count });
        }
        if (parts[0] === 'filetype') {
            const type = decode(parts[1] ?? '');
            const paths = pathsByType.get(type);
            if (paths === undefined)
                throw new TypeError(`unknown resource file type ${type}`);
            return Object.freeze({ kind: 'file-type', label: type, preview: String(paths.length) });
        }
        if (parts[0] === 'namespace') {
            const namespace = decode(parts[1] ?? '');
            const summary = namespaceByName.get(namespace);
            if (summary === undefined)
                throw new TypeError(`unknown data namespace ${namespace}`);
            return Object.freeze({
                kind: 'data-namespace',
                label: namespace,
                preview: `${summary.total} · ${summary.own} own`,
                value: summary.total,
            });
        }
        if (parts[0] === 'defaults') {
            const namespace = decode(parts[1] ?? '');
            const count = defaultClasses(namespace).length;
            return Object.freeze({
                kind: 'data-defaults',
                label: 'Defaults',
                preview: String(count),
                value: count,
            });
        }
        if (parts[0] === 'default') {
            const namespace = decode(parts[1] ?? '');
            const className = decode(parts[2] ?? '');
            if (!defaultClasses(namespace).includes(className))
                throw new TypeError(`unknown default ${node.id}`);
            const declaration = declarationsOf(namespace).get(`${DEFAULT_KEY_PREFIX}${className}`);
            return Object.freeze({
                kind: 'data-default',
                label: className,
                preview: declaration?.path ?? namespace,
                ...(declaration === undefined
                    ? {}
                    : {
                        subjectId: sc2NamespaceEntrySubjectId(input.root, declaration.path),
                        range: Object.freeze({
                            utf16Offset: declaration.utf16Offset,
                            utf16Length: declaration.utf16Length,
                            line: declaration.line,
                            column: declaration.column,
                        }),
                    }),
            });
        }
        if (parts[0] === 'entity') {
            const namespace = decode(parts[1] ?? '');
            const id = decode(parts[2] ?? '');
            // Opening an entity goes to the document that declares it. Without a declaration in this
            // package — an entity inherited from a dependency — the logical subject stays the address.
            const declaration = declarationsOf(namespace).get(`entity/${id}`);
            if (declaration === undefined) {
                return Object.freeze({
                    kind: namespace,
                    label: id,
                    subjectId: entitySubjectId(namespace, id),
                });
            }
            return Object.freeze({
                kind: namespace,
                label: id,
                preview: declaration.path,
                subjectId: sc2NamespaceEntrySubjectId(input.root, declaration.path),
                range: Object.freeze({
                    utf16Offset: declaration.utf16Offset,
                    utf16Length: declaration.utf16Length,
                    line: declaration.line,
                    column: declaration.column,
                }),
            });
        }
        if (parts[0] === 'locale') {
            const locale = decode(parts[1] ?? '');
            const catalogs = input.mod.locales.get(locale);
            const count = [...(catalogs?.values() ?? [])].reduce((sum, values) => sum + values.size, 0);
            const label = /^[a-z]{4}$/iu.test(locale)
                ? `${locale.slice(0, 2).toLowerCase()}${locale.slice(2).toUpperCase()}`
                : locale;
            return Object.freeze({ kind: 'locale', label, preview: String(count) });
        }
        if (parts[0] === 'strings') {
            const locale = decode(parts[1] ?? '');
            const catalog = decode(parts[2] ?? '');
            return Object.freeze({ kind: 'string-catalog', label: catalog, preview: String(input.mod.locales.get(locale)?.get(catalog)?.size ?? 0) });
        }
        if (parts[0] === 'stringgroup') {
            const locale = decode(parts[1] ?? '');
            const catalog = decode(parts[2] ?? '');
            const group = decode(parts.slice(3).join('/'));
            return Object.freeze({
                kind: 'string-group',
                label: group,
                preview: String(stringKeysIn(locale, catalog, group).length),
            });
        }
        if (parts[0] === 'string') {
            const locale = decode(parts[1] ?? '');
            const catalog = decode(parts[2] ?? '');
            const key = decode(parts.slice(3).join('/'));
            const preview = input.mod.locales.get(locale)?.get(catalog)?.get(key);
            const declaration = stringDeclarationsOf(locale, catalog).get(key);
            return Object.freeze({
                kind: 'string',
                label: key,
                ...(preview === undefined ? {} : { preview }),
                ...(declaration === undefined
                    ? {}
                    : {
                        subjectId: sc2NamespaceEntrySubjectId(input.root, declaration.path),
                        range: Object.freeze({
                            utf16Offset: declaration.utf16Offset,
                            utf16Length: declaration.utf16Length,
                            line: declaration.line,
                            column: declaration.column,
                        }),
                    }),
            });
        }
        if (parts[0] === 'file') {
            const path = decode(parts.slice(1).join('/'));
            // A loaded file is addressed by the reader's normalized path; the namespace entry that
            // carries its size may be spelled differently, and its absence is not a missing resource.
            const entry = fileByPath.get(path) ?? entryByLowerPath.get(path.toLowerCase());
            const size = entry?.size ?? input.files.get(path)?.byteLength;
            if (entry === undefined && !input.files.has(path)) {
                throw new TypeError(`unknown resource file ${path}`);
            }
            const cut = path.lastIndexOf('/');
            return Object.freeze({
                kind: 'file',
                label: cut === -1 ? path : path.slice(cut + 1),
                preview: size === undefined ? path : `${path} · ${String(size)} bytes`,
                subjectId: sc2NamespaceEntrySubjectId(input.root, path),
            });
        }
        if (parts[0] === 'dependency') {
            const index = Number(parts[1]);
            const link = chain[index];
            if (link === undefined)
                throw new TypeError(`unknown dependency ${node.id}`);
            const parsed = parseDependency(link.path);
            return Object.freeze({
                kind: 'dependency',
                label: parsed.name,
                preview: `${index + 1}. ${link.path}${link.basis === 'declared' ? '' : ` · ${link.basis}`}`,
                // A declared dependency is declared in this package's DocumentInfo; an engine-implicit one
                // is declared nowhere, so it opens nothing rather than opening a file that does not say it.
                ...(link.basis === 'declared' && documentInfoPath !== undefined
                    ? { subjectId: sc2NamespaceEntrySubjectId(input.root, documentInfoPath) }
                    : {}),
            });
        }
        throw new TypeError(`unknown resource node ${node.id}`);
    };
    const source = Object.freeze({
        async root() {
            return ref('root', true);
        },
        async children(node, page, signal) {
            signal?.throwIfAborted();
            return resourcePage(children(node), page.cursor, page.limit);
        },
        async facts(node) {
            return facts(node);
        },
        async *search(query, signal) {
            const needle = query.pattern.toLocaleLowerCase();
            const pending = [ref('root', true)];
            while (pending.length > 0) {
                signal?.throwIfAborted();
                const node = pending.pop();
                const value = facts(node);
                if (`${value.label}\n${value.preview ?? ''}`.toLocaleLowerCase().includes(needle))
                    yield node;
                pending.push(...[...children(node)].reverse());
            }
        },
    });
    return source;
}
export function modCardFacts(input) {
    const fact = (id, label, value, extra = {}) => Object.freeze({
        id,
        label,
        value,
        provenance: provenanceOf(input.root, extra.path ?? [id]),
        ...(extra.locale === undefined ? {} : { locale: extra.locale }),
        ...(extra.note === undefined ? {} : { note: extra.note }),
    });
    const identity = [];
    for (const entry of input.mod.documentHeader?.entries ?? []) {
        if (!entry.key.startsWith('DocInfo/'))
            continue;
        const locale = entryLocale(entry.type);
        const key = entry.key.slice('DocInfo/'.length);
        const id = key === 'Name' ? 'name' : key === 'DescShort' ? 'description' : key;
        identity.push(fact(id, key, entry.value, { ...(locale === undefined ? {} : { locale }), path: ['DocumentHeader', entry.key] }));
    }
    const icon = /<Icon>\s*<Value>([^<]+)<\/Value>/iu.exec(fileText(input.files, 'DocumentInfo') ?? '')?.[1]?.trim();
    if (icon !== undefined)
        identity.push(fact('icon', 'Icon', icon, { path: ['DocumentInfo', 'Icon'] }));
    const dependencies = input.dependencies.map((value, index) => {
        const parsed = parseDependency(value);
        return fact(`dependency-${index}`, parsed.name, {
            ...(parsed.bnetId === undefined ? {} : { 'Battle.net id': parsed.bnetId }),
            ...(parsed.version === undefined ? {} : { version: parsed.version }),
            ...(parsed.file === undefined ? {} : { file: parsed.file }),
        }, { path: ['DocumentInfo', 'Dependencies', String(index)] });
    });
    const componentText = fileText(input.files, 'ComponentList.SC2Components');
    const components = (componentText === undefined ? [] : parseComponentListEntries(componentText)).map((component, index) => fact(`component-${index}`, component.locale === undefined ? component.type : `${component.type} (${component.locale})`, component.path, { path: ['ComponentList.SC2Components', String(index)] }));
    const files = input.entries.filter(entry => entry.kind === 'file');
    const locales = [...input.mod.locales.keys()].sort();
    const counts = [
        fact('entities', 'Entities', input.namespaces.reduce((sum, item) => sum + item.total, 0), { note: 'Including entities inherited from dependencies' }),
        fact('own-entities', 'Own entities', input.namespaces.reduce((sum, item) => sum + item.own, 0)),
        fact('namespaces', 'Data namespaces', input.namespaces.filter(item => item.own > 0).map(item => `${item.ns}: ${item.own}`)),
        ...locales.map(locale => {
            const size = [...(input.mod.locales.get(locale)?.values() ?? [])].reduce((sum, file) => sum + file.size, 0);
            return fact(`strings-${locale}`, `Strings (${locale})`, size);
        }),
        fact('assets', 'Asset files', files.filter(entry => ASSET.test(entry.path)).length),
        fact('files', 'Files', files.length),
    ];
    const relations = [];
    for (const pattern of MAIN_DOCUMENTS) {
        for (const entry of files) {
            if (!pattern.test(entry.path))
                continue;
            const subjectId = sc2NamespaceEntrySubjectId(input.root, entry.path);
            if (relations.some(item => item.subjectId === subjectId))
                continue;
            relations.push(Object.freeze({ role: 'Documents', subjectId, label: entry.path, kind: 'file' }));
        }
    }
    const unitIds = input.namespaces.some(item => item.ns === 'Unit' && item.own > 0);
    if (unitIds) {
        for (const entity of input.mod.all('Unit')) {
            if (entity.id === '')
                continue;
            relations.push(Object.freeze({ role: 'Units', subjectId: entitySubjectId('Unit', entity.id), label: entity.id, kind: 'Unit' }));
        }
    }
    // Dependency links are the package namespace's own (`depends-on`), published beside these.
    return {
        factGroups: [
            { id: 'overview', label: 'Mod', facts: identity },
            { id: 'mod-dependencies', label: 'Dependencies', facts: dependencies },
            { id: 'components', label: 'Components', facts: components },
            { id: 'mod-contents', label: 'Contents', facts: counts },
        ].filter(group => group.facts.length > 0),
        factRelations: relations,
        selector: entitySubjects(input.mod, { snapshotId: input.revision, source: input.root }),
    };
}
