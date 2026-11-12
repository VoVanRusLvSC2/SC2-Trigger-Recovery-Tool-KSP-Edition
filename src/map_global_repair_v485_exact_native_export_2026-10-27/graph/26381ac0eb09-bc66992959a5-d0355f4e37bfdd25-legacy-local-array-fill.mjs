/** Recognize only a complete legacy one-dimensional local array fill.
 * Equal iteration count, element write and per-iteration value evaluation are
 * required. Partial fills and authored counter effects remain raw actions.
 */
import {SyntaxKind as K, forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d4f4db2b829c-index.js';
import {getTypeName, unwrapArrayType, unwrapParens} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/bce993139bd2-6ec0feb66281-46bd418ac3313d57-g2t-core.mjs';
export function legacyLocalArrayFill(set, loop, declarations) {
 const expr = n => n?.kind === K.ExpressionStatement ? unwrapParens(n.expression) : undefined;
 const first = expr(set), counter = first?.left?.kind === K.Identifier ? first.left.name : undefined;
 const number = n => unwrapParens(n)?.kind === K.NumericLiteral ? Number(unwrapParens(n).value) : NaN;
 const local = declarations.find(n => n.name.name === counter);
 if (!counter || first?.kind !== K.BinaryExpression || first.operatorToken?.kind !== K.EqualsToken || number(first.right) !== 0 ||
     !local || getTypeName(local.type) !== 'int' || local.initializer || loop?.kind !== K.WhileStatement) return undefined;
 const cond = unwrapParens(loop.condition ?? loop.expression);
 if (cond?.kind !== K.BinaryExpression || cond.left?.name !== counter ||
     ![K.LessThanToken,K.LessThanEqualsToken].includes(cond.operatorToken?.kind)) return undefined;
 const count = number(cond.right) + (cond.operatorToken.kind === K.LessThanEqualsToken ? 1 : 0);
 if (!Number.isSafeInteger(count) || count < 1) return undefined;
 const body = loop.statement?.kind === K.Block ? [...loop.statement.statements] : [loop.statement];
 if (body.length !== 2) return undefined;
 const write = expr(body[0]), step = expr(body[1]), sum = unwrapParens(step?.right), target = unwrapParens(write?.left);
 if (write?.kind !== K.BinaryExpression || write.operatorToken?.kind !== K.EqualsToken || target?.kind !== K.ElementAccessExpression ||
     target.expression?.kind !== K.Identifier || unwrapParens(target.argumentExpression)?.name !== counter ||
     step?.kind !== K.BinaryExpression || step.operatorToken?.kind !== K.EqualsToken || step.left?.name !== counter ||
     sum?.kind !== K.BinaryExpression || sum.operatorToken?.kind !== K.PlusToken || sum.left?.name !== counter || number(sum.right) !== 1) return undefined;
 const name = target.expression.name, array = declarations.find(n => n.name.name === name);
 const sizes = array ? unwrapArrayType(array.type).sizes : [];
 if (sizes.length !== 1 || number(sizes[0]) !== count) return undefined;
 let readsCounter = false;
 function visit(n) { if (!n) return; if (n.kind === K.Identifier && n.name === counter) readsCounter = true; forEachChild(n,visit); }
 visit(write.right);
 if (readsCounter) return undefined;
 return {name,expression:write.right,counters:[counter]};
}
