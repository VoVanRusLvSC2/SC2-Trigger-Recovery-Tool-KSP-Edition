import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from "../sdk/array-values/modules/galaxy/language-core/index.js";
const sha=s=>createHash('sha256').update(s).digest('hex');
export function indexRootStartupFunctionInterfaces(ast,names){
 const output=new Map();
 for(const name of names){
  const defs=ast.statements.filter(n=>n.name?.name===name),bodies=defs.filter(n=>n.kind===K.FunctionDeclaration&&n.body);
  if(bodies.length!==1||!defs.every(n=>n.kind===K.FunctionDeclaration&&n.type.kind===K.VoidKeyword&&!n.parameters.length&&!n.modifiers?.length))continue;
  let shadow=false;function walk(n){if([K.ParameterDeclaration,K.VariableDeclaration].includes(n.kind)&&n.name?.name===name)shadow=true;forEachChild(n,walk);}for(const n of ast.statements)if(n.kind===K.FunctionDeclaration&&n.body)walk(n);
  if(!shadow)output.set(name,Object.freeze({name,status:'UNIQUE_ROOT_VOID_ZERO_ABI',group:'root',sourceStatementCount:bodies[0].body.statements.length,sourceSha256:sha(ast.text),declarationSha256:sha(ast.text.slice(bodies[0].pos,bodies[0].end))}));
 }
 return output;
}
// Do not substitute a declaration-only Native or a template for the source body.
// The whole-program oracle must still prove the emitted ordinary GUI body.
export function requireRootStartupGuiFunction(library,source){
 const defs=Object.values(library.elements??{}).filter(d=>d.type==='FunctionDef'&&(d.library??library.id)===library.id&&!d.disabled&&d.name===source.name&&d.flags?.includes('NoScriptPrefix')&&!d.flags.some(f=>['Native','Operator','Event','Template'].includes(f))&&!d.parameters?.length&&(d.returnType?.type??'void')==='void'&&!d.scriptCode?.trim()&&!d.expressionCode?.trim()&&(!source.sourceStatementCount||d.actions?.length||d.localVariables?.length));
 assert(defs.length===1,'SOURCE_MAP_ROOT_STARTUP_GUI_BODY_REQUIRED:'+source.name);
 return {...source,guiReference:{library:library.id,type:'FunctionDef',id:defs[0].id},completeNativeBodyAndOracleStillRequired:true};
}