// Bind a plain counted loop to the installed GUI range template. Only literal
// int bounds/steps are admitted: capturing a mutable bound would change timing.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {extractAutoVarName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v254_constant_storage_extents_2026-10-20/graph/d14d4b948618471b-g2t-core.mjs';
import {forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const trace=new AsyncLocalStorage(),sha=s=>createHash('sha256').update(s).digest('hex');
export const withLiteralCountedLoopBindings=(records,operation)=>trace.run(records,operation);
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function integer(node){
 node=unwrap(node);let sign=1;
 if(node?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(node.operator?.kind)){sign=node.operator.kind===K.MinusToken?-1:1;node=unwrap(node.operand);}
 if(node?.kind!==K.NumericLiteral||! /^(?:0[xX][\da-fA-F]+|\d+)$/u.test(node.text))return;
 const value=sign*Number(node.text);return Number.isInteger(value)&&value>=-2147483648&&value<=2147483647?value:undefined;
}
function installedRangeTemplate(ctx){
 const library=ctx.nativeLibrary,fd=ctx.funcNameToFuncDef?.get('ForEachInteger');
 if(!library||!fd||fd.disabled||fd.library!==library.id||library.elementsByType?.FunctionDef?.[fd.id]!==fd||!fd.flags?.includes('Action')||!fd.flags.includes('SubFunctions')||fd.parameters?.length!==4||fd.subFunctionTypes?.length!==1)return;
 const params=fd.parameters.map(r=>(r.library??library.id)===library.id&&library.elementsByType.ParamDef?.[r.id]);
 if(params.some(p=>!p)||params[0].paramType?.type!=='anyvariable'||params[0].paramType.variableType!=='int'||params.slice(1).some(p=>p.paramType?.type!=='int'||p.isReference||p.isMultiple))return;
 const roleRef=fd.subFunctionTypes[0],role=(roleRef.library??library.id)===library.id&&library.elementsByType.SubFuncType?.[roleRef.id];
 if(!role?.isAction||role.isEvent)return;
 const names=params.map(p=>p.name??p.identifier),body=role.name??role.identifier;
 if([...names,body].some(n=>! /^[A-Za-z_]\w*$/u.test(n)))return;
 // Validate the actual macro program, not its display name alone. This is the
 // supported algorithm's contract; a changed/shadowed template is left alone.
 const [variable,start,end,step]=names;
 const code=`#INITAUTOVAR(ae,${end}) #INITAUTOVAR(ai,${step}) #PARAM(${variable}) = #PARAM(${start}); for (; ((#AUTOVAR(ai) >= 0 && #PARAM(${variable}) <= #AUTOVAR(ae)) || (#AUTOVAR(ai) < 0 && #PARAM(${variable}) >= #AUTOVAR(ae))); #PARAM(${variable}) += #AUTOVAR(ai)) { #SUBFUNCS(${body}) }`;
 if(typeof fd.scriptCode!=='string'||fd.scriptCode.replace(/\s/gu,'')!==code.replace(/\s/gu,''))return;
 return fd;
}
export function matchLiteralCountedLoop(node,ctx){
 if(node?.kind!==K.ForStatement)return;
 const init=unwrap(node.initializer),condition=unwrap(node.condition),increment=unwrap(node.incrementor);
 if(init?.kind!==K.BinaryExpression||init.operatorToken?.kind!==K.EqualsToken||init.left?.kind!==K.Identifier||condition?.kind!==K.BinaryExpression||increment?.kind!==K.BinaryExpression||increment.operatorToken?.kind!==K.PlusEqualsToken)return;
 const name=init.left.name;
 if(extractAutoVarName(name))return; // Existing Picked Integer/template counters keep their original GUI role.
 let declaration=false;function visit(n){if(!n)return;if(n.kind===K.VariableDeclaration)declaration=true;forEachChild(n,visit);}visit(node.statement);if(declaration)return;
 if(unwrap(condition.left)?.kind!==K.Identifier||unwrap(condition.left).name!==name||unwrap(increment.left)?.kind!==K.Identifier||unwrap(increment.left).name!==name)return;
 const start=integer(init.right),end=integer(condition.right),step=integer(increment.right);
 if(start===undefined||end===undefined||step===undefined||step===0||condition.operatorToken?.kind!==(step>0?K.LessThanEqualsToken:K.GreaterThanEqualsToken))return;
 const id=ctx.localVarByGalaxyName?.get(name),variable=id&&ctx.elements[id];
 if(variable?.type!=='Variable'||variable.variableType?.type!=='int'||variable.variableType.typeElement||variable.isArray||variable.arraySizes?.length||variable.isConstant)return;
 const template=installedRangeTemplate(ctx);if(!template)return;
 return {iterator:init.left,start:init.right,end:condition.right,increment:increment.right,template,values:{start,end,step},variableId:id};
}
export function tryBuildLiteralCountedLoop(node,role,ctx,build){
 const match=matchLiteralCountedLoop(node,ctx);if(!match)return;
 const ref=build(node,match.iterator,match.start,match.end,match.increment,role,ctx,'int');
 if(ref)trace.getStore()?.push({kind:'LITERAL_COUNTED_LOOP_TO_INSTALLED_GUI_RANGE',library:ctx.libId,variableId:match.variableId,templateLibrary:match.template.library,templateId:match.template.id,templateSha256:sha(match.template.scriptCode),...match.values,counterAndBodyRetained:true,literalCaptureOnly:true,sourceAstChanged:false,newNative:false});
 return ref;
}
