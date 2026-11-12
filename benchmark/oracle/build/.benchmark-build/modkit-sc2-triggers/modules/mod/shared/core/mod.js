import { EMPTY_EDITOR_CATEGORIES } from '../../../data/shared/catalog-engine/sc2-editor-core/index.js';
import { createTextStyleSheet, resolveTextConstant, resolveTextStyle } from '../../../style/shared/font-styles.js';
/**
 * A loaded SC2 mod — merged catalog of all dependency + own entries.
 * Exposes typed namespace accessors for common SC2 catalogs.
 */
export class SC2Mod {
    catalog;
    loadOrder;
    locales;
    opaqueFiles;
    layouts;
    bankList;
    documentHeader;
    versionFiles;
    fontStyles;
    localizedFontStyles;
    editorCategories;
    assetAliases;
    constructor(catalog, loadOrder, locales = new Map(), 
    /** Verbatim files from the primary mod that are not catalog XML or locale strings */
    opaqueFiles = new Map(), 
    /**
     * Parsed `.SC2Layout` UI files from the primary mod, keyed by relative path
     * (e.g. `Base.SC2Data/UI/Layout/Custom/Foo.SC2Layout`). The raw bytes also
     * remain in {@link opaqueFiles} for verbatim round-trip export.
     */
    layouts = new Map(), 
    /**
     * Parsed `BankList.xml` metadata from the primary map/mod, when present.
     * The raw file also remains in {@link opaqueFiles} for verbatim round-trip
     * export. BankList declares which player bank files SC2 should preload.
     */
    bankList = undefined, 
    /**
     * Parsed `DocumentHeader` metadata from the primary mod/map (format markers,
     * build number, flags, dependency list, and the DocInfo/MapInfo/LoadingScreen
     * key-value entries), when present and parseable. The raw bytes also remain
     * in {@link opaqueFiles}; on export the structured value (if set) is written
     * back via `writeDocumentHeader`, so edits to it round-trip.
     */
    documentHeader = undefined, 
    /**
     * Parsed `<file>.version` sidecars from the primary mod/map, keyed by the
     * archive entry path without the `.version` suffix (e.g. `Triggers` or
     * `Base.SC2Data/UI/Layout/DescIndex`). Empty sidecars parse to `null`.
     */
    versionFiles = new Map(), 
    /**
     * Merged non-localized `FontStyles.SC2Style` data across the dependency
     * chain. Later mods override earlier constants/styles.
     */
    fontStyles = createTextStyleSheet(), 
    /**
     * Locale-specific font-style overlays. Each entry is already merged over
     * {@link fontStyles}; use {@link fontStylesForLocale} for lookup.
     */
    localizedFontStyles = new Map(), 
    /**
     * Merged `EditorData/EditorCategories.xml` metadata across the dependency
     * chain (editor-only object/field categorisation). Later mods extend/override
     * earlier ones, same as catalog. Defaults to {@link EMPTY_EDITOR_CATEGORIES}.
     */
    editorCategories = EMPTY_EDITOR_CATEGORIES, 
    /**
     * Merged `@@` asset-alias table (`GameData/Assets.txt` + `AssetsProduct.txt`)
     * across the dependency chain — alias name → path, later mods winning. Empty
     * when no mod in the chain declares aliases.
     */
    assetAliases = new Map()) {
        this.catalog = catalog;
        this.loadOrder = loadOrder;
        this.locales = locales;
        this.opaqueFiles = opaqueFiles;
        this.layouts = layouts;
        this.bankList = bankList;
        this.documentHeader = documentHeader;
        this.versionFiles = versionFiles;
        this.fontStyles = fontStyles;
        this.localizedFontStyles = localizedFontStyles;
        this.editorCategories = editorCategories;
        this.assetAliases = assetAliases;
    }
    get schema() {
        return this.catalog.schema;
    }
    get units() {
        return this.catalog.namespace('Unit');
    }
    get weapons() {
        return this.catalog.namespace('Weapon');
    }
    get abils() {
        return this.catalog.namespace('Abil');
    }
    get effects() {
        return this.catalog.namespace('Effect');
    }
    get behaviors() {
        return this.catalog.namespace('Behavior');
    }
    get actors() {
        return this.catalog.namespace('Actor');
    }
    get buttons() {
        return this.catalog.namespace('Button');
    }
    get upgrades() {
        return this.catalog.namespace('Upgrade');
    }
    namespace(ns) {
        return this.catalog.namespace(ns);
    }
    getResolved(namespace, id) {
        return this.catalog.getResolved(namespace, id);
    }
    get(namespace, id) {
        return this.catalog.get(namespace, id);
    }
    all(namespace) {
        return this.catalog.all(namespace);
    }
    namespaces() {
        return this.catalog.namespaces();
    }
    fontStylesForLocale(locale) {
        if (!locale)
            return this.fontStyles;
        return this.localizedFontStyles.get(locale.toLowerCase()) ?? this.fontStyles;
    }
    getTextConstant(name, locale) {
        return resolveTextConstant(this.fontStylesForLocale(locale), name);
    }
    getTextStyle(name, locale) {
        return resolveTextStyle(this.fontStylesForLocale(locale), name);
    }
    /** Whether `id` is a `<const>` alias declared for field `path` anywhere in the load order. */
    hasConstAlias(path, id) {
        return this.catalog.hasConstAlias(path, id);
    }
    /** Re-key an entity in the catalog store (used by ops/rename). */
    renameEntry(namespace, oldId, newId) {
        this.catalog.renameEntry(namespace, oldId, newId);
    }
}
