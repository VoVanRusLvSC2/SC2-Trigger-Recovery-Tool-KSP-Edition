import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { SyntaxKind as K } from './index-alternate-3.js';
const sha = (text) => createHash('sha256').update(text).digest('hex');
const voidZero = (node) =>
  node?.kind === K.FunctionDeclaration &&
  node.type?.kind === K.VoidKeyword &&
  node.parameters.length === 0 &&
  !node.modifiers?.some((m) => [K.StaticKeyword, K.NativeKeyword].includes(m.kind));
const functionEnd = (node, text) => {
  const close = node.body?.syntaxTokens?.filter((t) => t.kind === K.CloseBraceToken).at(-1),
    end = close && close.pos + 1;
  assert(end && end <= node.end && text[end - 1] === '}', 'AUTHORED_PHASE_FUNCTION_TOKEN_BOUNDARY');
  return end;
};
const declarationKey = (d) => JSON.stringify([d.kind, d.start, d.end, d.name, d.sha256]);

// Exact source evidence only. Index once per invocation; no persistent cache,
// inferred API aliases, GUI permission, or change to the accepted language.
export function indexAuthoredInitializerSchedule({ ast, text, index }) {
  assert.equal(sha(text), index.sourceSha256, 'AUTHORED_PHASE_SOURCE_SHA_CHANGED');
  assert.equal(ast.text, text, 'AUTHORED_PHASE_AST_SOURCE_CHANGED');
  const symbols = new Map(),
    owners = new Map(),
    targets = new Map(),
    phases = [],
    seen = new Set();
  for (const node of ast.statements)
    if (node.name?.name) {
      const rows = symbols.get(node.name.name) ?? [];
      rows.push(node);
      symbols.set(node.name.name, rows);
    }
  for (const section of index.sections)
    for (const d of section.declarations) {
      const key = declarationKey(d),
        rows = owners.get(key) ?? [];
      rows.push(section);
      owners.set(key, rows);
    }
  const targetFor = (name) => {
    if (targets.has(name)) return targets.get(name);
    const rows = symbols.get(name) ?? [],
      bodies = rows.filter((n) => n.kind === K.FunctionDeclaration && n.body),
      node = bodies[0];
    let result = { reason: 'PHASE_TARGET_NOT_UNIQUE_VOID_ZERO' };
    if (bodies.length === 1 && rows.every(voidZero)) {
      const end = functionEnd(node, text),
        digest = sha(text.slice(node.pos, end));
      const sections =
        owners.get(
          declarationKey({
            kind: K.FunctionDeclaration,
            start: node.pos,
            end,
            name,
            sha256: digest,
          }),
        ) ?? [];
      result =
        sections.length === 1
          ? { node, end, digest, section: sections[0] }
          : { reason: 'PHASE_TARGET_SECTION_OWNERSHIP_UNPROVED' };
    }
    targets.set(name, result);
    return result;
  };
  for (const section of index.sections) {
    const anchor = section.initializer,
      key = JSON.stringify([section.library, anchor.name, anchor.position]);
    if (seen.has(key)) continue;
    seen.add(key);
    const candidates = (symbols.get(anchor.name) ?? []).filter(
        (n) => n.kind === K.FunctionDeclaration && n.body,
      ),
      node = candidates[0],
      issues = [],
      calls = [];
    if (candidates.length !== 1 || !voidZero(node) || node.pos !== anchor.position) {
      phases.push({
        library: section.library,
        name: anchor.name,
        status: 'UNPROVED',
        issues: [{ reason: 'PHASE_ANCHOR_NOT_UNIQUE_VOID_ZERO' }],
      });
      continue;
    }
    for (const [ordinal, statement] of node.body.statements.entries()) {
      const call = statement.kind === K.ExpressionStatement ? statement.expression : undefined;
      if (
        call?.kind !== K.CallExpression ||
        call.expression.kind !== K.Identifier ||
        call.arguments.length
      ) {
        issues.push({ ordinal, reason: 'PHASE_DIRECT_ZERO_ARGUMENT_CALL_REQUIRED' });
        continue;
      }
      const name = call.expression.name,
        target = targetFor(name);
      if (target.reason) {
        issues.push({ ordinal, name, reason: target.reason });
        continue;
      }
      if (target.section.library !== section.library) {
        issues.push({ ordinal, name, reason: 'PHASE_TARGET_SECTION_OWNERSHIP_UNPROVED' });
        continue;
      }
      calls.push({
        ordinal,
        name,
        callStart: statement.pos,
        callEnd: statement.end,
        callSha256: sha(text.slice(statement.pos, statement.end)),
        targetStart: target.node.pos,
        targetEnd: target.end,
        targetSha256: target.digest,
        sectionSha256: target.section.sha256,
        sectionLabel: target.section.label,
        library: section.library,
      });
    }
    const end = functionEnd(node, text);
    phases.push({
      library: section.library,
      name: anchor.name,
      start: node.pos,
      end,
      sha256: sha(text.slice(node.pos, end)),
      status: issues.length ? 'UNPROVED' : 'EXACT_SOURCE_CALL_SCHEDULE',
      calls,
      issues,
      requiresExactGuiEmissionOrder: true,
    });
  }
  return {
    kind: 'ORIGINAL_AUTHORED_INITIALIZER_SCHEDULE',
    sourceSha256: index.sourceSha256,
    phases,
    originalCodeChanged: false,
    guiEmissionAuthorized: false,
    sourceComponentClosureProved: false,
    semanticEquivalenceProved: false,
    wholeMapAccepted: false,
  };
}
