/**
 * Packages whose dependency edges are injected by the StarCraft II engine.
 *
 * Blizzard's installed Core/Liberty/Swarm/Void and campaign roots contain no root
 * `DocumentInfo`, so these edges cannot be discovered from the packages themselves. Paths are
 * installation-relative because mods and campaigns may share the same basename.
 */
const BUILTIN_PACKAGES = Object.freeze([
    ['Mods/Core.SC2Mod', []],
    ['Mods/Liberty.SC2Mod', ['Mods/Core.SC2Mod']],
    ['Mods/Swarm.SC2Mod', ['Mods/Liberty.SC2Mod']],
    ['Mods/Void.SC2Mod', ['Mods/Swarm.SC2Mod']],
    ['Campaigns/Liberty.SC2Campaign', ['Mods/Liberty.SC2Mod']],
    [
        'Campaigns/Swarm.SC2Campaign',
        ['Campaigns/Liberty.SC2Campaign', 'Mods/Swarm.SC2Mod'],
    ],
    [
        'Campaigns/Void.SC2Campaign',
        ['Campaigns/Swarm.SC2Campaign', 'Mods/Void.SC2Mod'],
    ],
    ['Campaigns/LibertyStory.SC2Campaign', ['Campaigns/Liberty.SC2Campaign']],
    ['Campaigns/SwarmStory.SC2Campaign', ['Campaigns/Swarm.SC2Campaign']],
    ['Campaigns/VoidStory.SC2Campaign', ['Campaigns/Void.SC2Campaign']],
    ['Mods/LibertyMulti.SC2Mod', ['Mods/Liberty.SC2Mod']],
    ['Mods/SwarmMulti.SC2Mod', ['Mods/Swarm.SC2Mod']],
    ['Mods/VoidMulti.SC2Mod', ['Mods/Void.SC2Mod']],
    ['Mods/BalanceMulti.SC2Mod', ['Mods/VoidMulti.SC2Mod']],
].map(([path, dependencies]) => Object.freeze([path, Object.freeze(dependencies)])));
export const SC2_BUILTIN_PACKAGE_DEPENDENCIES = Object.freeze(Object.fromEntries(BUILTIN_PACKAGES.map(([path, dependencies]) => [path.toLowerCase(), dependencies])));
const PACKAGE_SUFFIX = /\.sc2(?:mod|campaign)$/iu;
function decoded(value) {
    try {
        return decodeURIComponent(value);
    }
    catch {
        return value;
    }
}
/** Convert a URI, DocumentInfo value, basename, or installation path to one package path. */
export function normalizeSc2PackagePath(value) {
    let normalized = decoded(value).replaceAll('\\', '/');
    const fileAt = normalized.toLowerCase().lastIndexOf('file:');
    if (fileAt >= 0)
        normalized = normalized.slice(fileAt + 5);
    normalized = normalized.split(/[?#]/u, 1)[0].replace(/^\/+|\/+$/gu, '');
    const parts = normalized.split('/').filter(Boolean);
    const packageIndex = parts.findIndex(part => PACKAGE_SUFFIX.test(part));
    if (packageIndex < 0)
        return undefined;
    // An installation-relative path (a DocumentInfo `file:Mods/...`) is kept whole: a mod may keep
    // its own packages in a nested `mods` folder, `Mods/tiberium-crossover/mods/tib-data.SC2Mod`.
    const first = parts[0].toLowerCase();
    if (packageIndex > 0 && (first === 'mods' || first === 'campaigns'))
        return parts.slice(0, packageIndex + 1).join('/');
    let rootIndex = packageIndex;
    for (let index = packageIndex - 1; index >= 0; index -= 1) {
        const folded = parts[index].toLowerCase();
        if (folded === 'mods' || folded === 'campaigns') {
            rootIndex = index;
            break;
        }
    }
    if (rootIndex === packageIndex) {
        return `${parts[packageIndex].toLowerCase().endsWith('.sc2campaign') ? 'Campaigns' : 'Mods'}/${parts[packageIndex]}`;
    }
    return parts.slice(rootIndex, packageIndex + 1).join('/');
}
const CANONICAL_PATHS = new Map();
for (const [path, dependencies] of BUILTIN_PACKAGES) {
    CANONICAL_PATHS.set(path.toLowerCase(), path);
    for (const dependency of dependencies)
        CANONICAL_PATHS.set(dependency.toLowerCase(), dependency);
}
export function canonicalSc2PackagePath(value) {
    const normalized = normalizeSc2PackagePath(value);
    return normalized === undefined
        ? undefined
        : (CANONICAL_PATHS.get(normalized.toLowerCase()) ?? normalized);
}
export function sc2BuiltinDirectDependencies(value) {
    const path = canonicalSc2PackagePath(value);
    return path === undefined
        ? Object.freeze([])
        : (SC2_BUILTIN_PACKAGE_DEPENDENCIES[path.toLowerCase()] ?? Object.freeze([]));
}
/** Dependency-first transitive engine closure, excluding the requested package itself. */
export function sc2BuiltinDependencyClosure(value) {
    const result = [];
    const visited = new Set();
    const visit = path => {
        for (const dependency of sc2BuiltinDirectDependencies(path)) {
            const key = dependency.toLowerCase();
            if (visited.has(key))
                continue;
            visited.add(key);
            visit(dependency);
            result.push(dependency);
        }
    };
    visit(value);
    return Object.freeze(result);
}
function escapeXml(value) {
    return value
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&apos;');
}
/**
 * The installed Blizzard packages omit their authored DocumentInfo from CASC. Expose the engine
 * edges as that ordinary package document so every downstream codec follows the same path used by
 * maps and user mods instead of carrying another dependency exception.
 */
export function sc2BuiltinDocumentInfo(value) {
    const path = canonicalSc2PackagePath(value);
    if (path === undefined ||
        SC2_BUILTIN_PACKAGE_DEPENDENCIES[path.toLowerCase()] === undefined)
        return undefined;
    const dependencies = sc2BuiltinDirectDependencies(path);
    const values = dependencies
        .map(dependency => `    <Value>file:${escapeXml(dependency)}</Value>`)
        .join('\n');
    return ('<?xml version="1.0" encoding="utf-8"?>\n' +
        '<DocInfo>\n' +
        '  <Dependencies>\n' +
        (values === '' ? '' : `${values}\n`) +
        '  </Dependencies>\n' +
        '</DocInfo>\n');
}
/** Build the standard host request for one installed SC2 package. */
export function sc2InstallationDependencies(activePackage, declared) {
    const active = canonicalSc2PackagePath(activePackage);
    const requested = [];
    const add = (path, required, basis) => {
        const canonical = canonicalSc2PackagePath(path);
        if (canonical !== undefined)
            requested.push({ path: canonical, required, basis });
    };
    // Core is the one package the engine loads beneath every map and mod; Liberty and the rest
    // arrive only through a declaration (or a builtin's own engine edges).
    if (active?.toLowerCase() !== 'mods/core.sc2mod')
        add('Mods/Core.SC2Mod', false, 'engine-implicit');
    if (active !== undefined) {
        for (const dependency of sc2BuiltinDependencyClosure(active)) {
            add(dependency, false, 'engine-implicit');
        }
    }
    for (const reference of declared) {
        const dependency = canonicalSc2PackagePath(reference);
        if (dependency === undefined)
            continue;
        for (const parent of sc2BuiltinDependencyClosure(dependency)) {
            add(parent, false, 'engine-implicit');
        }
        add(dependency, true, 'declared');
    }
    const merged = new Map();
    for (const dependency of requested) {
        const key = dependency.path.toLowerCase();
        const previous = merged.get(key);
        if (previous === undefined || dependency.required)
            merged.set(key, dependency);
    }
    return Object.freeze({
        schemaVersion: 1,
        gameId: 'blizzard/starcraft-2',
        complete: true,
        dependencies: Object.freeze([...merged.values()].map((dependency, order) => Object.freeze({
            id: `installation:${dependency.path.toLowerCase()}`,
            kind: 'installation-mod',
            required: dependency.required,
            order,
            state: 'unresolved',
            path: dependency.path,
            basis: dependency.basis,
        }))),
    });
}
//# sourceMappingURL=implicit-dependencies.js.map