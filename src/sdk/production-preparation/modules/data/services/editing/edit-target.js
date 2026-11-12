import { catalogFieldExists, insertCatalogEntityXml, insertCatalogEntityDeclaration, patchCatalogField, patchCatalogIndexedEntry, patchCatalogIndexedEntryRemoval, } from "./catalog-field-patch.js";
import { analyzeStarcraft2GraphIsolation } from "./graph-isolation.js";
import { resolvedEntityDeclarationXml } from "./resolved-entity-xml.js";
import { catalogNamespaceForFileName } from '@modkit/blizzard-starcraft2/data/catalog';
const MAXIMUM_FIELD_DEPTH = 64;
const FIELD_SEGMENT = /^[A-Za-z_][\w.:-]*$/u;
function recordOf(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value) ? value : undefined;
}
function requiredString(value, label) {
    if (typeof value !== 'string' || value.trim().length === 0) {
        throw new TypeError(`${label} must be a non-empty string`);
    }
    return value;
}
function logicalPath(value, label) {
    requiredString(value, label);
    if (value.includes('\0') || /^[a-z]:[\\/]/iu.test(value) || /^[\\/]/u.test(value)) {
        throw new TypeError(`${label} must be a confined logical path`);
    }
    const parts = [];
    for (const part of value.replace(/\\/gu, '/').split('/')) {
        if (part === '' || part === '.')
            continue;
        if (part === '..')
            throw new TypeError(`${label} must not escape its workspace root`);
        parts.push(part);
    }
    if (parts.length === 0)
        throw new TypeError(`${label} must name a logical path`);
    return parts.join('/');
}
/*
 * Planned paths are case-folded logical ids; a file the edit creates needs the spelling the SC2
 * editor writes (`Base.SC2Data/GameData/AbilData.xml`), or it lands on disk and in the archive
 * lower-cased. The root part stays as planned — the host strips it case-blind.
 */
const DATA_FOLDER_SPELLING = new Map([
    ['base.sc2data', 'Base.SC2Data'],
    ['gamedata', 'GameData'],
    ['editordata', 'EditorData'],
    ['editorcategories.xml', 'EditorCategories.xml'],
]);
function creationSpelling(path) {
    const parts = path.split('/');
    const start = parts.findIndex(part => part.toLowerCase() === 'base.sc2data');
    if (start < 0)
        return path;
    return parts
        .map((part, index) => {
        if (index < start)
            return part;
        const folded = part.toLowerCase();
        const known = DATA_FOLDER_SPELLING.get(folded);
        if (known !== undefined)
            return known;
        const namespace = index === parts.length - 1 ? catalogNamespaceForFileName(folded) : undefined;
        return namespace === undefined ? part : `${namespace}Data.xml`;
    })
        .join('/');
}
function pathKey(value) {
    return logicalPath(value, 'path').toLowerCase();
}
function fieldPathOf(value) {
    if (!Array.isArray(value) || value.length === 0 || value.length > MAXIMUM_FIELD_DEPTH) {
        throw new TypeError(`fieldPath must contain between one and ${MAXIMUM_FIELD_DEPTH} segments`);
    }
    const result = value.map((segment, index) => {
        const text = requiredString(segment, `fieldPath[${index}]`);
        if (!FIELD_SEGMENT.test(text) && !/^\d+$/u.test(text)) {
            throw new TypeError(`fieldPath[${index}] is not a catalog field or array selector`);
        }
        return text;
    });
    return Object.freeze(result);
}
function subjectOf(value) {
    const subject = recordOf(value);
    if (subject === undefined)
        throw new TypeError('subject must be an object');
    return Object.freeze({
        namespace: requiredString(subject.namespace, 'subject.namespace'),
        entityId: requiredString(subject.entityId, 'subject.entityId'),
    });
}
function sameDocument(left, right) {
    return left.rootId === right.rootId && pathKey(left.path) === pathKey(right.path);
}
function documentRef(document, documentIndex) {
    return Object.freeze({
        rootId: document.rootId,
        path: document.path,
        ...(document.revision === undefined ? {} : { revision: document.revision }),
        ...(documentIndex === undefined ? {} : { documentIndex }),
    });
}
function sourceDocument(entry, source) {
    const index = entry.analysisRequest.documents.findIndex(document => document.rootId === source.rootId && pathKey(document.path) === pathKey(source.path));
    return index < 0 ? undefined : { document: entry.analysisRequest.documents[index], index };
}
function fieldSource(entry, entity, fieldPath) {
    for (let index = entity.sources.length - 1; index >= 0; index -= 1) {
        const source = entity.sources[index];
        const found = sourceDocument(entry, source);
        if (found !== undefined &&
            catalogFieldExists(found.document.text, entity.typeId, entity.entityId, fieldPath)) {
            return source;
        }
    }
    return undefined;
}
function resolvedSchemaFields(snapshot, typeId, visiting = new Set()) {
    if (visiting.has(typeId))
        return [];
    const schema = snapshot.schemas?.find(candidate => candidate.typeId === typeId);
    if (schema === undefined)
        return [];
    const next = new Set(visiting);
    next.add(typeId);
    const fields = new Map();
    if (schema.parentTypeId !== undefined) {
        for (const field of resolvedSchemaFields(snapshot, schema.parentTypeId, next)) {
            fields.set(field.fieldId, field);
        }
    }
    for (const field of schema.fields)
        fields.set(field.fieldId, field);
    return [...fields.values()];
}
function schemaFieldAtPath(snapshot, typeId, path) {
    let fields = resolvedSchemaFields(snapshot, typeId);
    let field;
    for (let offset = 0; offset < path.length; offset += 1) {
        field = fields.find(candidate => candidate.fieldId === path[offset]);
        if (field === undefined)
            return undefined;
        if (offset === path.length - 1)
            return field;
        if (field.cardinality === 'indexed' && path[offset + 1] !== undefined)
            offset += 1;
        fields = field.fields ?? [];
    }
    return field;
}
function relevantCandidates(entry, selectedRootId) {
    const result = [];
    const seen = new Set();
    const add = candidate => {
        const key = `${candidate.rootId}\0${pathKey(candidate.path)}`;
        if (seen.has(key))
            return;
        seen.add(key);
        result.push(candidate);
    };
    entry.analysisRequest.documents.forEach((document, index) => {
        if (document.rootId === selectedRootId)
            add(documentRef(document, index));
    });
    for (const requirement of entry.dataPlan.requirements) {
        if (requirement.rootId === selectedRootId && requirement.kind === 'catalog') {
            add(Object.freeze({ rootId: requirement.rootId, path: requirement.path }));
        }
    }
    return Object.freeze(result);
}
function selectedCandidate(entry, request, entity, selectedRootId, fieldPath) {
    const localSources = entity.sources.filter(source => source.rootId === selectedRootId);
    const candidates = relevantCandidates(entry, selectedRootId);
    const explicit = recordOf(request.targetDocument);
    if (explicit !== undefined && explicit.rootId !== selectedRootId) {
        throw new TypeError('targetDocument.rootId must equal selectedRootId');
    }
    if (localSources.length > 0) {
        const lastDeclaration = localSources.at(-1);
        const found = sourceDocument(entry, lastDeclaration);
        if (found === undefined) {
            throw new RangeError(`the last local declaration ${lastDeclaration.path} is not present in the pinned snapshot`);
        }
        const target = documentRef(found.document, found.index);
        if (explicit !== undefined && !sameDocument(target, explicit)) {
            throw new TypeError(`ordinary edits must target the last declaration ${target.path}; switch context to edit another mod`);
        }
        return {
            target,
            candidates: Object.freeze([target]),
            lastDeclaration,
            action: catalogFieldExists(found.document.text, entity.typeId, entity.entityId, fieldPath)
                ? 'update-local-field'
                : 'create-local-field',
            selectionReason: 'last-local-declaration',
        };
    }
    if (explicit !== undefined) {
        const target = candidates.find(candidate => sameDocument(candidate, explicit));
        if (target === undefined) {
            throw new TypeError('targetDocument is not an existing or planned catalog document in this mod');
        }
        return {
            target,
            candidates,
            action: 'declare-local-entity',
            selectionReason: 'explicit-local-document',
        };
    }
    const suffix = `/gamedata/${entity.namespace.toLowerCase()}data.xml`;
    const canonical = candidates.filter(candidate => `/${pathKey(candidate.path)}`.endsWith(suffix));
    if (canonical.length === 1) {
        return {
            target: canonical[0],
            candidates,
            action: 'declare-local-entity',
            selectionReason: 'canonical-namespace-document',
        };
    }
    return {
        selectionRequired: true,
        candidates,
        reason: canonical.length > 1
            ? `more than one canonical ${entity.namespace} catalog document is available`
            : `no canonical ${entity.namespace} catalog document is available`,
    };
}
export function resolveStarcraft2DataEditTarget(entry, input) {
    const request = recordOf(input);
    if (request === undefined)
        throw new TypeError('data edit target request must be an object');
    request.signal?.throwIfAborted();
    const snapshotId = requiredString(request.snapshotId, 'snapshotId');
    if (snapshotId !== entry.snapshot.snapshotId)
        throw new RangeError('snapshotId is stale');
    const selectedRootId = requiredString(request.selectedRootId, 'selectedRootId');
    if (selectedRootId !== entry.workspace.activeRootId) {
        throw new TypeError(`selectedRootId ${selectedRootId} is not the active context ${entry.workspace.activeRootId}; re-analyze that mod as the active root`);
    }
    if (!Array.isArray(request.writableRootIds) ||
        !request.writableRootIds.every(rootId => typeof rootId === 'string') ||
        !request.writableRootIds.includes(selectedRootId)) {
        throw new TypeError(`selected mod ${selectedRootId} is not open for writing`);
    }
    const subject = subjectOf(request.subject);
    const fieldPath = fieldPathOf(request.fieldPath);
    const entity = entry.snapshot.definitions.find(item => item.namespace === subject.namespace && item.entityId === subject.entityId);
    if (entity === undefined) {
        throw new RangeError(`entity ${subject.namespace}/${subject.entityId} is not in the snapshot`);
    }
    const guards = Object.freeze(entry.analysisRequest.documents.map((document, index) => documentRef(document, index)));
    if (guards.some(guard => guard.revision === undefined)) {
        throw new TypeError('data authoring requires a revision for every document in the context');
    }
    const fieldPathText = fieldPath.join('.');
    const selection = selectedCandidate(entry, request, entity, selectedRootId, fieldPathText);
    if (selection.selectionRequired === true) {
        return Object.freeze({
            state: 'selection-required',
            schemaVersion: 1,
            snapshotId,
            workspaceId: entry.snapshot.workspaceId,
            selectedRootId,
            writableRootIds: Object.freeze([...new Set(request.writableRootIds)]),
            subject,
            fieldPath,
            candidates: selection.candidates,
            reason: selection.reason,
        });
    }
    const targetDocument = entry.analysisRequest.documents[selection.target.documentIndex];
    const target = Object.freeze({
        ...selection.target,
        ...(targetDocument === undefined ? { path: creationSpelling(selection.target.path) } : {}),
        mode: targetDocument === undefined ? 'create' : 'replace',
    });
    const effectiveFieldSource = fieldSource(entry, entity, fieldPathText);
    return Object.freeze({
        state: 'resolved',
        schemaVersion: 1,
        snapshotId,
        workspaceId: entry.snapshot.workspaceId,
        selectedRootId,
        writableRootIds: Object.freeze([...new Set(request.writableRootIds)]),
        subject,
        fieldPath,
        action: selection.action,
        target,
        candidates: selection.candidates,
        ...(selection.lastDeclaration === undefined
            ? {}
            : { lastDeclaration: Object.freeze({ ...selection.lastDeclaration }) }),
        ...(effectiveFieldSource === undefined
            ? {}
            : { effectiveFieldSource: Object.freeze({ ...effectiveFieldSource }) }),
        selectionReason: selection.selectionReason,
        guards,
    });
}
function freshCatalog() {
    return '<?xml version="1.0" encoding="utf-8"?>\n<Catalog>\n</Catalog>\n';
}
function valueAtPath(value, path) {
    let current = value;
    for (const segment of path) {
        if (Array.isArray(current) && /^\d+$/u.test(segment))
            current = current[Number(segment)];
        else if (recordOf(current) !== undefined && Object.hasOwn(current, segment))
            current = current[segment];
        else if (recordOf(recordOf(current)?.value) !== undefined)
            current = current.value[segment];
        else
            return undefined;
    }
    return current;
}
export async function planStarcraft2DataEdit(entry, input, analyze) {
    const request = recordOf(input);
    const intent = recordOf(request?.intent);
    if (request === undefined || intent === undefined)
        throw new TypeError('data edit plan request must include intent');
    if (intent.kind !== 'set-field' &&
        intent.kind !== 'remove-local-override' &&
        intent.kind !== 'set-indexed-entry' &&
        intent.kind !== 'remove-indexed-entry')
        throw new TypeError('unsupported data edit intent');
    const target = resolveStarcraft2DataEditTarget(entry, request);
    if (target.state !== 'resolved')
        return target;
    const entity = entry.snapshot.definitions.find(item => item.namespace === target.subject.namespace && item.entityId === target.subject.entityId);
    if (entity === undefined)
        throw new RangeError('resolved edit entity disappeared');
    const removingOverride = intent.kind === 'remove-local-override';
    const settingIndexedEntry = intent.kind === 'set-indexed-entry';
    const removingIndexedEntry = intent.kind === 'remove-indexed-entry';
    if (removingOverride && target.action !== 'update-local-field')
        throw new TypeError('cannot remove a local override that is not declared in the selected mod');
    const value = removingOverride || removingIndexedEntry ? null : intent.value;
    let indexedField;
    let indexedEntry;
    if (settingIndexedEntry || removingIndexedEntry) {
        indexedField = schemaFieldAtPath(entry.snapshot, entity.typeId, target.fieldPath);
        if (indexedField?.cardinality !== 'indexed') {
            throw new TypeError(`${intent.kind} requires an indexed schema field`);
        }
        if ((typeof intent.index !== 'string' && typeof intent.index !== 'number') ||
            (typeof intent.index === 'number' &&
                (!Number.isSafeInteger(intent.index) || intent.index < 0)) ||
            (typeof intent.index === 'string' &&
                !FIELD_SEGMENT.test(intent.index) &&
                !/^\d+$/u.test(intent.index))) {
            throw new TypeError(`${intent.kind} requires a valid named or non-negative numeric index`);
        }
        indexedEntry = intent.index;
    }
    const scalarValue = value === null ||
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean';
    if (!settingIndexedEntry && !removingIndexedEntry && !scalarValue) {
        throw new TypeError('set-field value must be a scalar or null');
    }
    if (settingIndexedEntry && value === null) {
        throw new TypeError('set-indexed-entry value cannot be null; use remove-indexed-entry to remove it');
    }
    if (settingIndexedEntry && indexedField.valueKind === 'struct' &&
        (typeof value !== 'object' || Array.isArray(value))) {
        throw new TypeError('set-indexed-entry requires an object for a structured schema field');
    }
    if (settingIndexedEntry && indexedField.valueKind !== 'struct' && !scalarValue) {
        throw new TypeError('set-indexed-entry requires a scalar for this schema field');
    }
    const existing = target.target.documentIndex === undefined
        ? undefined
        : entry.analysisRequest.documents[target.target.documentIndex];
    let text = existing?.text ?? freshCatalog();
    if (target.action === 'declare-local-entity') {
        const inserted = insertCatalogEntityDeclaration(text, entity.typeId, entity.entityId);
        if (!inserted.changed)
            throw new TypeError(inserted.reason ?? 'local declaration was not created');
        text = inserted.text;
    }
    const patched = settingIndexedEntry
        ? patchCatalogIndexedEntry(text, entity.typeId, entity.entityId, target.fieldPath.join('.'), indexedEntry, value, indexedField.indexKey ?? 'index')
        : removingIndexedEntry
            ? patchCatalogIndexedEntryRemoval(text, entity.typeId, entity.entityId, target.fieldPath.join('.'), indexedEntry, indexedField.indexKey ?? 'index')
            : patchCatalogField(text, entity.typeId, entity.entityId, target.fieldPath.join('.'), value === null ? null : String(value));
    if (!patched.changed)
        throw new TypeError(patched.reason ?? 'catalog field was not changed');
    const documents = [...entry.analysisRequest.documents];
    const replacement = Object.freeze({
        rootId: target.target.rootId,
        path: target.target.path,
        text: patched.text,
        ...(existing?.revision === undefined ? {} : { revision: existing.revision }),
    });
    if (target.target.mode === 'create')
        documents.push(replacement);
    else
        documents[target.target.documentIndex] = replacement;
    const requirement = entry.dataPlan.requirements.find(item => item.rootId === target.target.rootId && pathKey(item.path) === pathKey(target.target.path));
    const unresolvedRequirementIds = entry.analysisRequest.unresolvedRequirementIds.filter(requirementId => requirementId !== requirement?.requirementId);
    /*
     * A created document is one more planned read. When it answered a required file the host could
     * not find, it trades places with that unresolved id; a missing optional file was never counted,
     * so the plan grows by one — else the preview fails the analyzer's exact accounting.
     */
    const createdUncounted = target.target.mode === 'create' &&
        unresolvedRequirementIds.length === entry.analysisRequest.unresolvedRequirementIds.length;
    const preview = await analyze({
        ...entry.analysisRequest,
        documents,
        unresolvedRequirementIds,
        ...(createdUncounted
            ? { plannedDocumentCount: entry.analysisRequest.plannedDocumentCount + 1 }
            : {}),
        signal: request.signal,
    });
    const previewEntity = preview.definitions.find(item => item.namespace === target.subject.namespace && item.entityId === target.subject.entityId);
    const expectedEffectiveValue = previewEntity === undefined ? undefined : valueAtPath(previewEntity.fields, target.fieldPath);
    return Object.freeze({
        schemaVersion: 1,
        target,
        intent: Object.freeze(removingOverride
            ? { kind: 'remove-local-override' }
            : settingIndexedEntry
                ? { kind: 'set-indexed-entry', index: indexedEntry, value }
                : removingIndexedEntry
                    ? { kind: 'remove-indexed-entry', index: indexedEntry }
                    : { kind: 'set-field', value }),
        replacementText: patched.text,
        previewSnapshotId: preview.snapshotId,
        ...(expectedEffectiveValue === undefined ? {} : { expectedEffectiveValue }),
        diagnostics: preview.diagnostics,
    });
}
function replacementDocument(entry, target, replacementText) {
    const existing = target.documentIndex === undefined ? undefined : entry.analysisRequest.documents[target.documentIndex];
    return Object.freeze({
        rootId: target.rootId,
        path: target.path,
        text: replacementText,
        ...(existing?.revision === undefined ? {} : { revision: existing.revision }),
    });
}
function applyReplacement(documents, target, replacement) {
    if (target.mode === 'create')
        documents.push(replacement);
    else
        documents[target.documentIndex] = replacement;
}
function removeResolvedRequirement(entry, target, unresolvedRequirementIds) {
    const requirement = entry.dataPlan.requirements.find(item => item.rootId === target.rootId && pathKey(item.path) === pathKey(target.path));
    return unresolvedRequirementIds.filter(requirementId => requirementId !== requirement?.requirementId);
}
/** Build the two semantic writes as one source preview; no filesystem operation occurs here. */
export async function planStarcraft2GraphIsolation(entry, input, analyze) {
    const request = recordOf(input);
    if (request === undefined || request.schemaVersion !== 1) {
        throw new TypeError('SC2 graph isolation planning requires schemaVersion 1');
    }
    const cloneEntityId = requiredString(request.cloneEntityId, 'cloneEntityId');
    const analysis = analyzeStarcraft2GraphIsolation(entry.snapshot, request);
    if (analysis.state === 'unavailable')
        return analysis;
    if (entry.snapshot.definitions.some(entity => entity.namespace === analysis.target.namespace && entity.entityId === cloneEntityId)) {
        throw new TypeError(`clone ${analysis.target.namespace}/${cloneEntityId} already exists`);
    }
    const ownerPlan = await planStarcraft2DataEdit(entry, {
        ...request,
        subject: analysis.owner,
        fieldPath: analysis.ownerFieldPath,
        targetDocument: request.ownerTargetDocument,
        intent: { kind: 'set-field', value: cloneEntityId },
    }, analyze);
    if (ownerPlan.state === 'selection-required') {
        return Object.freeze({
            schemaVersion: 1,
            state: 'selection-required',
            snapshotId: ownerPlan.snapshotId,
            workspaceId: ownerPlan.workspaceId,
            selectedRootId: ownerPlan.selectedRootId,
            purpose: 'rewire',
            candidates: ownerPlan.candidates,
            reason: ownerPlan.reason,
        });
    }
    const cloneTarget = resolveStarcraft2DataEditTarget(entry, {
        ...request,
        subject: analysis.target,
        fieldPath: ['id'],
        targetDocument: request.cloneTargetDocument,
    });
    if (cloneTarget.state === 'selection-required') {
        return Object.freeze({
            schemaVersion: 1,
            state: 'selection-required',
            snapshotId: cloneTarget.snapshotId,
            workspaceId: cloneTarget.workspaceId,
            selectedRootId: cloneTarget.selectedRootId,
            purpose: 'clone',
            candidates: cloneTarget.candidates,
            reason: cloneTarget.reason,
        });
    }
    const sourceEntity = entry.snapshot.definitions.find(entity => entity.namespace === analysis.target.namespace && entity.entityId === analysis.target.entityId);
    const schema = entry.snapshot.schemas?.find(candidate => candidate.typeId === sourceEntity?.typeId);
    if (sourceEntity === undefined || schema === undefined) {
        throw new TypeError('resolved clone source or its complete schema is unavailable');
    }
    const declaration = resolvedEntityDeclarationXml(sourceEntity, { ...schema, fields: resolvedSchemaFields(entry.snapshot, sourceEntity.typeId) }, { entityId: cloneEntityId });
    const documents = [...entry.analysisRequest.documents];
    const ownerReplacement = replacementDocument(entry, ownerPlan.target.target, ownerPlan.replacementText);
    applyReplacement(documents, ownerPlan.target.target, ownerReplacement);
    const cloneExistingIndex = entry.analysisRequest.documents.findIndex(document => document.rootId === cloneTarget.target.rootId &&
        pathKey(document.path) === pathKey(cloneTarget.target.path));
    const cloneCurrentIndex = documents.findIndex(document => document.rootId === cloneTarget.target.rootId &&
        pathKey(document.path) === pathKey(cloneTarget.target.path));
    const cloneBase = cloneCurrentIndex < 0 ? freshCatalog() : documents[cloneCurrentIndex].text;
    const inserted = insertCatalogEntityXml(cloneBase, sourceEntity.typeId, cloneEntityId, declaration);
    if (!inserted.changed)
        throw new TypeError(inserted.reason ?? 'clone declaration was not inserted');
    const cloneResolvedTarget = Object.freeze({
        ...cloneTarget.target,
        ...(cloneExistingIndex < 0
            ? { mode: 'create', documentIndex: undefined, path: creationSpelling(cloneTarget.target.path) }
            : { mode: 'replace', documentIndex: cloneExistingIndex }),
    });
    const cloneReplacement = replacementDocument(entry, cloneResolvedTarget, inserted.text);
    if (cloneCurrentIndex < 0)
        documents.push(cloneReplacement);
    else
        documents[cloneCurrentIndex] = cloneReplacement;
    let unresolvedRequirementIds = [...entry.analysisRequest.unresolvedRequirementIds];
    unresolvedRequirementIds = removeResolvedRequirement(entry, ownerPlan.target.target, unresolvedRequirementIds);
    unresolvedRequirementIds = removeResolvedRequirement(entry, cloneResolvedTarget, unresolvedRequirementIds);
    const preview = await analyze({
        ...entry.analysisRequest,
        documents,
        unresolvedRequirementIds,
        signal: request.signal,
    });
    const previewOwner = preview.definitions.find(entity => entity.namespace === analysis.owner.namespace && entity.entityId === analysis.owner.entityId);
    const previewClone = preview.definitions.find(entity => entity.namespace === analysis.target.namespace && entity.entityId === cloneEntityId);
    if (valueAtPath(previewOwner?.fields, analysis.ownerFieldPath) !== cloneEntityId) {
        throw new TypeError('isolation preview did not rewire the exact owner field');
    }
    if (previewClone === undefined)
        throw new TypeError('isolation preview did not resolve the clone');
    const sameTarget = ownerPlan.target.target.rootId === cloneResolvedTarget.rootId &&
        pathKey(ownerPlan.target.target.path) === pathKey(cloneResolvedTarget.path);
    const replacements = sameTarget
        ? [
            Object.freeze({
                purpose: 'clone-and-rewire',
                target: cloneResolvedTarget,
                replacementText: inserted.text,
            }),
        ]
        : [
            Object.freeze({
                purpose: 'rewire',
                target: ownerPlan.target.target,
                replacementText: ownerPlan.replacementText,
            }),
            Object.freeze({
                purpose: 'clone',
                target: cloneResolvedTarget,
                replacementText: inserted.text,
            }),
        ];
    return Object.freeze({
        schemaVersion: 1,
        state: 'planned',
        analysis,
        snapshotId: entry.snapshot.snapshotId,
        workspaceId: entry.snapshot.workspaceId,
        selectedRootId: request.selectedRootId,
        writableRootIds: Object.freeze([...new Set(request.writableRootIds)]),
        clone: Object.freeze({ namespace: analysis.target.namespace, entityId: cloneEntityId }),
        guards: ownerPlan.target.guards,
        replacements: Object.freeze(replacements),
        previewSnapshotId: preview.snapshotId,
        diagnostics: preview.diagnostics,
    });
}
//# sourceMappingURL=edit-target.js.map