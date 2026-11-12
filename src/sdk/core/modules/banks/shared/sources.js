/**
 * The bank's own sources, on top of the kit's shared builders.
 *
 * `createSubjectFactsSource`, `createRelationGraphSource` and the paging and provenance helpers
 * under them used to live here, which is why no other SC2 codec published a card: reusing them
 * meant copying them. They are `@modkit/codec-kit` now, unchanged, and this file keeps only what is
 * actually about banks.
 */
import { createRelationGraphSource, createSubjectFactsSource, fact as kitFact, provenanceOf, } from '@modkit/codec-kit';
/*
 * Re-exported under the names the bank's neighbours already import. Where the builders live is what
 * changed; which module the bank's own files reach for is not what this change is about.
 */
export { createRelationGraphSource, createSubjectFactsSource };
const provenance = provenanceOf;
const fact = (source, id, label, value, semanticPath) => kitFact(source, id, label, value, semanticPath);
export { fact, provenance };
export function bankSectionId(bankId, index) {
    return `${bankId}:section:${index}`;
}
export function bankKeyId(bankId, sectionIndex, keyIndex) {
    return `${bankSectionId(bankId, sectionIndex)}:key:${keyIndex}`;
}
export function createBankSources(bank, options) {
    const keys = bank.sections.flatMap(section => section.keys);
    const valueTypes = [
        ...new Set(keys.flatMap(key => (key.value === undefined ? [] : [key.value.type]))),
    ].sort();
    const relations = bank.sections.map((section, sectionIndex) => Object.freeze({
        role: 'contains-section',
        subjectId: bankSectionId(options.subjectId, sectionIndex),
        label: section.name,
        kind: 'sc2-bank-section',
        provenance: provenance(options.source, ['sections', String(sectionIndex)]),
    }));
    const factsSource = createSubjectFactsSource({
        snapshotId: options.snapshotId,
        subjectId: options.subjectId,
        label: options.label,
        kind: 'sc2-bank',
        type: 'StarCraft II bank',
        source: options.source,
        groups: [
            {
                id: 'identity',
                label: 'Bank',
                facts: [
                    fact(options.source, 'version', 'Version', bank.version, ['version']),
                    fact(options.source, 'signature-present', 'Signature present', bank.signature !== '', [
                        'signature',
                    ]),
                ],
            },
            {
                id: 'structure',
                label: 'Structure',
                facts: [
                    fact(options.source, 'sections', 'Sections', bank.sections.length, ['sections']),
                    fact(options.source, 'keys', 'Keys', keys.length, ['sections']),
                    fact(options.source, 'value-types', 'Value types', valueTypes, ['sections']),
                ],
            },
            {
                id: 'values',
                label: 'Values',
                facts: bank.sections.flatMap((section, sectionIndex) => section.keys.map((key, keyIndex) => fact(options.source, `value-${sectionIndex}-${keyIndex}`, `${section.name} / ${key.name}`, key.value ?? null, ['sections', String(sectionIndex), 'keys', String(keyIndex)]))),
            },
        ],
        relations,
    });
    const nodes = [Object.freeze({ id: options.subjectId, label: options.label, type: 'sc2-bank' })];
    const edges = [];
    for (const [sectionIndex, section] of bank.sections.entries()) {
        const sectionId = bankSectionId(options.subjectId, sectionIndex);
        nodes.push(Object.freeze({ id: sectionId, label: section.name, type: 'sc2-bank-section' }));
        edges.push(Object.freeze({ from: options.subjectId, to: sectionId, role: 'contains-section' }));
        for (const [keyIndex, key] of section.keys.entries()) {
            const keyId = bankKeyId(options.subjectId, sectionIndex, keyIndex);
            nodes.push(Object.freeze({ id: keyId, label: key.name, type: 'sc2-bank-key' }));
            edges.push(Object.freeze({ from: sectionId, to: keyId, role: 'contains-key' }));
        }
    }
    return Object.freeze({
        factsSource,
        relationGraphSource: createRelationGraphSource({
            snapshotId: options.snapshotId,
            nodes,
            edges,
        }),
    });
}
export function createBankListSources(bankList, options) {
    const bankIds = bankList.banks.map(bank => options.bankIdentity(bank.name));
    const relations = bankList.banks.map((bank, index) => Object.freeze({
        role: 'declares-bank',
        subjectId: bankIds[index],
        label: bank.name,
        kind: 'sc2-bank',
        provenance: provenance(options.source, ['banks', String(index)]),
    }));
    const factsSource = createSubjectFactsSource({
        snapshotId: options.snapshotId,
        subjectId: options.subjectId,
        label: options.label,
        kind: 'sc2-bank-list',
        type: 'StarCraft II BankList',
        source: options.source,
        groups: [
            {
                id: 'summary',
                label: 'BankList',
                facts: [fact(options.source, 'banks', 'Declared banks', bankList.banks.length, ['banks'])],
            },
            {
                id: 'banks',
                label: 'Banks',
                facts: bankList.banks.map((bank, index) => fact(options.source, `bank-${index}`, bank.name, Object.freeze({
                    name: bank.name,
                    ...(bank.player === undefined ? {} : { player: bank.player }),
                }), ['banks', String(index)])),
            },
        ],
        relations,
    });
    const nodes = [
        Object.freeze({ id: options.subjectId, label: options.label, type: 'sc2-bank-list' }),
    ];
    const seen = new Set([options.subjectId]);
    const edges = [];
    for (const [index, bank] of bankList.banks.entries()) {
        const id = bankIds[index];
        if (!seen.has(id)) {
            seen.add(id);
            nodes.push(Object.freeze({ id, label: bank.name, type: 'sc2-bank' }));
        }
        edges.push(Object.freeze({ from: options.subjectId, to: id, role: 'declares-bank' }));
    }
    return Object.freeze({
        factsSource,
        relationGraphSource: createRelationGraphSource({
            snapshotId: options.snapshotId,
            nodes,
            edges,
        }),
    });
}
//# sourceMappingURL=sources.js.map