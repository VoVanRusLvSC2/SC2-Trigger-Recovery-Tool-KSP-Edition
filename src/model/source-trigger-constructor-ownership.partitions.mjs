import {readPartitionStartupOwnership} from "./partition-startup-ownership.mjs";
import {SyntaxKind as K, forEachChild} from "../sdk/array-values/modules/galaxy/language-core/index.js";
import {declaredTriggerConstructorFrame} from "./declared-trigger-constructor-frame.mjs";
import {createSourceNativeApiFacts} from "../conversion/native-expression-identity/source-native-api-facts.identity-only-alternate.mjs";

const un = node => {while (node?.kind === K.ParenthesizedExpression) node = node.expression; return node;};
function walk(node, visit, parent) {
  if (!node) return;
  visit(node, parent); forEachChild(node, child => walk(child, visit, node));
}
const signature = node => JSON.stringify([node.type?.kind, node.parameters?.map(p => [p.type?.kind, !!p.isReference])]);

// A GUI Trigger creates its handle automatically at startup. Non-GUI callbacks
// and constructors without source invocations must also retain ordinary source
// bodies. The records describe ownership only; they do not authorize weaving.
// That representation
// cannot replace an original constructor called from a runtime callback. Keep
// the existing constructor/callback as ordinary GUI functions instead. This
// plan never renames a symbol, adds a function or moves a startup operation.
export function planSourceTriggerConstructors({program, statements, candidates, libraries, nativeLibraryId, finalAutomaticConstructors, partitionStartupOwnership}) {
  const ordinaryCallbacks = new Set(), records = [], refused = [];
  const empty = () => ({ordinaryCallbacks, records, refused, newRuntimeFunctions: 0,
    newNative: 0, newCustomScript: 0, startupMovementAuthorized: false});
  if (!program || program.closed) return empty();
  const bodies = new Map(), declarations = new Map(), globals = new Map(), calls = [], references = new Map();
  for (const [fileName, ast] of program.documents) {
    if (!program.verifiedInputIdentity(fileName)) return empty();
    program.attachOriginal(ast);
    for (const node of ast.statements) {
      if (node.kind === K.FunctionDeclaration) {
        const list = declarations.get(node.name.name) ?? []; list.push(node); declarations.set(node.name.name, list);
        if (node.body) {
          const list = bodies.get(node.name.name) ?? []; list.push(node); bodies.set(node.name.name, list);
          walk(node.body, (child, parent) => {
            if (child.kind === K.Identifier) {
              const list = references.get(child.name) ?? []; list.push({node: child, parent, owner: node}); references.set(child.name, list);
            }
            if (child.kind === K.CallExpression && un(child.expression)?.kind === K.Identifier)
              calls.push({node: child, callee: un(child.expression), owner: node});
          });
        }
      } else if (node.kind === K.VariableDeclaration) {
        const list = globals.get(node.name.name) ?? []; list.push(node); globals.set(node.name.name, list);
      }
    }
  }
  const ownNames = new Set(statements.filter(n => n.kind === K.FunctionDeclaration && n.body).map(n => n.name.name));
  const boundBody = identifier => {
    const declaration = program.declarationAt(identifier), name = identifier.name, definitions = bodies.get(name) ?? [];
    if (declaration?.kind !== K.FunctionDeclaration || definitions.length !== 1 || globals.has(name) || program.conflicts.has(name)) return;
    if (!(declarations.get(name) ?? []).includes(declaration) || signature(declaration) !== signature(definitions[0])) return;
    return definitions[0];
  };
  const outgoing = new Map(), incoming = new Map();
  for (const call of calls) {
    const target = boundBody(call.callee); if (!target) continue;
    const list = outgoing.get(call.owner) ?? []; list.push(target); outgoing.set(call.owner, list);
    const sites = incoming.get(target) ?? []; sites.push(call); incoming.set(target, sites);
  }
  // This graph only distinguishes a runtime reference from a direct startup
  // reference. It is NOT evidence that natives cannot dispatch callbacks.
  const startup = new Set(), roots = bodies.get('InitMap') ?? [], pending = roots.length === 1 ? [...roots] : [];
  while (pending.length) {
    const node = pending.pop(); if (startup.has(node)) continue;
    startup.add(node); pending.push(...outgoing.get(node) ?? []);
  }
  // Final emitted constructor roles are stronger evidence than callback shape.
  // A callback shared with any retained source constructor also remains source.
  const forcedSourceCallbacks = new Set();
  if (finalAutomaticConstructors) for (const definitions of bodies.values()) {
    if (definitions.length !== 1 || !ownNames.has(definitions[0].name.name)) continue;
    const frame = declaredTriggerConstructorFrame(definitions[0]);
    if (frame && !finalAutomaticConstructors.has(frame.sourceFunction)) forcedSourceCallbacks.add(frame.callback);
  }
  const partition = readPartitionStartupOwnership(partitionStartupOwnership, program);
  const facts = createSourceNativeApiFacts(program, libraries);
  try {
    for (const definitions of bodies.values()) {
      if (definitions.length !== 1) continue;
      const constructor = definitions[0], frame = declaredTriggerConstructorFrame(constructor);
      if (!frame || !ownNames.has(constructor.name.name)) continue;
      const parentOwnership = partition?.functionOwnership(constructor);
      const localSites = incoming.get(constructor) ?? [];
      const callerSites = parentOwnership ? parentOwnership.callers : localSites;
      const isStartupCaller = c => parentOwnership ? c.directStartupPath : startup.has(c.owner);
      const reason = finalAutomaticConstructors && !finalAutomaticConstructors.has(frame.sourceFunction) ? 'FINAL_GUI_CONSTRUCTOR_NOT_EMITTED'
        : forcedSourceCallbacks.has(frame.callback) ? 'SHARED_CALLBACK_REQUIRES_SOURCE_OWNERSHIP'
        : !candidates.has(frame.callback) ? 'CALLBACK_NOT_GUI_TRIGGER_COMPATIBLE'
        : callerSites.length === 0 ? 'NO_SOURCE_CONSTRUCTOR_INVOCATION'
        : !parentOwnership && roots.length !== 1 ? 'STARTUP_OWNERSHIP_UNPROVED'
        : callerSites.some(c => !isStartupCaller(c)) ? 'RUNTIME_CONSTRUCTOR_REFERENCE' : undefined;
      if (!reason) continue;
      const reject = reason => refused.push({constructor: frame.sourceFunction, callback: frame.callback, reason});
      if (program.conflicts.has(constructor.name.name) ||
          (declarations.get(constructor.name.name) ?? []).some(node => signature(node) !== signature(constructor))) {
        reject('CONSTRUCTOR_ABI_NOT_UNIQUE'); continue;
      }
      const callback = bodies.get(frame.callback)?.[0];
      if (bodies.get(frame.callback)?.length !== 1 || program.conflicts.has(frame.callback) || globals.has(frame.callback) ||
          !ownNames.has(frame.callback) || callback.type.kind !== K.BoolKeyword ||
          callback.parameters.length !== 2 || callback.parameters.some(p => p.type.kind !== K.BoolKeyword || p.isReference) || callback.modifiers?.length) {
        reject('CALLBACK_ABI_NOT_UNIQUE_BOOL_BOOL_BOOL'); continue;
      }
      const refs = references.get(constructor.name.name) ?? [];
      if (parentOwnership && !parentOwnership.allReferencesAreBoundDirectCalls || refs.some(r => r.parent?.kind !== K.CallExpression || un(r.parent.expression) !== r.node || boundBody(r.node) !== constructor)) {
        reject('CONSTRUCTOR_REFERENCE_NOT_BOUND_DIRECT_CALL'); continue;
      }
      const assignment = un(constructor.body.statements.find(s => s.kind !== K.VariableDeclaration)?.expression);
      const target = un(assignment.left), create = un(assignment.right), declaration = program.declarationAt(target);
      if (globals.get(frame.handle)?.length !== 1 || declaration !== globals.get(frame.handle)[0] || declaration.type.kind !== K.TriggerKeyword || declaration.modifiers?.length) {
        reject('HANDLE_NOT_UNIQUE_MUTABLE_GLOBAL_TRIGGER'); continue;
      }
      const native = facts.declaration(create, nativeLibraryId);
      if (!native || native.proof.signature.returnType !== 'trigger' || JSON.stringify(native.proof.signature.parameters) !== '["string"]') {
        reject('TRIGGER_CREATE_ABI_NOT_BOUND'); continue;
      }
      ordinaryCallbacks.add(frame.callback);
      records.push({kind: 'RETAIN_SOURCE_TRIGGER_CONSTRUCTOR_AND_CALLBACK', reason, constructor: frame.sourceFunction,
        handle: frame.handle, callback: frame.callback, constructorSource: program.location(constructor), callbackSource: program.location(callback),
        createApi: native.proof, callers: callerSites.map(c => parentOwnership ? c : ({owner: c.owner.name.name, source: program.location(c.node), directStartupPath: startup.has(c.owner)})),
        ...(parentOwnership ? {partitionStartupOwnership:partition.proof} : {}),
        ordinaryGuiFunctionsAreExistingSourceBodies: true, sourceBodyChanged: false, nameChanged: false,
        startupMovementAuthorized: false, nativeDispatchTimingInferred: false});
    }
  } finally { facts.dispose(); }
  return empty();
}
