import { parseCatalogXml } from '../../../data/shared/catalog-engine/xml/index.js';
import { parseSc2Strings } from '../../../strings/shared/core/text-file.js';
import { parseComponentList, parseSc2ComponentList } from '../../codecs/document-metadata/core/component-list.js';
import { TypedCatalog } from '../../../data/shared/catalog-engine/sc2-catalog/index.js';
import { catalogStructureDefaultEntries, STARCRAFT2_STRUCTURE_DEFAULT_RULES, } from '../../../data/shared/format/structure-defaults.js';
import { createBuiltinRegistry } from '../../../data/shared/catalog-engine/sc2-schema/index.js';
import { parseLayout } from '../../../layout/shared/layout-engine/sc2-layout-core/simple-parse/index.js';
import { parseBankList } from '../../../banks/shared/core/bank-list.js';
import { parseEditorCategories, parseEditorCategoryStrings, mergeEditorCategories, EMPTY_EDITOR_CATEGORIES, } from '../../../data/shared/catalog-engine/sc2-editor-core/index.js';
import { parseDocumentHeader, parseVersionFile } from '../../codecs/document-metadata/core/index.js';
import { SC2Mod } from './mod.js';
import { createTextStyleSheet, mergeTextStyleSheets, mergeTextStyleSheetsInto, parseFontStyles, } from '../../../style/shared/font-styles.js';
import { MOD_DOCUMENT_ROUTES } from './document-routes.js';
import { orderGameDataFilePaths } from '../../../data/shared/catalog-engine/gamedata-order.js';
/**
 * Matches GameData XML files in both formats:
 *   GameData/unitdata.xml          — test mods / flat structure
 *   base.sc2data/GameData/unit.xml — real SC2 mods (case-insensitive)
 *   Base.SC2Data/GameData/Unit.xml — same, alternative casing
 */
const GAME_DATA_XML_RE = MOD_DOCUMENT_ROUTES.catalogXml.pathPattern;
/**
 * Matches locale string files:
 *   <locale>.sc2data/LocalizedData/<name>.txt
 * e.g. enus.sc2data/LocalizedData/GameStrings.txt
 */
const LOCALE_FILE_RE = MOD_DOCUMENT_ROUTES.localizedStrings.pathPattern;
/** Matches SC2 UI layout files (any depth): UI\Layout\...\Foo.SC2Layout */
const LAYOUT_FILE_RE = MOD_DOCUMENT_ROUTES.layout.pathPattern;
/** Matches map/mod BankList metadata. */
const BANK_LIST_FILE_RE = MOD_DOCUMENT_ROUTES.bankList.pathPattern;
/** Matches SC2 UI font-style files. */
const FONT_STYLES_FILE_RE = MOD_DOCUMENT_ROUTES.fontStyles.pathPattern;
/** Matches `EditorData/EditorCategories.xml` (editor-only category metadata). */
const EDITOR_CATEGORIES_FILE_RE = MOD_DOCUMENT_ROUTES.editorCategories.pathPattern;
/** Matches localized `Editor/EditorCategoryStrings.txt` (capture 1 = locale code). */
const EDITOR_CATEGORY_STRINGS_FILE_RE = MOD_DOCUMENT_ROUTES.editorCategoryStrings.pathPattern;
/** Matches non-localized `GameData/Assets.txt` / `AssetsProduct.txt` (capture 1 = stem). */
const ASSET_STRINGS_FILE_RE = MOD_DOCUMENT_ROUTES.assetStrings.pathPattern;
/** Locale-specific font style overlays live under `<locale>.SC2Data/...`. */
const LOCALE_FONT_STYLE_RE = /^([a-z]{4})\.sc2data\//i;
/** Parallel VFS reads per mod (each read pays per-file latency; parsing stays on-thread). */
const READ_CONCURRENCY = 8;
/** Bounded-concurrency map preserving input order in the result array. */
async function mapConcurrent(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        for (;;) {
            const i = next++;
            if (i >= items.length)
                return;
            out[i] = await fn(items[i]);
        }
    });
    await Promise.all(workers);
    return out;
}
export class SC2ModReader {
    options;
    constructor(options) {
        this.options = options;
    }
    async timed(stage, fn) {
        const onStage = this.options.onStage;
        if (!onStage)
            return fn();
        const t = Date.now();
        try {
            return await fn();
        }
        finally {
            onStage(stage, Date.now() - t);
        }
    }
    timedSync(stage, fn) {
        const onStage = this.options.onStage;
        if (!onStage)
            return fn();
        const t = Date.now();
        try {
            return fn();
        }
        finally {
            onStage(stage, Date.now() - t);
        }
    }
    stage(stage, ms = 0) {
        this.options.onStage?.(stage, ms);
    }
    async listModFiles(base, stagePrefix) {
        const cached = this.options.listFiles?.(base);
        if (cached) {
            this.stage(`${stagePrefix}:cachedList`);
            return [...cached];
        }
        const files = await this.timed(`${stagePrefix}:list`, () => this.options.vfs.list(base));
        this.options.onFileList?.(base, files);
        return files;
    }
    async read(modPath, opts) {
        const schema = this.options.schema ?? createBuiltinRegistry();
        const catalog = new TypedCatalog({ schema, structureDefaults: STARCRAFT2_STRUCTURE_DEFAULT_RULES });
        const locales = new Map();
        const fontStyles = createTextStyleSheet();
        const localizedFontStyleOverrides = new Map();
        const loadOrder = [];
        // Editor categories and the `@@` asset-alias table merge down the chain exactly like
        // catalog/locale/font data; `chainState` carries them across the per-mod loads.
        const chainState = {
            editorCategories: EMPTY_EDITOR_CATEGORIES,
            assetAliases: new Map(),
        };
        const deps = opts?.deps ??
            (await this.timed('resolveDeps', () => this.resolveDependencyChain(modPath, opts?.rootPath)));
        for (const dep of deps) {
            await this.loadMod(dep, catalog, locales, fontStyles, localizedFontStyleOverrides, loadOrder, chainState);
        }
        await this.loadMod(modPath, catalog, locales, fontStyles, localizedFontStyleOverrides, loadOrder, chainState);
        const opaqueFiles = await this.collectOpaqueFiles(modPath);
        const post = this.timedSync('layouts+bank+header+version', () => ({
            layouts: parseLayouts(opaqueFiles),
            bankList: parseBankListFromOpaqueFiles(opaqueFiles),
            documentHeader: parseDocumentHeaderFromOpaqueFiles(opaqueFiles),
            versionFiles: parseVersionFilesFromOpaqueFiles(opaqueFiles),
            localizedFontStyles: buildLocalizedFontStyles(fontStyles, localizedFontStyleOverrides),
        }));
        const { layouts, bankList, documentHeader, versionFiles, localizedFontStyles } = post;
        return new SC2Mod(catalog, loadOrder, locales, opaqueFiles, layouts, bankList, documentHeader, versionFiles, fontStyles, localizedFontStyles, chainState.editorCategories, chainState.assetAliases);
    }
    async resolveDependencyChain(modPath, rootPath) {
        const root = rootPath ?? inferSc2Root(modPath);
        const target = stripTrailingSlash(modPath);
        const out = [];
        const visiting = new Set();
        const seen = new Set();
        const visit = async (depPath) => {
            const base = stripTrailingSlash(depPath);
            const key = base.toLowerCase();
            if (seen.has(key) || visiting.has(key))
                return;
            visiting.add(key);
            for (const child of await this.readDependencies(base, root)) {
                await visit(child);
            }
            visiting.delete(key);
            seen.add(key);
            if (base.toLowerCase() !== target.toLowerCase())
                out.push(base);
        };
        for (const dep of await this.readDependencies(target, root)) {
            await visit(dep);
        }
        const core = await this.findCoreMod(root);
        if (core !== undefined && !out.some(p => p.toLowerCase() === core.toLowerCase())) {
            out.unshift(core);
        }
        return out;
    }
    async readDependencies(modPath, rootPath) {
        const base = stripTrailingSlash(modPath);
        // Real SC2 mods declare dependencies in DocumentInfo (XML)
        const docInfoDeps = await this.readDocumentInfoDeps(base, rootPath);
        if (docInfoDeps.length > 0)
            return docInfoDeps;
        // Fall back: plain-text ComponentList.SC2Components (custom / test mods)
        const listPath = `${base}/${MOD_DOCUMENT_ROUTES.componentList.canonicalPath}`;
        if (!(await this.options.vfs.exists(listPath)))
            return [];
        const text = await this.options.vfs.getText(listPath);
        // Real SC2 ComponentList XML declares data components, not dependencies (those
        // live in DocumentInfo); only the legacy flat-text convention lists dep paths.
        if (parseComponentList(text).isXml)
            return [];
        const lines = parseSc2ComponentList(text);
        return Promise.all(lines.map(line => this.resolveDepPath(line, base, rootPath)));
    }
    /**
     * Parse DocumentInfo XML for `file:` dependency references.
     * Format: <Value>file:Mods\foo.SC2Mod</Value>
     *      or <Value>bnet:Name/ver/id,file:Mods\foo.SC2Mod</Value>
     */
    async readDocumentInfoDeps(modBase, rootPath) {
        const docPath = `${modBase}/${MOD_DOCUMENT_ROUTES.documentInfo.canonicalPath}`;
        try {
            const text = await this.options.vfs.getText(docPath);
            const fileRefs = extractDocInfoFileDeps(text);
            if (fileRefs.length === 0)
                return [];
            return Promise.all(fileRefs.map(ref => this.resolveDepPath(ref, modBase, rootPath)));
        }
        catch {
            return [];
        }
    }
    async resolveDepPath(line, modBase, rootPath) {
        const direct = resolveDepPath(line, modBase, rootPath);
        if (await this.options.vfs.exists(direct).catch(() => false))
            return direct;
        const root = rootPath ?? inferSc2Root(modBase);
        if (root === undefined)
            return direct;
        const normalized = stripProtocol(line).replace(/\\/g, '/');
        const fileName = normalized.slice(normalized.lastIndexOf('/') + 1);
        const candidates = [
            `${stripTrailingSlash(root)}/${normalized}`,
            `${stripTrailingSlash(root)}/Mods/${fileName}`,
            `${stripTrailingSlash(root)}/mods/${fileName}`,
            `${stripTrailingSlash(root)}/Mods/${fileName.toLowerCase()}`,
            `${stripTrailingSlash(root)}/mods/${fileName.toLowerCase()}`,
        ];
        for (const candidate of candidates) {
            if (await this.options.vfs.exists(candidate).catch(() => false))
                return candidate;
        }
        return direct;
    }
    async findCoreMod(rootPath) {
        if (rootPath === undefined)
            return undefined;
        const root = stripTrailingSlash(rootPath);
        const candidates = [
            `${root}/Mods/Core.SC2Mod`,
            `${root}/Mods/core.sc2mod`,
            `${root}/mods/Core.SC2Mod`,
            `${root}/mods/core.sc2mod`,
        ];
        for (const candidate of candidates) {
            if (await this.options.vfs.exists(candidate).catch(() => false))
                return candidate;
        }
        return undefined;
    }
    async loadMod(modPath, catalog, locales, fontStyles, localizedFontStyleOverrides, loadOrder, chainState) {
        const base = stripTrailingSlash(modPath);
        const name = baseName(base);
        if (loadOrder.includes(base))
            return;
        // Skip mods that don't exist (e.g. optional bnet dependencies)
        if (!(await this.timed(`mod ${name}:exists`, () => this.options.vfs.exists(base).catch(() => false))))
            return;
        loadOrder.push(base);
        // Reading + parsing a mod's own files (GameData XML, locale strings, font styles)
        // dominates load time for the base game (tens of thousands of entities) — cache each
        // mod's own contribution by VFS path so an unchanged dependency (the base game, other
        // mods) is read once per session instead of redone on every reload of a mod that
        // depends on it.
        const cache = this.options.modParseCache;
        const cacheKey = base.toLowerCase();
        let parsed = cache?.get(cacheKey);
        if (!parsed) {
            parsed = await this.parseModFiles(base, name);
            cache?.set(cacheKey, parsed);
        }
        else {
            this.stage(`parse ${name}:cacheHit`);
        }
        if (parsed.catalogFiles.length > 0) {
            this.timedSync(`merge ${name}:catalog(${parsed.catalogFiles.length})`, () => {
                catalog.loadFromFiles(parsed.catalogFiles, { mod: base });
                for (const item of parsed.structureDefaults) {
                    catalog.addStructureDefault(item.namespace, item.structureType, item.fields);
                }
            });
        }
        // Merge this mod's own locale contributions ("later mods overwrite earlier ones").
        if (parsed.locales.size > 0) {
            this.timedSync(`merge ${name}:locales(${parsed.locales.size})`, () => {
                for (const [localeCode, canonicalMap] of parsed.locales) {
                    if (!locales.has(localeCode))
                        locales.set(localeCode, new Map());
                    const localeMap = locales.get(localeCode);
                    for (const [canonical, fileMap] of canonicalMap) {
                        if (!localeMap.has(canonical))
                            localeMap.set(canonical, new Map());
                        const target = localeMap.get(canonical);
                        for (const [k, v] of fileMap)
                            target.set(k, v);
                    }
                }
            });
        }
        const fontStyleGroups = (parsed.fontStyles ? 1 : 0) + parsed.localizedFontStyleOverrides.size;
        if (fontStyleGroups > 0) {
            this.timedSync(`merge ${name}:fontStyles(${fontStyleGroups})`, () => {
                // Merge this mod's own font-style contributions the same way the original inline
                // parse used to: non-localized into the shared default sheet, localized as overlays.
                if (parsed.fontStyles)
                    mergeTextStyleSheetsInto(fontStyles, parsed.fontStyles);
                for (const [locale, sheet] of parsed.localizedFontStyleOverrides) {
                    let target = localizedFontStyleOverrides.get(locale);
                    if (target === undefined) {
                        target = createTextStyleSheet();
                        localizedFontStyleOverrides.set(locale, target);
                    }
                    mergeTextStyleSheetsInto(target, sheet);
                }
            });
        }
        // Editor categories + asset aliases: same "later mods win" merge as everything above.
        // Both are cheap maps, so they merge unconditionally rather than behind a size check.
        if (parsed.editorCategories.categories.size > 0 ||
            parsed.editorCategories.objectUsage.size > 0) {
            chainState.editorCategories = mergeEditorCategories(chainState.editorCategories, parsed.editorCategories);
        }
        // (`parsed.editorCategoryStrings` — localized category display names — has no home on
        // SC2Mod yet; consumers that need it read it off ModParseResult.)
        // Assets.txt then AssetsProduct.txt — the product table is the later override, matching
        // how the game layers a product's asset overrides over the base table.
        for (const stem of ['Assets', 'AssetsProduct']) {
            for (const [alias, path] of parsed.assetStrings.get(stem) ?? []) {
                chainState.assetAliases.set(alias, path);
            }
        }
    }
    /**
     * Read + parse everything `base` contributes on its own — GameData XML, locale strings,
     * font styles — before any merging with other mods. Depends only on this mod's own files,
     * so it's safe to cache per mod path regardless of load order (see `modParseCache`).
     */
    async parseModFiles(base, modName = baseName(base)) {
        const allFiles = await this.listModFiles(base, `parse ${modName}`);
        // Load catalog XML in canonical SC2 order: standard <Type>Data.xml files (in
        // schema/editor order) + any other flat GameData/*.xml, then the GameData.xml
        // <Includes> <Catalog path> files (which pull in nested data like
        // GameData/Nod/Vehicles/NodHarvester.xml). Order matters: later files override
        // earlier ones during merge.
        const xmlFiles = await this.timed(`parse ${modName}:catalogOrder`, () => this.orderedGameDataFiles(base, allFiles));
        const structureDefaults = [];
        const catalogFiles = await this.timed(`parse ${modName}:catalogXml(${xmlFiles.length})`, async () => {
            // Reads run with bounded concurrency (VFS reads pay per-file latency — IO for
            // folder mods, lookup+decode for CASC); parse results are assembled by index so
            // the canonical merge ORDER is preserved exactly.
            const slots = await mapConcurrent(xmlFiles, READ_CONCURRENCY, async (filePath) => {
                try {
                    const text = await this.options.vfs.getText(filePath);
                    // Track file/line per entry so entity declarations are navigable ("declared in
                    // liberty …/UnitData.xml:123, modified in swarm …"). `filePath` is `${base}/rel`.
                    const rel = filePath.startsWith(`${base}/`) ? filePath.slice(base.length + 1) : filePath;
                    const parsed = parseCatalogXml(text, { filePath: rel, trackSource: true });
                    return { parsed, defaults: catalogStructureDefaultEntries(text, rel, parsed.rootTypes) };
                }
                catch (cause) {
                    // A listed catalog is part of the mod, not optional metadata. Never persist a
                    // partial parse as a valid build cache after a transient read/decode failure.
                    throw new Error(`Unable to load SC2 catalog: ${filePath}`, { cause });
                }
            });
            const files = [];
            for (const slot of slots) {
                if (slot === undefined)
                    continue;
                files.push(slot.parsed);
                structureDefaults.push(...slot.defaults);
            }
            return files;
        });
        const localeWanted = this.options.localeFilter
            ? new Set(this.options.localeFilter.map(l => l.toLowerCase()))
            : undefined;
        const locales = new Map();
        const localeFiles = allFiles.filter(f => {
            const m = LOCALE_FILE_RE.exec(f);
            return m !== null && (localeWanted === undefined || localeWanted.has(m[1].toLowerCase()));
        });
        await this.timed(`parse ${modName}:locales(${localeFiles.length})`, async () => {
            // Parallel reads, ordered merge: entries land in file order so "later files
            // overwrite earlier ones" semantics are unchanged.
            const parsedLocales = await mapConcurrent(localeFiles, READ_CONCURRENCY, async (relPath) => {
                const m = LOCALE_FILE_RE.exec(relPath);
                if (m === null)
                    return undefined;
                try {
                    const text = await this.options.vfs.getText(`${base}/${relPath}`);
                    return {
                        localeCode: m[1].toLowerCase(), // e.g. 'enus'
                        canonical: canonicalLocaleName(m[2].replace(/\.txt$/i, '')), // e.g. 'GameStrings'
                        entries: parseSc2Strings(text),
                    };
                }
                catch (cause) {
                    throw new Error(`Unable to load SC2 locale: ${base}/${relPath}`, { cause });
                }
            });
            for (const parsed of parsedLocales) {
                if (!parsed)
                    continue;
                const { localeCode, canonical, entries } = parsed;
                if (!locales.has(localeCode))
                    locales.set(localeCode, new Map());
                const localeMap = locales.get(localeCode);
                if (!localeMap.has(canonical))
                    localeMap.set(canonical, new Map());
                const fileMap = localeMap.get(canonical);
                for (const [k, v] of entries)
                    fileMap.set(k, v);
            }
        });
        // Load UI font-style constants/styles. Non-localized files merge into a shared sheet;
        // localized files become per-locale overlays.
        let fontStyles;
        const localizedFontStyleOverrides = new Map();
        const fontStyleFiles = allFiles.filter(f => {
            if (!FONT_STYLES_FILE_RE.test(f))
                return false;
            if (localeWanted === undefined)
                return true;
            const locale = localeFromFontStylePath(f);
            return locale === undefined || localeWanted.has(locale); // non-localized always read
        });
        await this.timed(`parse ${modName}:fontStyles(${fontStyleFiles.length})`, async () => {
            for (const relPath of fontStyleFiles) {
                try {
                    const text = await this.options.vfs.getText(`${base}/${relPath}`);
                    const parsedSheet = parseFontStyles(text);
                    const locale = localeFromFontStylePath(relPath);
                    if (locale !== undefined) {
                        let sheet = localizedFontStyleOverrides.get(locale);
                        if (sheet === undefined) {
                            sheet = createTextStyleSheet();
                            localizedFontStyleOverrides.set(locale, sheet);
                        }
                        mergeTextStyleSheetsInto(sheet, parsedSheet);
                    }
                    else {
                        if (!fontStyles)
                            fontStyles = createTextStyleSheet();
                        mergeTextStyleSheetsInto(fontStyles, parsedSheet);
                    }
                }
                catch (cause) {
                    throw new Error(`Unable to load SC2 font styles: ${base}/${relPath}`, { cause });
                }
            }
        });
        // Editor categories (EditorData/EditorCategories.xml + localized display strings) and the
        // non-localized asset-alias tables (Assets.txt / AssetsProduct.txt). These merge down the
        // dependency chain like catalog/locale/font data, so folding each mod's own contribution
        // into the cached parse result lets later loads skip re-reading them from CASC.
        let editorCategories = EMPTY_EDITOR_CATEGORIES;
        const editorCategoryStrings = new Map();
        const assetStrings = new Map();
        // EditorCategoryStrings: read the requested locales PLUS enUS — the merge step falls back to
        // enUS, so a single-locale consumer still gets English display names for the categories.
        const editorLocaleWanted = localeWanted ? new Set([...localeWanted, 'enus']) : undefined;
        await this.timed(`parse ${modName}:editorAndAssets`, async () => {
            const editorCategoryFile = allFiles.find(f => EDITOR_CATEGORIES_FILE_RE.test(f));
            if (editorCategoryFile) {
                try {
                    editorCategories = parseEditorCategories(await this.options.vfs.getText(`${base}/${editorCategoryFile}`));
                }
                catch (cause) {
                    throw new Error(`Unable to load SC2 editor categories: ${base}/${editorCategoryFile}`, { cause });
                }
            }
            for (const relPath of allFiles) {
                const m = EDITOR_CATEGORY_STRINGS_FILE_RE.exec(relPath);
                if (m === null)
                    continue;
                const locale = m[1].toLowerCase();
                if (editorLocaleWanted !== undefined && !editorLocaleWanted.has(locale))
                    continue;
                try {
                    const parsed = parseEditorCategoryStrings(await this.options.vfs.getText(`${base}/${relPath}`));
                    let target = editorCategoryStrings.get(locale);
                    if (target === undefined) {
                        target = new Map();
                        editorCategoryStrings.set(locale, target);
                    }
                    for (const [k, v] of parsed)
                        target.set(k, v);
                }
                catch (cause) {
                    throw new Error(`Unable to load SC2 editor strings: ${base}/${relPath}`, { cause });
                }
            }
            for (const relPath of allFiles) {
                const m = ASSET_STRINGS_FILE_RE.exec(relPath);
                if (m === null)
                    continue;
                const stem = m[1].toLowerCase() === 'assetsproduct' ? 'AssetsProduct' : 'Assets';
                try {
                    const entries = parseSc2Strings(await this.options.vfs.getText(`${base}/${relPath}`));
                    let target = assetStrings.get(stem);
                    if (target === undefined) {
                        target = new Map();
                        assetStrings.set(stem, target);
                    }
                    for (const [k, v] of entries)
                        target.set(k, v);
                }
                catch (cause) {
                    throw new Error(`Unable to load SC2 asset aliases: ${base}/${relPath}`, { cause });
                }
            }
        });
        return {
            catalogFiles,
            structureDefaults,
            locales,
            fontStyles,
            localizedFontStyleOverrides,
            editorCategories,
            editorCategoryStrings,
            assetStrings,
        };
    }
    /**
     * Build the ordered list of catalog XML files for a mod, mirroring how the SC2
     * editor loads data: the standard `GameData/<Type>Data.xml` files first (in
     * DATA_CLASS_SCHEMA order), then any other flat `GameData/*.xml`, then the files
     * referenced by `GameData.xml` <Includes> <Catalog path> (nested data).
     * Falls back to the flat glob for mods with no standard files or GameData.xml.
     */
    async orderedGameDataFiles(base, allFiles) {
        const listed = new Set(allFiles.map(p => p.replace(/\\/g, '/').toLowerCase()));
        const ordered = await orderGameDataFilePaths(allFiles, async (relativePath) => this.options.vfs.getText(`${base}/${relativePath}`).catch(cause => {
            if (listed.has(relativePath.replace(/\\/g, '/').toLowerCase())) {
                throw new Error(`Unable to load SC2 catalog manifest: ${base}/${relativePath}`, { cause });
            }
            return undefined; // An absent optional manifest is not a partial parse.
        }));
        return ordered.map(relativePath => `${base}/${relativePath}`);
    }
    /**
     * Collect all files from a mod that are not catalog XML or locale strings.
     * These are stored verbatim for round-trip export.
     * Skips ComponentList.SC2Components (regenerated on export).
     */
    async collectOpaqueFiles(modPath) {
        const base = stripTrailingSlash(modPath);
        const name = baseName(base);
        const result = new Map();
        const allFiles = await this.listModFiles(base, `opaqueFiles ${name}`);
        const skip = new Set([MOD_DOCUMENT_ROUTES.componentList.canonicalPath]);
        const include = this.options.includeOpaqueFile;
        const candidateFiles = allFiles.filter(relPath => {
            if (skip.has(relPath))
                return false;
            if (GAME_DATA_XML_RE.test(relPath))
                return false;
            if (LOCALE_FILE_RE.test(relPath))
                return false;
            // A host-supplied predicate is an explicit allowlist, not merely an extra filter over the
            // generic opaque-document route. This lets focused consumers request known map documents
            // (`t3Terrain.xml`, `t3Water`, …) without broadening the global document classifier or
            // reading the rest of an archive's asset payload.
            if (include)
                return include(relPath);
            return MOD_DOCUMENT_ROUTES.opaqueFile.pathPattern.test(relPath);
        });
        await this.timed(`opaqueFiles ${name}:read(${candidateFiles.length})`, async () => {
            for (const relPath of candidateFiles) {
                try {
                    const bytes = await this.options.vfs.get(`${base}/${relPath}`);
                    result.set(relPath, bytes);
                }
                catch {
                    // skip unreadable files
                }
            }
        });
        return result;
    }
}
/**
 * Parse every `.SC2Layout` file present in the collected opaque files. The raw
 * bytes stay in `opaqueFiles` for verbatim round-trip; this gives callers a
 * structured view (frame tree, references) for indexing, relations and rename.
 * Unparseable files are skipped silently.
 */
function parseLayouts(opaqueFiles) {
    const layouts = new Map();
    const decoder = new TextDecoder('utf-8');
    for (const [relPath, bytes] of opaqueFiles) {
        if (!LAYOUT_FILE_RE.test(relPath))
            continue;
        try {
            layouts.set(relPath, parseLayout(decoder.decode(bytes)));
        }
        catch {
            // skip unparseable layout files
        }
    }
    return layouts;
}
function localeFromFontStylePath(relPath) {
    const match = LOCALE_FONT_STYLE_RE.exec(relPath);
    const locale = match?.[1]?.toLowerCase();
    return locale && locale !== 'base' ? locale : undefined;
}
function buildLocalizedFontStyles(base, overrides) {
    const out = new Map();
    for (const [locale, sheet] of overrides)
        out.set(locale, mergeTextStyleSheets(base, sheet));
    return out;
}
/**
 * Parse the primary map/mod `BankList.xml` when present. The raw bytes stay in
 * `opaqueFiles`; unparseable BankList files are skipped so loading a map/mod
 * does not fail just because optional bank preload metadata is malformed.
 */
function parseBankListFromOpaqueFiles(opaqueFiles) {
    const decoder = new TextDecoder('utf-8');
    for (const [relPath, bytes] of opaqueFiles) {
        if (!BANK_LIST_FILE_RE.test(relPath))
            continue;
        try {
            return parseBankList(decoder.decode(bytes));
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
/**
 * Parse the primary mod/map `DocumentHeader` binary when present. The raw bytes
 * stay in `opaqueFiles` for verbatim round-trip; this gives callers a structured
 * view (dependencies, DocInfo/MapInfo/LoadingScreen entries). A malformed or
 * absent header yields `undefined` so loading never fails on it.
 */
function parseDocumentHeaderFromOpaqueFiles(opaqueFiles) {
    for (const [relPath, bytes] of opaqueFiles) {
        if (!MOD_DOCUMENT_ROUTES.documentHeader.pathPattern.test(relPath))
            continue;
        try {
            return parseDocumentHeader(bytes);
        }
        catch {
            return undefined;
        }
    }
    return undefined;
}
/**
 * Parse every `<file>.version` sidecar present in the primary mod/map. The raw
 * sidecars remain in `opaqueFiles`; malformed sidecars are skipped so loading
 * remains lenient.
 */
function parseVersionFilesFromOpaqueFiles(opaqueFiles) {
    const out = new Map();
    for (const [relPath, bytes] of opaqueFiles) {
        if (!MOD_DOCUMENT_ROUTES.versionFile.pathPattern.test(relPath))
            continue;
        try {
            out.set(relPath.slice(0, -'.version'.length), parseVersionFile(bytes));
        }
        catch {
            // skip malformed sidecars
        }
    }
    return out;
}
/** Normalise a locale file stem to the canonical SC2 name (PascalCase). */
function canonicalLocaleName(stem) {
    const lower = stem.toLowerCase();
    // Known SC2 locale file names
    const known = {
        gamestrings: 'GameStrings',
        gamehotkeys: 'GameHotkeys',
        objectstrings: 'ObjectStrings',
        triggerstrings: 'TriggerStrings',
        conversationstrings: 'ConversationStrings',
        tipsstrings: 'TipsStrings',
    };
    return known[lower] ?? stem.charAt(0).toUpperCase() + stem.slice(1);
}
function stripTrailingSlash(p) {
    return p.endsWith('/') ? p.slice(0, -1) : p;
}
function baseName(p) {
    return stripTrailingSlash(p).split('/').pop() ?? p;
}
function stripProtocol(p) {
    const idx = p.indexOf(':');
    return idx === -1 ? p : p.slice(idx + 1);
}
function inferSc2Root(modPath) {
    const colonIdx = modPath.indexOf(':');
    const protocol = colonIdx !== -1 ? modPath.slice(0, colonIdx + 1) : '';
    const subPath = colonIdx !== -1 ? modPath.slice(colonIdx + 1) : modPath;
    const normalized = stripTrailingSlash(subPath.replace(/\\/g, '/'));
    const lower = normalized.toLowerCase();
    const marker = '/mods/';
    const idx = lower.lastIndexOf(marker);
    if (idx === -1)
        return undefined;
    return `${protocol}${normalized.slice(0, idx)}`;
}
/**
 * Extract `file:` relative paths from SC2 DocumentInfo XML.
 * Returns paths with backslashes replaced by forward slashes, without the "file:" prefix.
 */
function extractDocInfoFileDeps(xmlText) {
    const deps = [];
    for (const m of xmlText.matchAll(/<Value>([^<]+)<\/Value>/g)) {
        const val = m[1];
        if (val === undefined)
            continue;
        const trimmed = val.trim();
        // "file:Mods\foo.SC2Mod"  or  "bnet:Name/id,file:Mods\foo.SC2Mod"
        const fileIdx = trimmed.lastIndexOf('file:');
        if (fileIdx !== -1) {
            deps.push(trimmed.slice(fileIdx + 5).replace(/\\/g, '/'));
        }
    }
    return deps;
}
function resolveDepPath(line, modBase, rootPath) {
    if (line.includes(':'))
        return line;
    if (rootPath !== undefined) {
        return `${stripTrailingSlash(rootPath)}/${line}`;
    }
    const colonIdx = modBase.indexOf(':');
    const protocol = colonIdx !== -1 ? modBase.slice(0, colonIdx + 1) : '';
    const subPath = colonIdx !== -1 ? modBase.slice(colonIdx + 1) : modBase;
    const normalized = subPath.replace(/\\/g, '/');
    const parentDir = normalized.slice(0, normalized.lastIndexOf('/'));
    return `${protocol}${parentDir}/${line}`;
}
