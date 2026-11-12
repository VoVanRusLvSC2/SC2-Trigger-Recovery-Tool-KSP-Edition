/**
 * The card of an SC2 document-metadata file, as typed facts.
 *
 * The descriptor metadata stays the codec's summary; this is what a reader sees. Three things the
 * generic projection cannot know are said here: which header number is not what its name suggests
 * (the notes), which string belongs to which locale (the header stores the locale as a reversed
 * FourCC in the entry type), and that a dependency is another package rather than a string.
 */
import { createSubjectFactsSource, provenanceOf } from '@modkit/codec-kit';
import { KNOWN_FLAGS } from './core/types.js';
function fact(input, id, label, value, extra = {}) {
    // `note` and `locale` are SubjectFact fields newer than some vendored SDK typings.
    return Object.freeze({
        id,
        label,
        value,
        provenance: provenanceOf(input.source, extra.path ?? [id]),
        ...(extra.note === undefined ? {} : { note: extra.note }),
        ...(extra.locale === undefined ? {} : { locale: extra.locale }),
    });
}
/** `bnet:Name/1.2/12345,file:Mods/Name.SC2Mod` → its parts; unknown spellings keep the raw value. */
export function parseDependency(value) {
    const parts = value.split(',').map(part => part.trim());
    const bnet = parts.find(part => part.toLowerCase().startsWith('bnet:'))?.slice(5);
    const file = parts.find(part => part.toLowerCase().startsWith('file:'))?.slice(5).replaceAll('\\', '/');
    const match = bnet === undefined ? undefined : /^(.*)\/([^/]*)\/([^/]*)$/u.exec(bnet);
    const name = match?.[1] ?? bnet ?? file?.split('/').at(-1) ?? value;
    return {
        name,
        ...(match?.[3] === undefined || match[3] === '' ? {} : { bnetId: match[3] }),
        ...(match?.[2] === undefined || match[2] === '' ? {} : { version: match[2] }),
        ...(file === undefined ? {} : { file }),
    };
}
function dependencyFacts(input, dependencies) {
    const facts = [];
    const relations = [];
    dependencies.forEach((value, index) => {
        const parsed = parseDependency(value);
        facts.push(fact(input, `dependency-${index}`, parsed.name, {
            ...(parsed.bnetId === undefined ? {} : { 'Battle.net id': parsed.bnetId }),
            ...(parsed.version === undefined ? {} : { version: parsed.version }),
            ...(parsed.file === undefined ? {} : { file: parsed.file }),
        }, { path: ['dependencies', String(index)] }));
        relations.push(Object.freeze({
            role: 'dependency',
            // The same address the package namespace publishes, so both cards name one dependency.
            subjectId: `sc2-dependency:${encodeURIComponent(value.toLowerCase())}`,
            label: [parsed.name, parsed.bnetId, parsed.file].filter(Boolean).join(' · '),
            kind: 'sc2-mod-dependency',
            provenance: provenanceOf(input.source, ['dependencies', String(index)]),
        }));
    });
    return { group: { id: 'dependencies', label: 'Dependencies', facts }, relations };
}
/** The locale an entry is written in: the entry type is the locale FourCC stored reversed. */
export function entryLocale(type) {
    return /^[A-Za-z]{4}$/u.test(type) ? [...type].reverse().join('') : undefined;
}
const hex = (value, digits = 8) => `0x${(value >>> 0).toString(16).toUpperCase().padStart(digits, '0')}`;
/** Flag values seen in shipped and community documents, named after what they go with. */
const FLAG_PROFILES = new Map([
    [KNOWN_FLAGS.STANDARD, 'Standard/full profile'],
    [KNOWN_FLAGS.ALT_STANDARD, 'Alternate standard profile'],
    [KNOWN_FLAGS.EXTENDED, 'Extended/custom profile'],
    [KNOWN_FLAGS.EXTENDED_B, 'Extended rich-metadata profile'],
    [KNOWN_FLAGS.HAS_WEBSITE, 'Website metadata profile'],
    [KNOWN_FLAGS.EXTENDED_MINIMAL, 'Extended minimal profile'],
    [KNOWN_FLAGS.MAP_MINIMAL, 'Map-only minimal profile'],
    [KNOWN_FLAGS.RARE_B, 'Rare rich-metadata variant'],
]);
/** Header entries are grouped by the section their key starts with, as the editor writes them. */
const ENTRY_SECTIONS = Object.freeze({
    DocInfo: { id: 'document-info', label: 'Document info' },
    MapInfo: { id: 'map-info', label: 'Map info' },
    LoadingScreen: { id: 'loading-screen', label: 'Loading screen' },
});
export function documentHeaderFacts(input, data) {
    const note = (key) => input.notes[key];
    const header = (id, label, value, dynamicNote) => {
        const text = dynamicNote ?? note(id);
        return fact(input, id, label, value, { ...(text === undefined ? {} : { note: text }) });
    };
    const dependencies = dependencyFacts(input, data.dependencies);
    const sections = new Map();
    data.entries.forEach((entry, index) => {
        const locale = entryLocale(entry.type);
        const section = ENTRY_SECTIONS[entry.key.split('/', 1)[0]] ?? { id: 'strings', label: 'Localized strings' };
        let group = sections.get(section.id);
        if (group === undefined)
            sections.set(section.id, (group = { ...section, facts: [] }));
        group.facts.push(fact(input, entry.key, entry.key, entry.value, {
            ...(locale === undefined ? {} : { locale }),
            path: ['entries', String(index)],
        }));
    });
    const typeCounts = new Map();
    for (const entry of data.entries)
        typeCounts.set(entry.type, (typeCounts.get(entry.type) ?? 0) + 1);
    const entryTypes = [...typeCounts]
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([type, count]) => {
        const locale = entryLocale(type);
        return fact(input, `entry-type-${type}`, type, count, { ...(locale === undefined ? {} : { locale }), path: ['entries'] });
    });
    return createSubjectFactsSource({
        snapshotId: input.snapshotId,
        subjectId: input.source.id,
        label: input.label,
        kind: 'sc2-document-header',
        type: 'StarCraft II DocumentHeader',
        source: input.source,
        groups: [
            {
                id: 'document-header',
                label: 'Header',
                facts: [
                    header('magic', 'Magic', data.magic, 'DocumentHeader signature ("SC2H" reversed)'),
                    header('artifactType', 'Package type', data.unknown3 === 0 ? 'map' : data.unknown3 === 2 ? 'mod or campaign' : 'unknown'),
                    header('artifactTypeValue', 'Package type value', data.unknown3),
                    header('timestamp1', 'Game build', data.timestamp1),
                    header('timestamp2', 'Game build (second copy)', data.timestamp2),
                    header('markerVersion', 'Format marker', data.unknown1),
                    header('gameSignature', 'Game signature', `${hex(data.unknown2)} (${data.unknown2 === 0x5332 ? 'S2' : 'unknown'})`),
                    header('flags', 'Flags', hex(data.flags, 4), FLAG_PROFILES.get(data.flags) ?? 'Unknown flag profile'),
                    header('headerSize', 'Header size field', data.headerSize),
                    header('hash1', 'Checksum', hex(data.hash1)),
                    header('hash2', 'Checksum (second copy)', hex(data.hash2)),
                    header('reserved', 'Reserved bytes', [...data.reserved].map(byte => byte.toString(16).padStart(2, '0')).join(' '), 'Kept verbatim; maps sometimes carry a small value here'),
                    header('entryCount', 'Localized entries', data.entries.length),
                ],
            },
            dependencies.group,
            ...sections.values(),
            // The entry type is the locale FourCC reversed, so this is also a per-locale string count.
            ...(entryTypes.length === 0 ? [] : [{ id: 'entry-types', label: 'Entry types', facts: entryTypes }]),
        ],
        relations: dependencies.relations,
    });
}
export function versionFacts(input, data, componentType) {
    const note = (key) => input.notes[key];
    const row = (id, label, value) => fact(input, id, label, value, { ...(note(id) === undefined ? {} : { note: note(id) }) });
    return createSubjectFactsSource({
        snapshotId: input.snapshotId,
        subjectId: input.source.id,
        label: input.label,
        kind: 'sc2-version-file',
        type: 'StarCraft II component version',
        source: input.source,
        groups: [
            {
                id: 'version-file',
                label: 'Version',
                facts: data === null
                    ? [row('empty', 'Recorded version', 'none (empty sidecar)')]
                    : [
                        row('componentType', 'Component', componentType ?? 'unknown'),
                        row('typeTag', 'Type tag', data.typeTag),
                        row('version', 'Game version', `${data.majorVersion}.${data.minorVersion}${data.formatVersion === 0 ? '' : `.${data.patchVersion}`}`),
                        row('buildNumber', 'Game build', data.buildNumber),
                        // Layout 0 stores neither the entry count nor the second build; showing 0 would read as data.
                        ...(data.formatVersion === 2
                            ? [
                                fact(input, 'buildNumber2', 'Game build (second copy)', data.buildNumber2, {
                                    note: data.buildNumber2 === data.buildNumber ? 'Matches the game build' : 'Differs from the game build',
                                }),
                            ]
                            : []),
                        ...(data.formatVersion === 0 ? [] : [row('entryCount', 'Entries', data.entryCount)]),
                        row('timestamp', 'Written', new Date(data.timestamp * 1000).toISOString()),
                        fact(input, 'formatVersion', 'Layout version', data.formatVersion, {
                            note: `${data.bytesConsumed}-byte record`,
                        }),
                        row('terminal', 'Terminal field', data.terminal),
                        row('bytesConsumed', 'Bytes consumed', data.bytesConsumed),
                    ],
            },
        ],
    });
}
function nodeFacts(input, node, path, out) {
    if (node.name === 'Dependencies')
        return;
    const values = [...node.values, ...node.children.filter(child => child.name === 'Value').flatMap(child => child.values)];
    if (values.length > 0) {
        const key = path.join('/');
        out.push(fact(input, key, key, values.length === 1 ? values[0] : values, { path }));
    }
    for (const child of node.children) {
        if (child.name !== 'Value')
            nodeFacts(input, child, [...path, child.name], out);
    }
}
export function documentInfoFacts(input, data, dependencies) {
    const facts = [];
    for (const child of data.root.children)
        nodeFacts(input, child, [child.name], facts);
    const dependencyGroup = dependencyFacts(input, dependencies);
    return createSubjectFactsSource({
        snapshotId: input.snapshotId,
        subjectId: input.source.id,
        label: input.label,
        kind: 'sc2-document-info',
        type: 'StarCraft II DocumentInfo',
        source: input.source,
        groups: [
            { id: 'document-info', label: 'Document info', facts },
            dependencyGroup.group,
        ],
        relations: dependencyGroup.relations,
    });
}
const COMPONENT_TYPES = Object.freeze({
    gada: 'Game data',
    text: 'Localized text',
    info: 'Document info',
    mapi: 'Map info',
    trig: 'Triggers',
    plob: 'Objects',
    regi: 'Regions',
    terr: 'Terrain',
    attr: 'Attributes',
    uiui: 'UI layouts',
    font: 'Font styles',
    cuts: 'Cutscenes',
    aiai: 'Custom AI',
});
export function componentListFacts(input, components) {
    const facts = components.map((component, index) => fact(input, `component-${index}`, `${COMPONENT_TYPES[component.type] ?? component.type}${component.locale === undefined ? '' : ` (${component.locale})`}`, component.path, { path: ['components', String(index)], note: `Component type ${component.type}` }));
    const locales = [...new Set(components.flatMap(component => (component.locale === undefined ? [] : [component.locale])))];
    return createSubjectFactsSource({
        snapshotId: input.snapshotId,
        subjectId: input.source.id,
        label: input.label,
        kind: 'sc2-component-list',
        type: 'StarCraft II component list',
        source: input.source,
        groups: [
            {
                id: 'overview',
                label: 'Overview',
                facts: [
                    fact(input, 'componentCount', 'Components', components.length),
                    ...(locales.length === 0 ? [] : [fact(input, 'locales', 'Text locales', locales)]),
                ],
            },
            { id: 'components', label: 'Components', facts },
        ],
    });
}
//# sourceMappingURL=facts.js.map