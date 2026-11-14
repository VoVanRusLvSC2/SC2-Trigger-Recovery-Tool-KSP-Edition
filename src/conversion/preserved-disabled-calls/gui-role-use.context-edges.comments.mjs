import { collectPreservedDisabledGuiCalls } from '../../bindings/preserved-disabled-gui-calls.mjs';
import { qualifySourceNominalReturnRoles } from '../source-nominal-return-roles/retained-nominal-gui-interfaces.replay.mjs';
import { collectGuiEventContexts } from '../event-comment-edges/gui-event-context-edges.comments.mjs';
import declarationProfile from '../../verification/gui-declaration-abi.nominal-qualified.json' with { type: 'json' };
import { createHash } from 'node:crypto';
import { parseTriggerXmlSync } from '../implicit-gui-localization/sax-reader-alternate-3.js';
import { createGuiRoleCatalog } from '../../bindings/gui-role-catalog.standard-schema.strict.mjs';
import { readOwnedGuiLibraries as read } from '../implicit-gui-localization/read-owned-gui-libraries-alternate.mjs';

/** Validate newly emitted return carriers through the same role catalog used
 * for formal/event queries. Unchanged authored GUI remains source-owned. */
export function auditGuiRoleUse({
  xml,
  existingXml = '',
  implicitLibraryId = 'Map',
  dependencyLibraries = [],
  sourceInput,
}) {
  const libs = new Map(),
    trustedOwners = [],
    ownerInputs = new Map();
  for (const dependency of dependencyLibraries) {
    const input = dependency.triggerData ?? '',
      parsed = parseTriggerXmlSync(input);
    for (const [id, lib] of parsed) {
      if (libs.has(id)) {
        if (ownerInputs.get(id) !== input) throw Error('AMBIGUOUS_GUI_ROLE_DEPENDENCY');
        continue;
      }
      libs.set(id, lib);
      ownerInputs.set(id, input);
      trustedOwners.push(id);
    }
  }
  const authored = read(xml, implicitLibraryId),
    old = existingXml ? read(existingXml, implicitLibraryId) : new Map();
  for (const [id, lib] of authored) {
    if (libs.has(id)) throw Error('GUI_ROLE_AUTHORED_OWNER_COLLISION');
    libs.set(id, lib);
  }
  const sourceNominalReturnRoles =
    sourceInput && xml !== existingXml
      ? qualifySourceNominalReturnRoles({ input: sourceInput, xml, library: implicitLibraryId })
      : { qualified: [], reason: 'NO_NEW_SOURCE_ROLE' };
  const sourceRoleKeys = new Set(
    sourceNominalReturnRoles.qualified.map((r) => JSON.stringify([r.library, r.type, r.id])),
  );
  let qualifiedSourceReturns = 0;
  const disabledSource = collectPreservedDisabledGuiCalls(authored, old);
  const catalog = createGuiRoleCatalog(libs, { trustedOwners }),
    contexts = collectGuiEventContexts(authored, catalog),
    issues = [...contexts.issues];
  let checked = 0,
    preserved = 0,
    callsChecked = 0,
    preservedDisabledCalls = 0;
  const declarationProfileActive = dependencyLibraries.some(
    (d) =>
      createHash('sha256')
        .update(d.triggerData ?? '')
        .digest('hex') === declarationProfile.metadata.sha256,
  );
  const key = (ref, owner) => JSON.stringify([ref.library ?? owner, ref.type, ref.id]);
  for (const [owner, lib] of authored)
    for (const e of Object.values(lib.elements ?? {})) {
      if (e.type !== 'FunctionCall') continue;
      callsChecked++;
      const preservedDisabled = disabledSource.isPreservedDisabledCall(e, owner);
      if (preservedDisabled) preservedDisabledCalls++;
      const definition = catalog.resolve(e.functionDef, owner, 'FunctionDef');
      if (!definition) {
        issues.push({ library: owner, id: e.id, reason: 'FUNCTION_DEFINITION_OWNER_UNRESOLVED' });
        continue;
      }
      const functionOwner = definition.library ?? e.functionDef.library ?? owner,
        formals = new Set((definition.parameters ?? []).map((r) => key(r, functionOwner))),
        counts = new Map();
      for (const ref of e.parameters ?? []) {
        const param = catalog.resolve(ref, owner, 'Param');
        if (!param?.parameterDef) {
          issues.push({
            library: owner,
            id: e.id,
            param: ref,
            reason: 'CALL_PARAMETER_FORMAL_REQUIRED',
          });
          continue;
        }
        const formalKey = key(param.parameterDef, param.library ?? owner);
        counts.set(formalKey, (counts.get(formalKey) ?? 0) + 1);
        if (!formals.has(formalKey))
          issues.push({
            library: owner,
            id: e.id,
            param: ref,
            formal: param.parameterDef,
            reason: 'CALL_PARAMETER_OWNER_MISMATCH',
          });
      }
      for (const ref of definition.parameters ?? []) {
        const formal = catalog.resolve(ref, functionOwner, 'ParamDef'),
          count = counts.get(key(ref, functionOwner)) ?? 0;
        if (!formal) {
          issues.push({
            library: owner,
            id: e.id,
            formal: ref,
            reason: 'CALL_FORMAL_DEFINITION_UNRESOLVED',
          });
          continue;
        }
        if (!count && !formal.default && !formal.isMultiple && !preservedDisabled)
          issues.push({
            library: owner,
            id: e.id,
            formal: ref,
            reason: 'CALL_REQUIRED_PARAMETER_MISSING',
          });
        if (count > 1 && !formal.isMultiple)
          issues.push({
            library: owner,
            id: e.id,
            formal: ref,
            count,
            reason: 'CALL_PARAMETER_DUPLICATED',
          });
      }
      // Event Function declarations also acquire an implicit trigger formal in
      // the real generator. FlagAction does not supply it to an ordinary call.
      // Qualify the call site, not merely the declaration's list of GUI formals.
      if (definition.flags?.includes('Event') && !contexts.isEventSite(e, owner))
        issues.push({
          library: owner,
          id: e.id,
          definition: e.functionDef,
          reason: definition.flags.includes('Native')
            ? 'EVENT_OUTSIDE_QUALIFIED_GUI_CONTEXT'
            : 'EVENT_FUNCTION_IMPLICIT_TARGET_UNPROVEN',
        });
    }
  for (const [owner, lib] of authored)
    for (const e of Object.values(lib.elements ?? {})) {
      if (e.type !== 'FunctionDef' || e.flags?.includes('Native')) continue;
      // A well-typed offline program does not certify that the GUI frontend
      // can emit the same formal declaration. Apply only qualified role/type
      // rejections; absence from the SDK is not itself a negative certificate.
      if (declarationProfileActive && !e.scriptCode && !e.expressionCode)
        for (const rule of declarationProfile.rules) {
          if (
            !rule.requiredFlags.every((f) => e.flags?.includes(f)) ||
            rule.excludedFlags.some((f) => e.flags?.includes(f))
          )
            continue;
          for (const ref of e.parameters ?? []) {
            const formal = catalog.resolve(ref, owner, 'ParamDef');
            const type = formal?.paramType;
            const preset =
              type?.type === 'preset'
                ? catalog.resolve(type.typeElement, owner, 'Preset')
                : undefined;
            const matches = rule.surfaceType
              ? JSON.stringify(type) === JSON.stringify(rule.surfaceType)
              : !!rule.presetBaseType && preset?.baseType === rule.presetBaseType;
            if (formal && matches)
              issues.push({
                library: owner,
                id: e.id,
                formal: ref,
                role: rule.role,
                type: formal.paramType,
                reason: rule.reason,
                frontendBuild: declarationProfile.editor.build,
              });
          }
        }
      const same =
        old.get(owner)?.elementsByType?.FunctionDef?.[e.id] ??
        Object.values(old.get(owner)?.elements ?? {}).find(
          (x) => x.type === 'FunctionDef' && x.id === e.id,
        );
      if (same && JSON.stringify(same.returnType) === JSON.stringify(e.returnType)) {
        preserved++;
        continue;
      }
      const type = e.returnType ?? { type: 'void' },
        result = catalog.typeUse(type, 'return', owner);
      checked++;
      if (result.status !== 'RESOLVED') {
        if (result.reason === 'STRUCTURE_ROLE_NOT_QUALIFIED' && sourceRoleKeys.has(key(e, owner)))
          qualifiedSourceReturns++;
        else
          issues.push({
            library: owner,
            type: e.type,
            id: e.id,
            identifier: e.identifier,
            contract: result,
          });
      }
    }
  return {
    kind: 'GUI_ROLE_USE_PREFLIGHT',
    passed: !issues.length && !catalog.issues.length,
    checked,
    preserved,
    callsChecked,
    preservedDisabledCalls,
    issues,
    catalogIssues: catalog.issues,
    trustedOwners,
    qualifiedSourceReturns,
    sourceNominalReturnRoles,
    sourceOrGuiChanged: false,
    newNative: 0,
    newCustomScript: 0,
    abiProved: false,
  };
}
