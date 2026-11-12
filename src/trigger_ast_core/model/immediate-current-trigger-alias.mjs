import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {declaredCarrier} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/galaxy-program-context.js';
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const owner=n=>{while(n&&n.kind!==K.FunctionDeclaration)n=n.parent;return n;};

/** This proves one adjacent, scalar local copy, not arbitrary data flow.
 * No call, branch, parameter/global alias or later write may intervene. The
 * enclosing callback context and stock event binding are separate obligations. */
export function immediateCurrentTriggerAlias(program,call,{containingTriggerBody=false}={}){
 if(!containingTriggerBody||call?.kind!==K.CallExpression)return;
 const target=un(call.arguments[0]);if(target?.kind!==K.Identifier)return;
 const binding=program.getBinding(target),declaration=program.declarationAt(target),fn=owner(call);
 if(binding.status!=='BOUND'||binding.carrier!=='trigger'||declaration?.kind!==K.VariableDeclaration||
    !fn?.body||declaration.parent?.kind===K.SourceFile||declaredCarrier(declaration.type)!=='trigger')return;
 const where=program.location(declaration),at=program.location(call);
 if(!where?.contentSha256||where.sourceFile!==at?.sourceFile||where.owner!==at.owner)return;
 if(program.verifiedInputIdentity(where.sourceFile)?.owned!==true)return;
 const statement=call.parent;
 if(statement?.kind!==K.ExpressionStatement||statement.expression!==call||statement.parent!==fn.body)return;
 const statements=fn.body.statements;let index=statements.indexOf(statement)-1;
 // Uninitialized declarations have no executable initializer to intervene.
 while(index>=0&&statements[index].kind===K.VariableDeclaration&&!statements[index].initializer)index--;
 const preceding=statements[index];let getter,left;
 if(preceding?.kind===K.VariableDeclaration){left=preceding.name;getter=preceding.initializer;}
 else if(preceding?.kind===K.ExpressionStatement){
  const assignment=preceding.expression;
  if(assignment?.kind!==K.BinaryExpression||assignment.operatorToken.kind!==K.EqualsToken)return;
  left=un(assignment.left);getter=assignment.right;
 }
 if(left?.kind!==K.Identifier||program.getBinding(left).symbolId!==binding.symbolId)return;
 getter=un(getter);const name=un(getter?.expression);
 if(getter?.kind!==K.CallExpression||getter.arguments.length||name?.kind!==K.Identifier||name.name!=='TriggerGetCurrent')return;
 const native=program.declarationAt(name),nativeBinding=program.getBinding(name);
 if(nativeBinding.status!=='BOUND'||native?.kind!==K.FunctionDeclaration||native.body||native.parameters.length||
    declaredCarrier(native.type)!=='trigger'||!native.modifiers?.some(m=>m.kind===K.NativeKeyword))return;
 let source=native;while(source.parent)source=source.parent;
 const identity=program.verifiedInputIdentity(source.fileName);
 if(identity?.owned!==false||!identity.contentSha256)return;
 return {kind:'ADJACENT_BOUND_LOCAL_CURRENT_TRIGGER_COPY',source:at,assignment:program.location(preceding),
  local:{symbolId:binding.symbolId,...where},getter:program.location(getter),
  nativeDeclaration:{sourceFile:source.fileName,contentSha256:identity.contentSha256},
  callbackContextRequired:true,stockEventBindingStillRequired:true,sourceOrGuiChanged:false,
  newNative:0,newCustomScript:0,newRuntimeFunctions:0};
}
