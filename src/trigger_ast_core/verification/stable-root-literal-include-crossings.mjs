import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import {createInitializationOrder} from '../model/initialization-order.include-once.mjs';
import {assertExactAstShape} from './exact-ast-shape.mjs';
import {proveNativeStringLengthReadOnlyCall} from './native-string-length-effect.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const ignored=new Set(['parent','pos','end','line','char']);
const parse=(s,name)=>{const ast=new Parser().parseFile(name,s);assert.equal(ast.parseDiagnostics.length,0,'STABLE_FRAME_SYNTAX');return ast;};
const globals=ast=>ast.statements.filter(n=>n.kind===K.VariableDeclaration);
const literal=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return !!n&&([K.NullKeyword,K.TrueKeyword,K.FalseKeyword,K.StringLiteral,K.NumericLiteral].includes(n.kind)||n.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&n.operand?.kind===K.NumericLiteral);};
const walk=(root,visit)=>{const pending=[root];while(pending.length){const node=pending.pop();visit(node);forEachChild(node,c=>{pending.push(c);});}};
function sequence(order){const external=[],own=[];for(const n of order.initializers)if(n.fileName==='mapscript.galaxy')own.push({name:n.name,frame:external.length});else external.push({fileName:n.fileName,sourceSha256:n.sourceSha256,name:n.name,start:n.start,end:n.end});return{external,own};}

// This alternative never reorders own globals. Only already identical closed
// const literals may cross an unchanged external initializer sequence. Every
// external initializer is independently checked for protected reads and calls.
export function proveStableRootLiteralIncludeCrossings(before,after,externalSources,includeEvidence,{parseGalaxy}={}){
 const a=parse(before,'stable-frame-before'),b=parse(after,'stable-frame-after');
 const ag=globals(a),bg=globals(b),ai=ag.filter(n=>n.initializer),bi=bg.filter(n=>n.initializer);
 for(const list of [ag,bg])assert.equal(new Set(list.map(n=>n.name.name)).size,list.length,'STABLE_FRAME_DUPLICATE_ROOT');
 assert.equal(ai.length,bi.length,'STABLE_FRAME_GLOBAL_SET');
 for(let i=0;i<ai.length;i++)assertExactAstShape(ai[i],bi[i],{ignoredFields:ignored,label:'STABLE_FRAME_OWN_INITIALIZER_SEQUENCE_CHANGED'});
 const options={rootAliases:['LibMap_h.galaxy','Base.SC2Data/MapScript.galaxy','Base.SC2Data/LibMap_h.galaxy'],...(parseGalaxy?{parseGalaxy}:{})};
 const source=createInitializationOrder(before,externalSources,includeEvidence,options),target=createInitializationOrder(after,externalSources,includeEvidence,options);
 const from=sequence(source),to=sequence(target);
 assertExactAstShape(from.external,to.external,{label:'STABLE_FRAME_EXTERNAL_SEQUENCE_CHANGED'});
 assert.deepEqual(from.own.map(n=>n.name),to.own.map(n=>n.name),'STABLE_FRAME_RUNTIME_OWN_SEQUENCE_CHANGED');
 const protectedNames=new Set(from.own.filter((n,i)=>n.frame!==to.own[i].frame).map(n=>n.name));
 assert(protectedNames.size,'STABLE_FRAME_NO_CROSSINGS');
 for(const n of ai)if(protectedNames.has(n.name.name))assert(n.modifiers?.length===1&&n.modifiers[0].kind===K.ConstKeyword&&literal(n.initializer),'STABLE_FRAME_CROSSED_NOT_CLOSED_CONST_LITERAL');
 const external=externalSources.map((s,i)=>parse(s.text,s.fileName??'external-'+i)),effectSources=[a,b,...external];
 // Existing qualified Color constructor contract, with the actual declaration
 // ABI checked across root and external views; no opaque native is admitted.
 let colorDeclarations=0,colorValid=true;
 for(const ast of effectSources)for(const n of ast.statements){
  if(n.name?.name!=='Color')continue;
  if(n.kind!==K.FunctionDeclaration||n.body||n.modifiers?.length!==1||n.modifiers[0].kind!==K.NativeKeyword||getTypeName(n.type)!=='color'||n.parameters.length!==3||!n.parameters.every(p=>getTypeName(p.type)==='fixed'))colorValid=false;
  else colorDeclarations++;
 }
 const calls=[];
 for(let i=0;i<external.length;i++)for(const n of globals(external[i])){
  assert(!protectedNames.has(n.name.name),'STABLE_FRAME_EXTERNAL_BINDING_COLLISION');
  if(!n.initializer)continue;
  walk(n.initializer,node=>{
   assert(node.kind!==K.Identifier||!protectedNames.has(node.name),'STABLE_FRAME_PROTECTED_GLOBAL_OBSERVED');
   if(node.kind!==K.CallExpression)return;
   const color=colorValid&&colorDeclarations>0&&node.expression?.kind===K.Identifier&&node.expression.name==='Color'&&node.arguments.length===3&&node.arguments.every(arg=>arg.kind===K.NumericLiteral&&Number.isFinite(Number(arg.value))&&Number(arg.value)>=0&&Number(arg.value)<=100);
   const readonly=color?undefined:proveNativeStringLengthReadOnlyCall(node,effectSources);
   assert(color||readonly,'STABLE_FRAME_UNPROVED_EXTERNAL_CALL:'+String(node.expression?.name??node.kind)+':'+n.name.name);
   calls.push({fileName:externalSources[i].fileName,global:n.name.name,kind:color?'CHECKED_NATIVE_COLOR_VALUE':'CHECKED_NATIVE_READONLY_STRING_LENGTH',...(readonly?{evidence:readonly}:{})});
  });
 }
 return {before,after,records:[{kind:'STABLE_OWN_SEQUENCE_CLOSED_CONST_LITERAL_INCLUDE_CROSSINGS',sourceSha256:sha(before),targetSha256:sha(after),protectedNames:[...protectedNames],allOwnInitializerNodesExact:true,ownOrderUnchanged:true,externalSequenceExact:true,closedConstLiteralCrossingsOnly:true,unmovedNonliteralInitializersPreserved:true,calls,sourceFiles:source.files,targetFiles:target.files,representationBytesChanged:false,wholeMapAccepted:false}]};
}
