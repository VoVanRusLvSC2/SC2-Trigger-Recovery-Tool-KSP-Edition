import { STARCRAFT2_DATA_SCHEMA_PROVENANCE } from './full-data-schema.js';
export const STARCRAFT2_DATA_ECOSYSTEM = 'starcraft-2';
export const STARCRAFT2_DATA_SCHEMA_CONTRACT = 'blizzard/sc2-data-schema';
const schemaCommit = STARCRAFT2_DATA_SCHEMA_PROVENANCE.legacySchemaCommit;
const schemaDigest = STARCRAFT2_DATA_SCHEMA_PROVENANCE.digest;
if (typeof schemaCommit !== 'string' ||
    !/^[0-9a-f]{40}$/u.test(schemaCommit) ||
    typeof schemaDigest !== 'string' ||
    !/^sha256:[0-9a-f]{64}$/u.test(schemaDigest)) {
    throw new TypeError('SC2 data schema provenance must contain a pinned commit and SHA-256 digest');
}
export const STARCRAFT2_DATA_SCHEMA_REVISION = `full-${schemaCommit}-sha256-${schemaDigest.slice('sha256:'.length, 'sha256:'.length + 16)}`;
function boundedId(value, label, maximum) {
    if (typeof value !== 'string' || value.length === 0 || value.length > maximum) {
        throw new TypeError(`${label} must contain between 1 and ${maximum} characters`);
    }
    return value;
}
export function starcraft2FieldKnowledgeTarget(typeId, canonicalPath) {
    boundedId(typeId, 'knowledge field typeId', 128);
    if (!Array.isArray(canonicalPath) ||
        canonicalPath.length === 0 ||
        canonicalPath.length > 32 ||
        canonicalPath.some(item => typeof item !== 'string' || item.length === 0 || item.length > 128)) {
        throw new TypeError('knowledge field canonicalPath must contain 1 to 32 bounded segments');
    }
    return Object.freeze({
        kind: 'field',
        ecosystem: STARCRAFT2_DATA_ECOSYSTEM,
        schema: Object.freeze({
            contract: STARCRAFT2_DATA_SCHEMA_CONTRACT,
            major: 1,
            revision: STARCRAFT2_DATA_SCHEMA_REVISION,
        }),
        typeId,
        canonicalPath: Object.freeze([...canonicalPath]),
    });
}
export function starcraft2SubjectKnowledgeTarget(subjectKind, subjectId) {
    boundedId(subjectKind, 'knowledge subject kind', 128);
    if (subjectId !== undefined)
        boundedId(subjectId, 'knowledge subject id', 512);
    return Object.freeze({
        kind: 'subject',
        ecosystem: STARCRAFT2_DATA_ECOSYSTEM,
        subjectKind,
        ...(subjectId === undefined ? {} : { subjectId }),
    });
}
export function starcraft2ConceptKnowledgeTarget(conceptId) {
    boundedId(conceptId, 'knowledge concept id', 128);
    return Object.freeze({
        kind: 'concept',
        ecosystem: STARCRAFT2_DATA_ECOSYSTEM,
        conceptId,
    });
}
//# sourceMappingURL=data-schema-identity.js.map