import { SyntaxKind as K, forEachChild } from '../exact-function-signatures/index-alternate-3.js';
import { resolveBoundStorage } from './bound-storage-path.type-aliases.mjs';
import { triggerConstructorFrame } from '../exact-function-signatures/trigger-constructor-frame.mjs';
const un = (n) => (n?.kind === K.ParenthesizedExpression ? un(n.expression) : n);
const visit = (node, fn) => {
  fn(node);
  forEachChild(node, (c) => visit(c, fn));
};
const ownerOf = (n) => {
  while (n && n.kind !== K.FunctionDeclaration) n = n.parent;
  return n;
};

/** Conversion-owned facts, never permission to move an event or change target.
 * The direct-call dependency index is lazy and is built only for diagnostics.
 * Callback strings and unresolved calls remain explicit coverage obligations. */
export function createSourceEventEffects(program) {
  if (typeof program?.verifiedInputIdentity !== 'function')
    throw Error('VERIFIED_EVENT_PROGRAM_REQUIRED');
  let graph;
  const owners = new WeakMap();
  function origin(node) {
    const where = program.location(node),
      identity = where && program.verifiedInputIdentity(where.sourceFile);
    if (!where?.contentSha256 || !identity || identity.contentSha256 !== where.contentSha256)
      throw Error('EVENT_EFFECT_SOURCE_UNVERIFIED');
    return { ...where, owned: identity.owned };
  }
  function owner(fn) {
    if (!fn?.body) return;
    let row = owners.get(fn);
    if (row) return row;
    const at = origin(fn),
      binding = program.getBinding(fn.name);
    row = {
      ...at,
      name: fn.name.name,
      id: JSON.stringify([at.sourceFile, at.contentSha256, at.start, at.end]),
      symbolId: binding.status === 'BOUND' ? binding.symbolId : null,
      constructorCandidate: triggerConstructorFrame(fn) ?? null,
    };
    owners.set(fn, row);
    return row;
  }
  function effectAt(call, { targetIndex = 0 } = {}) {
    if (
      call?.kind !== K.CallExpression ||
      !Number.isInteger(targetIndex) ||
      targetIndex < 0 ||
      targetIndex >= call.arguments.length
    )
      throw Error('EVENT_CALL_AND_TARGET_REQUIRED');
    const fn = ownerOf(call),
      o = owner(fn);
    if (!o) throw Error('EVENT_FUNCTION_OWNER_REQUIRED');
    const controls = [];
    let child = call;
    for (let p = call.parent; p && p !== fn; child = p, p = p.parent) {
      let kind, branch;
      if (p.kind === K.IfStatement) {
        kind = 'if';
        branch =
          child === p.thenStatement ? 'then' : child === p.elseStatement ? 'else' : 'condition';
      } else if ([K.ForStatement, K.WhileStatement, K.DoStatement].includes(p.kind)) {
        kind = 'loop';
        branch =
          child === p.statement
            ? 'body'
            : child === p.condition
              ? 'condition'
              : child === p.initializer
                ? 'initializer'
                : 'update';
      } else if (p.kind === K.ConditionalExpression) {
        kind = 'conditional';
        branch = child === p.whenTrue ? 'true' : child === p.whenFalse ? 'false' : 'condition';
      } else if (
        p.kind === K.BinaryExpression &&
        [K.AmpersandAmpersandToken, K.BarBarToken].includes(p.operatorToken.kind)
      ) {
        kind = 'short-circuit';
        branch = child === p.right ? 'right' : 'left';
      } else if (p.kind === K.SwitchStatement || p.kind === K.CaseClause) {
        kind = 'switch';
        branch = 'selected-arm';
      }
      if (kind)
        controls.push({
          kind,
          branch,
          ...origin(p),
          condition: p.expression
            ? origin(p.expression)
            : p.condition
              ? origin(p.condition)
              : undefined,
        });
    }
    const argumentsAt = call.arguments.map((n) => {
      let calls = 0;
      visit(n, (x) => {
        if (x.kind === K.CallExpression) calls++;
      });
      return { ...origin(n), nestedCalls: calls, evaluationCountUnchanged: true };
    });
    return {
      kind: 'SOURCE_BOUND_EVENT_EFFECT',
      source: origin(call),
      owner: o,
      target: resolveBoundStorage(program, un(call.arguments[targetIndex])),
      arguments: argumentsAt,
      controls: controls.reverse(),
      multiplicity: controls.some((c) => c.kind === 'loop')
        ? 'DYNAMIC_LOOP_EXECUTIONS'
        : 'AT_MOST_ONCE_PER_OWNER_INVOCATION',
      guardsPreserved: true,
      sourceOrder: call.pos,
      runtimeOrderingProved: false,
      callbackClosureProved: false,
      guiBindingAuthorized: false,
      sourceOrGuiChanged: false,
    };
  }
  function index() {
    if (graph) return graph;
    const functions = new Map(),
      symbols = new Map(),
      reverse = new Map(),
      calls = [],
      unresolved = [];
    for (const ast of program.documents.values()) {
      if (program.verifiedInputIdentity(ast.fileName)?.owned !== true) continue;
      program.attachOriginal(ast);
      for (const fn of ast.statements.filter((n) => n.kind === K.FunctionDeclaration && n.body)) {
        const row = owner(fn);
        functions.set(row.id, { node: fn, row });
        if (row.symbolId) {
          const list = symbols.get(row.symbolId) ?? [];
          list.push(row.id);
          symbols.set(row.symbolId, list);
        }
      }
    }
    for (const [id, { node }] of functions)
      visit(node.body, (n) => {
        if (n.kind !== K.CallExpression) return;
        const callee = un(n.expression),
          binding = callee?.kind === K.Identifier ? program.getBinding(callee) : undefined;
        const candidates = binding?.status === 'BOUND' ? symbols.get(binding.symbolId) : undefined;
        if (candidates?.length === 1) {
          const target = candidates[0],
            edge = { caller: id, callee: target, source: origin(n) };
          calls.push(edge);
          const list = reverse.get(target) ?? [];
          list.push(edge);
          reverse.set(target, list);
        } else if (binding?.status !== 'BOUND' || candidates?.length > 1)
          unresolved.push({
            owner: id,
            source: origin(n),
            reason: candidates?.length > 1 ? 'AMBIGUOUS_SOURCE_BODY' : 'UNRESOLVED_CALL',
          });
      });
    graph = { functions, calls, reverse, unresolved };
    return graph;
  }
  function refusalClosure(primaryCalls) {
    const g = index(),
      primary = new Set(primaryCalls.map((n) => owner(ownerOf(n))?.id));
    if (primary.has(undefined) || [...primary].some((id) => !g.functions.has(id)))
      throw Error('EVENT_REFUSAL_OWNER_NOT_IN_SOURCE_GRAPH');
    const affected = new Set(primary),
      queue = [...primary],
      edges = [];
    for (let at = 0; at < queue.length; at++)
      for (const edge of g.reverse.get(queue[at]) ?? []) {
        edges.push(edge);
        if (!affected.has(edge.caller)) {
          affected.add(edge.caller);
          queue.push(edge.caller);
        }
      }
    return {
      kind: 'SOURCE_EVENT_REFUSAL_DEPENDENCIES',
      primary: [...primary].map((id) => g.functions.get(id).row),
      dependent: [...affected]
        .filter((id) => !primary.has(id))
        .map((id) => g.functions.get(id).row),
      edges,
      unresolvedCalls: g.unresolved.filter((r) => affected.has(r.owner)),
      directCallCoverageOnly: true,
      callbackClosureProved: false,
      guiBindingAuthorized: false,
      sourceOrGuiChanged: false,
      wholeMapAccepted: false,
    };
  }
  return Object.freeze({
    effectAt,
    refusalClosure,
    summary() {
      const g = index();
      return {
        functions: g.functions.size,
        directCalls: g.calls.length,
        unresolvedCalls: g.unresolved.length,
        callbackClosureProved: false,
        persistentCache: false,
        guiBindingAuthorized: false,
      };
    },
  });
}
