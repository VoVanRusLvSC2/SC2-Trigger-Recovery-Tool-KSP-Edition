import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import {
  Parser,
  Printer,
  SyntaxKind as K,
  forEachChild,
} from '../sdk/array-values/modules/galaxy/language-core/index.js';
const printer = new Printer(),
  sha = (s) => createHash('sha256').update(s).digest('hex');
const plain = (f) =>
  f?.kind === K.FunctionDeclaration &&
  f.type.kind === K.VoidKeyword &&
  !f.parameters.length &&
  !f.modifiers?.length;
const direct = (s) =>
  s?.kind === K.ExpressionStatement &&
  s.expression.kind === K.CallExpression &&
  s.expression.expression.kind === K.Identifier &&
  !s.expression.arguments.length
    ? s.expression
    : undefined;
const walk = (n, fn, p) => {
  fn(n, p);
  forEachChild(n, (c) => walk(c, fn, n));
};
/** Additional role aliases under an independently recomputed root permission.
 * Ordered entry slots identify private void() symbols. Bodies remain intact;
 * only the subsequent complete-program oracle may establish equivalence. */
export function deriveRootEntryStageRoleAliases({
  sourceText,
  candidateText,
  permission,
  otherSources = [],
}) {
  const records = [];
  if (
    permission.kind !== 'BOUND_PRIVATE_ROOT_TRIGGER_ALPHA' ||
    permission.flow?.kind !== 'CLOSED_GALAXY_PROTOCOL_NAME_FLOW' ||
    !permission.flow.allUnconstrainedStringInputsRefused ||
    !permission.flow.allUnknownStringInputsRefused ||
    !(
      permission.storage?.kind === 'NO_STANDARD_STORAGE_PATH_CONSUMERS' ||
      (permission.storage?.kind === 'ROOT_STAGE_NAMES_ABSENT_FROM_BOUND_STORAGE_PATHS' &&
        permission.storage.sourceProof?.unknownObserverInput === false &&
        permission.storage.sourceProof.observedNames.length === 0)
    )
  )
    return { records, refused: 'ROOT_STAGE_PRIVATE_NAME_AND_STORAGE_PERMISSION_REQUIRED' };
  const asts = [sourceText, candidateText].map((text, i) =>
    new Parser().parseFile('stage-role-' + i, text),
  );
  assert(
    asts.every((a) => !a.parseDiagnostics.length),
    'ROOT_STAGE_ROLE_SYNTAX',
  );
  const entries = asts.map((a) =>
    a.statements.filter(
      (n) => n.kind === K.FunctionDeclaration && n.name.name === 'InitMap' && n.body,
    ),
  );
  if (entries.some((a) => a.length !== 1 || !plain(a[0]))) return { records };
  const calls = entries.map((a) => a[0].body.statements.map(direct));
  if (calls[0].length !== calls[1].length || calls.some((a) => a.some((n) => !n)))
    return { records };
  const unique = (ast, name) => {
    const nodes = ast.statements.filter((n) => n.name?.name === name);
    return nodes.every(plain) && nodes.filter((n) => n.body).length === 1
      ? nodes.find((n) => n.body)
      : undefined;
  };
  const names = new Set(permission.flow.privateNames),
    external = [],
    seen = new Set();
  for (const f of otherSources) {
    const hash = sha(f.text);
    if (seen.has(hash)) continue;
    seen.add(hash);
    const a = new Parser().parseFile(f.fileName ?? 'stage-external', f.text);
    assert(!a.parseDiagnostics.length, 'ROOT_STAGE_FOREIGN_SOURCE_SYNTAX');
    external.push(a);
  }
  for (let i = 0; i < calls[0].length; i++) {
    const from = calls[0][i].expression.name,
      to = calls[1][i].expression.name;
    if (from === to || !names.has(from) || !names.has(to)) continue;
    const before = unique(asts[0], from),
      after = unique(asts[1], to);
    if (!before || !after || asts[0].statements.some((n) => n.name?.name === to)) continue;
    let safe = true;
    for (const [file, a] of [asts[0], ...external].entries())
      walk(a, (n, p) => {
        if (n.kind !== K.Identifier || n.name !== from) return;
        if (
          p?.kind === K.FunctionDeclaration &&
          p.name === n &&
          plain(p) &&
          (file === 0 || !p.body)
        )
          return;
        if (file === 0 && p?.kind === K.CallExpression && p.expression === n && !p.arguments.length)
          return;
        safe = false;
      });
    if (safe)
      records.push({
        from,
        to,
        entrySlot: i,
        bodySha256: {
          before: sha(printer.printNode(before.body)),
          after: sha(printer.printNode(after.body)),
        },
        bodyEquivalence: 'REQUIRES_COMPLETE_PROGRAM_ORACLE',
        storageObserversAbsent: true,
        sourceOrCandidateChanged: false,
      });
  }
  return {
    kind: 'PRIVATE_TYPED_MAP_ENTRY_STAGE_IDENTITIES',
    records,
    permissionRecomputedByCaller: true,
    wholeProgramOracleStillRequired: true,
  };
}
