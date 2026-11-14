import { resolveNativeEventDescription } from '../../bindings/native-event-description-candidate.presentation.mjs';
import { inspectContextualNativeValueCandidates } from '../../bindings/contextual-native-source-identity.mjs';
import { recoverySessionFor } from '../native-expression-identity/recovery-session-alternate-2.mjs';
import { createHash } from 'node:crypto';
import { SyntaxKind as K } from '../exact-function-signatures/index-alternate-3.js';
import { declaredCarrier } from '../exact-function-signatures/galaxy-program-context.js';
import { generateId } from '../native-expression-identity/g2t-core.generated-call-provenance.mjs';
import { formalGalaxyCarrier } from '../../types/formal-galaxy-carrier.native-formals.mjs';
import { createGuiRoleCatalog } from '../../bindings/gui-role-catalog.standard-schema.strict.mjs';

const sha = (value) => createHash('sha256').update(JSON.stringify(value)).digest('hex');
const reference = (e) => ({ type: e.type, library: e.library, id: e.id });

/** Last resort for a bound external native with no usable installed GUI role.
 * This declares an existing runtime API; it never implements a new function.
 * A stock Event can supply its exact nominal formals, while an Action supplies
 * the otherwise implicit trigger explicitly. Stock Event metadata is untouched.
 * Other rejected/ambiguous stock bindings are NOT permission to add a bridge.
 */
export function createMissingNativeGuiDescriptions(session) {
  const index = session.candidates,
    program = session.program,
    libraries = index.libraries;
  for (const source of program.documents.values()) program.attachOriginal(source);
  const roles = createGuiRoleCatalog(libraries, { trustedOwners: [...libraries.keys()] });
  const definitions = new Map(),
    records = [],
    fingerprints = new Map();
  const fingerprint = (definition, elements) =>
    sha({
      definition,
      parameters: definition.parameters.map((r) =>
        r.library === definition.library
          ? elements[r.id]
          : index.formal(r, { id: definition.library }),
      ),
    });
  const scalar = (carrier, role) => {
    if (!carrier || /\[|\]|\*|&/u.test(carrier)) return;
    if (carrier === 'unitref') {
      if (role !== 'parameter') return;
      const witnessed = [...libraries.values()].some((lib) =>
        Object.values(lib.elementsByType?.ParamDef ?? {}).some(
          (p) => p.isReference && p.paramType?.type === 'unit',
        ),
      );
      return witnessed ? { paramType: { type: 'unit' }, isReference: true } : undefined;
    }
    const type = { type: carrier };
    return roles.typeUse(type, role, 'Map').status === 'RESOLVED' ? { paramType: type } : undefined;
  };
  function describe(call, ctx, use, resolution) {
    if (
      !['action', 'value'].includes(use) ||
      !['UNRESOLVED', 'SIGNATURE_MISMATCH', 'RESOLVED'].includes(resolution.status) ||
      call?.expression?.kind !== K.Identifier
    )
      return;
    const declaration = program.declarationAt(call.expression),
      binding = program.getBinding(call.expression);
    if (
      binding.status !== 'BOUND' ||
      declaration?.kind !== K.FunctionDeclaration ||
      declaration.body ||
      !declaration.modifiers?.some((m) => m.kind === K.NativeKeyword)
    )
      return;
    let source = declaration;
    while (source.parent) source = source.parent;
    const sourceIdentity = program.verifiedInputIdentity(source.fileName);
    if (sourceIdentity?.owned !== false || !sourceIdentity.contentSha256) return;
    const name = call.expression.name,
      abi = {
        returnType: declaredCarrier(declaration.type),
        parameters: declaration.parameters.map((p) => declaredCarrier(p.type)),
      };
    if (
      call.arguments.length !== abi.parameters.length ||
      !abi.returnType ||
      abi.parameters.some((x) => !x) ||
      (use === 'value' && abi.returnType === 'void')
    )
      return;
    const contextual = inspectContextualNativeValueCandidates(index, name, abi);
    if (resolution.status === 'RESOLVED' && !contextual) return;
    const candidates = index.bySymbol.get(name) ?? [],
      events = [];
    for (const candidate of contextual ? [] : candidates) {
      const d = candidate.definition;
      if (
        candidate.origin !== 'emitted' ||
        !d.flags?.includes('Native') ||
        !d.flags.includes('Event') ||
        d.scriptCode ||
        d.expressionCode ||
        d.disabled ||
        abi.parameters[0] !== 'trigger'
      )
        return;
      const formals = (d.parameters ?? []).map((r) => index.formal(r, candidate.library));
      if (
        formals.some((f) => !f) ||
        formals.length + 1 !== abi.parameters.length ||
        index.carrier(d.returnType, candidate.library) !== abi.returnType ||
        formals.some(
          (f, i) => formalGalaxyCarrier(index, f, candidate.library, d) !== abi.parameters[i + 1],
        )
      )
        return;
      events.push(candidate);
    }
    if (events.length) {
      if (use !== 'action' || abi.returnType !== 'void') return;
      const resolved = resolveNativeEventDescription(index, {
        name,
        guiUse: 'event',
        declaration: abi,
      });
      if (resolved.status !== 'RESOLVED') return;
      events.splice(
        0,
        events.length,
        events.find((c) => c.definition === resolved.definition),
      );
      if (!events[0]) return;
    }
    const signature = JSON.stringify([ctx.libId, name, abi, use]),
      prior = definitions.get(signature);
    if (prior) return prior;
    const event = events[0],
      specs = event
        ? [scalar('trigger', 'parameter')]
        : abi.parameters.map((t) => scalar(t, 'parameter'));
    const returned =
      abi.returnType === 'void' ? undefined : scalar(abi.returnType, 'return')?.paramType;
    if (specs.some((s) => !s) || (abi.returnType !== 'void' && !returned)) return;
    const parameters = [],
      added = [];
    for (let i = 0; i < specs.length; i++) {
      const id = generateId(),
        param = {
          type: 'ParamDef',
          id,
          library: ctx.libId,
          name: declaration.parameters[i]?.name?.name ?? `argument${i + 1}`,
          ...specs[i],
        };
      added.push(param);
      parameters.push(reference(param));
    }
    if (event)
      parameters.push(
        ...event.definition.parameters.map((r) => ({
          ...r,
          type: 'ParamDef',
          library: r.library ?? event.library.id,
        })),
      );
    const id = generateId(),
      definition = {
        type: 'FunctionDef',
        id,
        library: ctx.libId,
        name,
        identifier: name,
        flags: ['Native', 'NoScriptPrefix', use === 'action' ? 'Action' : 'Call'],
        parameters,
        ...(returned ? { returnType: returned } : {}),
        isFuncAction: use === 'action',
        isFuncCall: use === 'value',
      };
    for (const element of [...added, definition]) ctx.elements[element.id] = element;
    definitions.set(signature, definition);
    fingerprints.set(definition, fingerprint(definition, ctx.elements));
    records.push({
      kind: 'MISSING_STOCK_GUI_NATIVE_DESCRIPTION',
      definition: reference(definition),
      api: name,
      role: use,
      abi,
      declaration: { source: sourceIdentity, location: program.location(declaration) },
      site: program.location(call),
      stockLookup: {
        status: resolution.status,
        candidateKeys: resolution.candidateKeys ?? [],
        inspectedLibraries: [...libraries.keys()],
        reason: contextual
          ? 'STOCK_GUI_IS_LEXICAL_BUT_SOURCE_CALLS_RUNTIME_NATIVE'
          : event
            ? 'EVENT_HAS_IMPLICIT_TARGET_BUT_ACTION_REQUIRES_EXPLICIT_TARGET'
            : 'NO_LOADED_DESCRIPTION_FOR_BOUND_NATIVE_SYMBOL',
        contextual,
        event: event
          ? { key: event.key, sha256: sha(event.definition), parameterDefsUnchanged: true }
          : undefined,
      },
      newNativeDescriptions: 1,
      newRuntimeFunctions: 0,
      newCustomScript: 0,
      fullNativeExportAndOracleRequired: true,
      wholeMapAccepted: false,
    });
    return definition;
  }
  return {
    describe,
    allows: (definition, elements) =>
      fingerprints.has(definition) &&
      fingerprints.get(definition) === fingerprint(definition, elements),
    report: () => ({
      kind: 'MISSING_STOCK_GUI_NATIVE_DESCRIPTIONS',
      records: [...records],
      newNativeDescriptions: records.length,
      newRuntimeFunctions: 0,
      newCustomScript: 0,
      stockPreferred: true,
      sourceChanged: false,
      wholeMapAccepted: false,
    }),
  };
}

export const authorizedMissingNativeGuiDescription = (elements, definition) =>
  recoverySessionFor(elements)?.missingDescriptions?.allows(definition, elements) === true;
