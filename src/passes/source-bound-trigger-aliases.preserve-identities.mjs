import { proveBoundedByteLiteralAliasAbsence } from '../libraries/gui/bounded-byte-literal-alias-absence.mjs';
import { decodeBoundAsciiString } from '../utilities';
/** In-memory lexical canonicalization of explicitly declared trigger bindings.
 * Preserve every body/operator/literal except the exact registered callback
 * name and its bound identifiers. Existing converter validators still decide
 * whether each constructor and callback is generated trigger scaffolding.
 */
const skip = new Set(['parent', 'symbol', 'locals', 'flowNode', 'syntaxTokens']);
function walk(n, fn, parent, key, scope) {
  if (!n || typeof n !== 'object') return;
  if (n.kind === 142) scope = n;
  fn(n, parent, key, scope);
  for (const [k, v] of Object.entries(n)) {
    if (skip.has(k)) continue;
    if (Array.isArray(v)) v.forEach((x) => walk(x, fn, n, k, scope));
    else if (v && typeof v === 'object') walk(v, fn, n, k, scope);
  }
}
export function canonicalizeSourceBoundTriggerAliases({
  text,
  parse,
  typeName,
  otherSources = [],
  document,
  preserveSourceIdentities = false,
}) {
  const source = document ? document.input(text) : parse(text, 'trigger-alias-source.galaxy');
  if (source.parseDiagnostics.length) throw Error('Trigger alias source syntax errors');
  // Source-preserving conversion keeps public names and registration strings.
  // Final bound GUI roles decide representation; this pass grants no alias rights.
  if (preserveSourceIdentities)
    return {
      text,
      proof: {
        bindings: [],
        edits: 0,
        otherSourcesChecked: 0,
        foreignByteLiteralAbsence: [],
        sourceArchiveChanged: false,
        nativeAcceptance: false,
        identityPolicy: 'PRESERVE_ORIGINAL_SOURCE_IDENTITIES',
        finalGuiQualificationRequired: true,
      },
    };

  const definitions = source.statements.filter((n) => n.kind === 142 && n.body),
    defs = new Map(definitions.map((n) => [n.name.name, n]));
  if (defs.size !== definitions.length) throw Error('Duplicate source function definitions');
  const handles = new Set(
    source.statements
      .filter((n) => n.kind === 141 && typeName(n.type) === 'trigger')
      .map((n) => n.name.name),
  );
  const aliases = new Map(),
    parameterMaps = new Map(),
    registrations = new Set(),
    proof = [],
    foreignByteLiteralAbsence = [];
  for (const fn of definitions) {
    if (typeName(fn.type) !== 'void' || fn.parameters.length) continue;
    const first = fn.body.statements[0],
      assignment = first?.kind === 138 ? first.expression : undefined,
      call = assignment?.right;
    if (
      assignment?.kind !== 124 ||
      assignment.operatorToken?.kind !== 39 ||
      assignment.left?.kind !== 113 ||
      !handles.has(assignment.left.name) ||
      call?.kind !== 121 ||
      call.expression?.name !== 'TriggerCreate' ||
      call.arguments.length !== 1 ||
      call.arguments[0].kind !== 3
    )
      continue;
    const literal = call.arguments[0],
      callbackName = decodeBoundAsciiString(literal, text),
      callback = defs.get(callbackName),
      handle = assignment.left.name;
    if (
      !callback ||
      typeName(callback.type) !== 'bool' ||
      callback.parameters.length !== 2 ||
      callback.parameters.some((p) => typeName(p.type) !== 'bool')
    )
      continue;
    const from = fn.name.name;
    const targetHandle =
      handle.startsWith('gt_') || /^lib[A-Za-z0-9]+_gt_/u.test(handle) ? handle : 'gt_' + handle;
    const constructor = targetHandle + '_Init',
      targetCallback = targetHandle + '_Func';
    if (handle !== targetHandle) {
      if (source.statements.some((n) => n.name?.name === targetHandle))
        throw Error('Handle alias target collision');
      if (aliases.has(handle) && aliases.get(handle) !== targetHandle)
        throw Error('Ambiguous handle binding');
      aliases.set(handle, targetHandle);
    }
    for (const [old, target] of [
      [from, constructor],
      [callbackName, targetCallback],
    ]) {
      if (old === target) continue;
      if (aliases.has(old) && aliases.get(old) !== target)
        throw Error('Ambiguous function binding');
      if (source.statements.some((n) => n.name?.name === target))
        throw Error('Function alias target collision');
      aliases.set(old, target);
    }
    const names = callback.parameters.map((p) => p.name.name),
      targets = ['testConds', 'runActions'];
    if (new Set(names).size !== 2) throw Error('Duplicate callback parameters');
    const locals = [];
    walk(callback.body, (n) => {
      if (n.kind === 141) locals.push(n.name.name);
    });
    if (
      new Set(locals).size !== locals.length ||
      locals.some((n) => names.includes(n) || targets.includes(n))
    )
      throw Error('Callback local shadow/collision');
    const map = new Map(names.map((name, i) => [name, targets[i]]).filter(([a, b]) => a !== b));
    if (names.map((n) => map.get(n) ?? n).some((n, i, a) => a.indexOf(n) !== i))
      throw Error('Callback parameter target collision');
    // A new local name must not capture a formerly global/function reference.
    walk(callback.body, (n, p, k) => {
      if (
        n.kind === 113 &&
        !(k === 'name' && [120, 140, 144].includes(p?.kind)) &&
        [...map.values()].includes(n.name) &&
        !names.includes(n.name)
      )
        throw Error('Callback parameter would capture an existing reference');
    });
    parameterMaps.set(callback, map);
    registrations.add(literal);
    proof.push({
      handle,
      targetHandle,
      constructor: { from, to: constructor },
      callback: { from: callbackName, to: targetCallback },
      parameters: [...map].map(([from, to]) => ({ from, to })),
    });
  }
  if (new Set(aliases.values()).size !== aliases.size)
    throw Error('Function alias targets are ambiguous');
  const mentions = (s, name) =>
    new RegExp('(?:^|[^A-Za-z0-9_])' + name + '(?:$|[^A-Za-z0-9_])', 'u').test(s);
  for (const foreign of otherSources) {
    const ast = parse(foreign.text, foreign.name);
    if (ast.parseDiagnostics.length) throw Error('Foreign source syntax errors');
    walk(ast, (n) => {
      const decoded = n.kind === 3 ? decodeBoundAsciiString(n, foreign.text) : undefined;
      if (n.kind === 3 && decoded === undefined && aliases.size) {
        const absence = proveBoundedByteLiteralAliasAbsence(n, foreign.text, [...aliases.keys()]);
        if (!absence) throw Error('Unproved foreign string escape semantics');
        foreignByteLiteralAbsence.push({ source: foreign.name, ...absence });
      }
      for (const name of aliases.keys())
        if (
          (n.kind === 113 && n.name === name) ||
          (n.kind === 3 && mentions(String(decoded ?? n.value ?? n.text), name))
        )
          throw Error('Foreign reference to renamed callback/constructor');
    });
  }
  const edits = new Map();
  function edit(n, from, to, string = false) {
    const raw = text.slice(n.pos, n.end),
      token = string ? JSON.stringify(from) : from;
    if (string) {
      if (decodeBoundAsciiString(n, text) !== from)
        throw Error('Unsupported bound string token at ' + n.pos);
    } else if (raw.trim() !== token) throw Error('Unsupported alias token/trivia at ' + n.pos);
    const exactToken = string ? raw.trim() : token;
    const start = n.pos + raw.indexOf(exactToken),
      end = start + exactToken.length,
      value = string ? JSON.stringify(to) : to,
      key = start + ':' + end;
    if (edits.has(key) && edits.get(key).value !== value) throw Error('Overlapping alias edit');
    edits.set(key, { start, end, value });
  }
  walk(source, (n, p, k, scope) => {
    const params = parameterMaps.get(scope);
    if (n.kind === 3) {
      const decoded = decodeBoundAsciiString(n, text);
      if (decoded === undefined && aliases.size)
        throw Error('Unproved escape semantics in string can conceal a dynamic alias reference');
      const value = String(decoded ?? n.value ?? n.text);
      for (const name of aliases.keys())
        if (mentions(value, name) && !registrations.has(n))
          throw Error('Dynamic callback/constructor string');
      if (params)
        for (const name of params.keys())
          if (mentions(value, name)) throw Error('Dynamic callback parameter string');
      if (registrations.has(n) && aliases.has(value)) edit(n, value, aliases.get(value), true);
    }
    if (n.kind !== 113 || (k === 'name' && [120, 140, 144].includes(p?.kind))) return;
    if (aliases.has(n.name)) {
      const ownHandleDeclaration =
        p?.kind === 141 && k === 'name' && source.statements.includes(p) && handles.has(n.name);
      if (
        !ownHandleDeclaration &&
        (p?.kind === 141 ||
          p?.kind === 143 ||
          scope?.parameters.some((x) => x.name.name === n.name))
      )
        throw Error('Alias name shadowed by variable');
      edit(n, n.name, aliases.get(n.name));
    }
    if (params?.has(n.name)) {
      if (k === 'type' || (p?.kind === 142 && k === 'name'))
        throw Error('Callback parameter namespace ambiguity');
      edit(n, n.name, params.get(n.name));
    }
  });
  let out = text;
  const ordered = [...edits.values()].sort((a, b) => b.start - a.start);
  let boundary = text.length;
  for (const e of ordered) {
    if (e.end > boundary) throw Error('Alias edits overlap');
    out = out.slice(0, e.start) + e.value + out.slice(e.end);
    boundary = e.start;
  }
  const after = document ? document.output(out) : parse(out, 'trigger-alias-result.galaxy');
  if (after.parseDiagnostics.length) throw Error('Canonicalized source syntax error');
  return {
    text: out,
    proof: {
      bindings: proof,
      edits: edits.size,
      otherSourcesChecked: otherSources.length,
      foreignByteLiteralAbsence,
      sourceArchiveChanged: false,
      nativeAcceptance: false,
    },
  };
}
