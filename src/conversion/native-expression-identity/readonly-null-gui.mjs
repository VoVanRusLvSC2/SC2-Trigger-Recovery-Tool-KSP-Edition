// Keep proved read-only null handles as typed GUI constants. No source rewriting.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from "../exact-function-signatures/index-alternate-3.js";
import {getTypeName} from "./g2t-core.generated-call-provenance.mjs";
import {retainInlineCustomGlobals as originalRetain} from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/inline-custom-globals.js";
const context=new AsyncLocalStorage(),sha=t=>createHash('sha256').update(t).digest('hex');
function walk(n,f){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(x=>walk(x,f));return;}f(n);for(const[k,v]of Object.entries(n))if(k!=='parent')walk(v,f);}
export function proveReadonlyNullGlobals(source,externalTexts=[]){
 const ast=new Parser().parseFile('readonly-null.galaxy',source);assert.equal(ast.parseDiagnostics.length,0);
 const globals=ast.statements.filter(n=>n.kind===K.VariableDeclaration),records=[];
 for(const n of globals){
  const name=n.name.name,type=getTypeName(n.type);
  if(!['unit','camerainfo'].includes(type)||n.type.kind===K.ArrayType||n.initializer?.kind!==K.NullKeyword||!(n.modifiers??[]).some(m=>m.kind===K.ConstKeyword))continue;
  if(globals.filter(x=>x.name.name===name).length!==1)continue;
  let refused=false;
  walk(ast,x=>{
   if(x!==n&&[K.VariableDeclaration,K.ParameterDeclaration,K.FunctionDeclaration].includes(x.kind)&&x.name?.name===name)refused=true;
   if(x.kind===K.BinaryExpression&&x.left?.kind===K.Identifier&&x.left.name===name&&[K.EqualsToken,K.PlusEqualsToken,K.MinusEqualsToken,K.AsteriskEqualsToken,K.SlashEqualsToken,K.PercentEqualsToken,K.LessThanLessThanEqualsToken,K.GreaterThanGreaterThanEqualsToken,K.AmpersandEqualsToken,K.BarEqualsToken,K.CaretEqualsToken].includes(x.operatorToken?.kind))refused=true;
   if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(x.kind)&&x.operand?.kind===K.Identifier&&x.operand.name===name)refused=true;
  });
  // Conservative guard against ownership collisions and foreign writes. The
  // actual declaration inputs are SHA-verified by the calling worker.
  if(externalTexts.some(t=>t.includes(name)))refused=true;
  if(!refused)records.push({name,type,sourceConst:true,initializer:'null',noSourceWrites:true,noLocalShadow:true,noForeignNameOccurrence:true,guiConstantMarkerRetained:true,runtimeValueAlwaysNull:true,sourceRewritten:false});
 }
 return {sourceSha256:sha(source),externalInputs:externalTexts.map(t=>({sha256:sha(t),bytes:Buffer.byteLength(t)})),records,scope:'Complete owned source and supplied actual external declarations; null unit/camerainfo only',wholeMapAccepted:false};
}
export function withReadonlyNullGui(proof,callback){
 assert(proof?.records&&/^[0-9a-f]{64}$/u.test(proof.sourceSha256));
 return context.run(new Map(proof.records.map(r=>[r.name,r])),callback);
}
export function retainInlineCustomGlobals(args){
 const allowed=context.getStore();if(!allowed)return originalRetain(args);
 const statements=args.statements.filter(n=>{
  if(n.kind!==K.VariableDeclaration||!allowed.has(n.name.name))return true;
  const rule=allowed.get(n.name.name),ref=args.globalVars.get(n.name.name),v=ref&&args.elements[ref.id];
  const eligible=ref?.library===args.libId&&v?.type==='Variable'&&v.isConstant===true&&!v.isArray&&!v.variableType?.typeElement&&getTypeName(n.type)===rule.type&&n.initializer?.kind===K.NullKeyword&&(n.modifiers??[]).some(m=>m.kind===K.ConstKeyword);
  return !eligible;
 });
 return originalRetain({...args,statements});
}
