// A named, explicit engine value-operation contract, not a purity guess from
// an API name pattern or return type. Every actual declaration must match it.
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
export function proveNativeStringLengthReadOnlyCall(node,sourceAsts){
  if(node.kind!==K.CallExpression||node.expression?.kind!==K.Identifier||node.expression.name!=='StringLength'||node.arguments.length!==1)return;
  const declarations=sourceAsts.flatMap(ast=>ast.statements.filter(n=>n.name?.name==='StringLength'));
  if(!declarations.length||!declarations.every(n=>n.kind===K.FunctionDeclaration&&!n.body&&n.modifiers?.length===1&&n.modifiers[0].kind===K.NativeKeyword&&getTypeName(n.type)==='int'&&n.parameters.length===1&&n.parameters[0].type.kind!==K.ArrayType&&getTypeName(n.parameters[0].type)==='string'&&!n.parameters[0].isReference))return;
  return {name:'StringLength',returnType:'int',parameterTypes:['string'],matchingNativeDeclarations:declarations.length,
    contract:'The existing engine string-length operation reads one immutable string and does not write script globals or invoke a callback.',
    argumentEffectsAndGlobalReadsStillRequireIndependentAudit:true,newNativeDefinition:false};
}
