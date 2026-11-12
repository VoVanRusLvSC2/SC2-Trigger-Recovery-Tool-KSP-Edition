import {SyntaxKind as K, forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const loops = new Set([K.ForStatement, K.WhileStatement, K.DoStatement]);
function nodes(root) {
  const result = [], pending = [root];
  while (pending.length) {const node = pending.pop();result.push(node);forEachChild(node, child => {pending.push(child);});}
  return result;
}

// A private string/text cell can use Set Variable + text concatenation. The address is
// effect-free and the RHS cannot change that cell. By-reference/unknown callers
// that could reach this write again veto the lowering; by-value consumers do not.
export function planBoundConcatAssignment(program, statement) {
  const expression = statement?.kind === K.ExpressionStatement && statement.expression;
  if (expression?.kind !== K.BinaryExpression || expression.operatorToken?.kind !== K.PlusEqualsToken || expression.left?.kind !== K.Identifier) return;
  const binding = program.getBinding(expression.left), declaration = program.declarationAt(expression.left), where = declaration && program.location(declaration);
  if (binding.status !== 'BOUND' || declaration?.kind !== K.VariableDeclaration || ![K.TextKeyword, K.StringKeyword].includes(declaration.type?.kind) || declaration.modifiers?.length || declaration.isReference || !where) return;
  const ast = program.documents.get(where.sourceFile), definitions = ast?.statements.filter(node => node.kind === K.FunctionDeclaration && node.body && node.name.name === where.owner);
  if (!where.owner || definitions?.length !== 1) return;
  const fn = definitions[0], body = nodes(fn.body), local = body.filter(node => node.kind === K.VariableDeclaration && node.name.name === declaration.name.name);
  if (local.length !== 1 || local[0] !== declaration || fn.parameters.some(p => p.name.name === declaration.name.name)) return;
  const refers = node => nodes(node).some(child => child.kind === K.Identifier &&
    (program.declarationAt(child) === declaration || child.name === declaration.name.name));
  if (refers(expression.right)) return;
  const enclosingLoops = body.filter(node => loops.has(node.kind) && node.pos <= statement.pos && statement.end <= node.end);
  const valueConsumers = [];
  for (const call of body.filter(node => node.kind === K.CallExpression)) {
    const indexes = call.arguments.flatMap((argument, index) => refers(argument) ? [index] : []);if (!indexes.length) continue;
    const target = program.declarationAt(call.expression), resolved = program.getBinding(call.expression).status === 'BOUND' &&
      target?.kind === K.FunctionDeclaration && target.parameters.length === call.arguments.length;
    const byValue = resolved && indexes.every(index => target.parameters[index].type?.kind === declaration.type.kind && !target.parameters[index].isReference);
    if (!byValue && (call.pos < statement.end || enclosingLoops.some(loop => loop.pos <= call.pos && call.end <= loop.end))) return;
    valueConsumers.push({start: call.pos, end: call.end, byValue, noBackedgeToThisWrite: !byValue});
  }
  // Primitive text has no address-taking operation. Refuse explicit attempts
  // rather than relying on an invalid source program being rejected elsewhere.
  if (body.some(node => node.kind === K.PrefixUnaryExpression && node.operator?.kind === K.AmpersandToken && refers(node.operand))) return;
  const add = {...expression, operatorToken: {...expression.operatorToken, kind: K.PlusToken}, left: expression.left, right: {kind: K.ParenthesizedExpression, expression: expression.right}};
  const assign = {...expression, operatorToken: {...expression.operatorToken, kind: K.EqualsToken}, left: expression.left, right: add};
  return {node: {...statement, expression: assign}, proof: {kind: 'PRIVATE_FRAME_CONCAT_APPEND_TO_ASSIGNMENT', source: where,
    function: fn.name.name, declarationPosition: declaration.pos, target: declaration.name.name, symbolId: binding.symbolId,
    start: statement.pos, end: statement.end, targetAddressEffectFree: true, rhsIndependentOfTargetCell: true,
    valueConsumers, localCellReadsBefore: 1, localCellReadsAfter: 1, localCellWritesBefore: 1, localCellWritesAfter: 1,
    newNative: 0, newRuntimeFunctions: 0, newCustomScript: 0, wholeProgramEquivalent: false}};
}
