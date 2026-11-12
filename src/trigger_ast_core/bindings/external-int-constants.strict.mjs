// Source-bound, per-conversion values. No persistent cache or guessed ABI.
// Reify only generated bare reads of immutable external int declarations.
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const context=new AsyncLocalStorage(),facts=new WeakMap();
const sha=s=>createHash('sha256').update(s).digest('hex');
const parse=s=>{const a=new Parser().parseFile('external-int-constants',s);assert.equal(a.parseDiagnostics.length,0);return a;};
function walk(n,visit){if(n){visit(n);forEachChild(n,c=>walk(c,visit));}}
function integer(n){
 if(n?.kind===K.ParenthesizedExpression)return integer(n.expression);
 let negative=false;
 if(n?.kind===K.PrefixUnaryExpression&&n.operator.kind===K.MinusToken){negative=true;n=n.operand;}
 if(n?.kind!==K.NumericLiteral||!/^(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/u.test(n.text??''))return;
 let value=BigInt(/^0[0-7]+$/u.test(n.text)?'0o'+n.text.slice(1):n.text);
 if(negative)value=-value;
 return value>=-2147483648n&&value<=2147483647n?value.toString():undefined;
}
export function createExternalIntConstants({ownedSources=[],externalSources=[]}){
 const shadowed=new Set(),called=new Set(),definitions=new Map(),sourceEvidence=[];
 for(const input of ownedSources){
  const text=typeof input==='string'?input:input.text;
  walk(parse(text),n=>{
   if([K.VariableDeclaration,K.ParameterDeclaration,K.FunctionDeclaration,K.StructDeclaration,K.PropertyDeclaration,K.TypedefDeclaration].includes(n.kind)&&n.name?.name)shadowed.add(n.name.name);
   if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier)called.add(n.expression.name);
   if(n.kind===K.BinaryExpression&&K[n.operatorToken.kind]?.endsWith('EqualsToken')&&n.left?.kind===K.Identifier)shadowed.add(n.left.name);
   if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind)&&n.operand?.kind===K.Identifier)shadowed.add(n.operand.name);
  });
  sourceEvidence.push({ownership:'owned',sha256:sha(text)});
 }
 for(const input of externalSources){
  const text=typeof input==='string'?input:input.text,source={name:input.fileName??input.name,sha256:sha(text)};
  sourceEvidence.push({ownership:'external',...source});
  for(const n of parse(text).statements)if(n.name?.name){const ds=definitions.get(n.name.name)??[];ds.push({node:n,source});definitions.set(n.name.name,ds);}
 }
 const bindings=new Map();
 for(const[name,ds]of definitions){
  if(shadowed.has(name)||called.has(name))continue;
  const values=ds.map(({node:n})=>n.kind===K.VariableDeclaration&&n.type.kind===K.IntKeyword&&n.modifiers?.length===1&&n.modifiers[0].kind===K.ConstKeyword?integer(n.initializer):undefined);
  if(values.every(v=>v!==undefined&&v===values[0]))bindings.set(name,{value:values[0],declarations:ds.map(d=>d.source)});
 }
 const proof={kind:'DECLARED_IMMUTABLE_EXTERNAL_INT_READS',sourceEvidence,availableBindings:bindings.size,bindingContractVersion:2,rewrites:[],persistentCache:false,originalSourcesChanged:false,outputChangesAreTypedGuiValueBindings:true};
 const capability=Object.freeze({kind:proof.kind});facts.set(capability,{bindings,proof});return{capability,proof};
}
export function withExternalIntConstants(capability,callback){const f=facts.get(capability);assert(f,'UNTRUSTED_EXTERNAL_INT_CONSTANT_CAPABILITY');return context.run(f,callback);}
const refKey=(r,owner)=>JSON.stringify([r.library??owner,r.type,r.id]);
function references(value,owner,out){
 if(!value||typeof value!=='object')return;
 if(Array.isArray(value)){value.forEach(v=>references(v,owner,out));return;}
 if(value.type&&value.id){out.add(refKey(value,owner));return;}
 for(const[k,v]of Object.entries(value))if(!['parent','xmlSource','rawXml'].includes(k))references(v,owner,out);
}
export function reifyExternalIntConstants(elements,libId,rootRefs=[]){
 const active=context.getStore();if(!active)return [];
 const records=[],removedCalls=new Set(),touchedDefinitions=new Set();
 const competing=['value','variable','paramRef','preset','valueElement','expressionText','structMember'];
 function replace(p,name,via){
  const binding=active.bindings.get(name);
  if(!binding||competing.some(k=>p[k]!==undefined)||p.expressionType!==undefined||p.expressionParams?.length||p.valueParams?.length||p.arrayIndexes?.length||p.valueType&&!['int','any','anyvariable'].includes(p.valueType.type))return false;
  delete p.scriptCode;delete p.functionCall;p.valueType={type:'int'};p.value=binding.value;
  const record={library:libId,param:p.id,constant:name,value:binding.value,via,declarations:binding.declarations};records.push(record);active.proof.rewrites.push(record);return true;
 }
 for(const p of Object.values(elements)){
  if(p.type!=='Param'||p.disabled)continue;
  if(typeof p.scriptCode==='string'&&active.bindings.has(p.scriptCode)&&!p.functionCall){replace(p,p.scriptCode,'bare-script-read');continue;}
  if(!p.functionCall||p.scriptCode!==undefined||(p.functionCall.library??libId)!==libId)continue;
  const call=elements[p.functionCall.id];if(call?.type!=='FunctionCall'||call.disabled||call.scriptCode!==undefined||call.subFunctions?.length||call.parameters?.length||(call.functionDef?.library??libId)!==libId)continue;
  const def=elements[call.functionDef?.id];
  if(def?.type!=='FunctionDef'||def.disabled||def.parameters?.length||def.localVariables?.length||def.actions?.length||def.conditions?.length||def.events?.length||def.subFunctionTypes?.length||def.flags?.includes('Native')||!active.bindings.has(def.scriptCode)||def.name!==def.scriptCode)continue;
  if(replace(p,def.scriptCode,'generated-constant-getter')){removedCalls.add(call.id);touchedDefinitions.add(def.id);}
 }
 // Remove only generated getter debris whose runtime references are gone.
 const uses=()=>{const all=new Set();for(const e of Object.values(elements))for(const[k,v]of Object.entries(e))if(!['parent','xmlSource','rawXml'].includes(k))references(v,libId,all);references(rootRefs,libId,all);return all;};
 let live=uses();for(const id of removedCalls)if(!live.has(refKey({type:'FunctionCall',id},libId)))delete elements[id];
 for(const id of touchedDefinitions){
  const nonOrganizational=new Set();
  for(const e of Object.values(elements))if(e.type!=='Category')for(const[k,v]of Object.entries(e))if(!['parent','xmlSource','rawXml'].includes(k))references(v,libId,nonOrganizational);
  const key=refKey({type:'FunctionDef',id},libId);if(nonOrganizational.has(key))continue;
  for(const e of Object.values(elements))if(e.type==='Category'&&e.items)e.items=e.items.filter(r=>refKey(r,libId)!==key);
  for(let i=rootRefs.length-1;i>=0;i--)if(refKey(rootRefs[i],libId)===key)rootRefs.splice(i,1);
  delete elements[id];
 }
 return records;
}
