import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

/** Classify the value of this expression, not every call beneath an effect.
 * A for header discards its initializer/update values, but its condition and
 * nested operands still supply values. Parentheses do not change that role. */
export function galaxyExpressionUse(node){
 while(node.parent?.kind===K.ParenthesizedExpression&&node.parent.expression===node)node=node.parent;
 const parent=node.parent;
 return parent?.kind===K.ExpressionStatement&&parent.expression===node||
  parent?.kind===K.ForStatement&&(parent.initializer===node||parent.incrementor===node)?'action':'value';
}
