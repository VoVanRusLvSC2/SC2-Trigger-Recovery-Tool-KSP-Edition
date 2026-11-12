// Read-only proof of a complete generated program under bound private/local
// alpha renaming. Public names, all bodies, types, calls and values must match.
// A callback string can change only for the actual unambiguous native
// TriggerCreate(string)->trigger ABI, without a source override or name escape.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {Parser,Printer,SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {getTypeName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs';import {readStringLiteralValue} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/c08bba33eae3-string-literal-value.mjs';
const sha=t=>createHash('sha256').update(t).digest('hex'),printer=new Printer();function walk(n,f,p,owner){if(!n)return;if(n.kind===K.FunctionDeclaration)owner=n;f(n,p,owner);forEachChild(n,c=>walk(c,f,n,owner));}
const parse=t=>{const a=new Parser().parseFile('closed-program-alpha',t);assert.equal(a.parseDiagnostics.length,0,'INVALID_ALPHA_SOURCE');return a;};
function clean(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(clean);return Object.fromEntries(Object.keys(n).sort().filter(k=>!['parent','pos','end','line','char','syntaxTokens'].includes(k)).map(k=>[k,clean(n[k])]));}
export function proveClosedGeneratedProgramAlpha(source,expected,{publicSymbols=[],externalSources=[]}={}){
 const proof={sourceSha256:sha(source),expectedSha256:sha(expected),externalInputs:externalSources.map(s=>({name:typeof s==='string'?undefined:s.fileName??s.name,sha256:sha(typeof s==='string'?s:s.text)})),matched:false,globalBindings:[],localBindings:[],callbackBindings:[],sourceOrArchiveWritten:false,privateAbiClosureProven:false,rewritePermitted:false,scope:'Complete supplied program AST and direct references in supplied sources; dynamic callback values and external resource entry points require a separate closure proof before any rewrite.'};
 try{
  const a=parse(source),b=parse(expected),external=externalSources.map(s=>parse(typeof s==='string'?s:s.text)),publicNames=new Set(publicSymbols),mapping=new Map(),sourceNames=new Set(),targetNames=new Set(),locals=new WeakMap();
  assert.equal(a.statements.length,b.statements.length,'DECLARATION_COUNT_CHANGED');
  for(let i=0;i<a.statements.length;i++){
   const x=a.statements[i],y=b.statements[i];assert.equal(x.kind,y.kind,'DECLARATION_KIND_CHANGED');
   if(![K.VariableDeclaration,K.FunctionDeclaration].includes(x.kind))continue;
   assert(!sourceNames.has(x.name.name)&&!targetNames.has(y.name.name),'DUPLICATE_GLOBAL_BINDING');sourceNames.add(x.name.name);targetNames.add(y.name.name);
   if(publicNames.has(y.name.name))assert.equal(x.name.name,y.name.name,'PUBLIC_ABI_NAME_CHANGED');
   mapping.set(x.name.name,y.name.name);if(x.name.name!==y.name.name)proof.globalBindings.push({source:x.name.name,target:y.name.name,kind:x.kind===K.FunctionDeclaration?'function':'variable'});
  }
  for(let i=0;i<a.statements.length;i++){
   const x=a.statements[i],y=b.statements[i];if(x.kind!==K.FunctionDeclaration)continue;
   const bindings=f=>{const ns=[];walk(f,n=>{if([K.ParameterDeclaration,K.VariableDeclaration].includes(n.kind))ns.push(n);});return ns;},xs=bindings(x),ys=bindings(y);assert.equal(xs.length,ys.length,'LOCAL_BINDING_COUNT_CHANGED');
   assert.equal(new Set(xs.map(n=>n.name.name)).size,xs.length,'SOURCE_LOCAL_SHADOW');assert.equal(new Set(ys.map(n=>n.name.name)).size,ys.length,'TARGET_LOCAL_SHADOW');
   const scope=new Map();for(let n=0;n<xs.length;n++){assert(!sourceNames.has(xs[n].name.name)&&!targetNames.has(ys[n].name.name),'LOCAL_GLOBAL_CAPTURE');scope.set(xs[n].name.name,ys[n].name.name);if(xs[n].name.name!==ys[n].name.name)proof.localBindings.push({function:x.name.name,source:xs[n].name.name,target:ys[n].name.name});}locals.set(x,scope);
  }
  const changed=new Set(proof.globalBindings.flatMap(r=>[r.source,r.target]));
  // Prevent private ABI renaming from changing any other module's resolution,
  // including escaped callback/name observations hidden in byte literals.
  for(const ast of external)walk(ast,n=>{if(n.kind===K.Identifier&&changed.has(n.name))throw Error('EXTERNAL_PRIVATE_NAME_REFERENCE');if(n.kind===K.StringLiteral){const s=readStringLiteralValue(n.text);assert(s,'UNDECODED_EXTERNAL_STRING');assert(![...changed].some(name=>s.bytes.includes(Buffer.from(name))),'EXTERNAL_PRIVATE_NAME_STRING');}});
  let triggerNative=false,triggerOverride=false;
  for(const ast of [a,...external])for(const n of ast.statements){if(n.name?.name!=='TriggerCreate')continue;if(n.kind!==K.FunctionDeclaration||n.body||n.modifiers?.length!==1||n.modifiers[0].kind!==K.NativeKeyword||getTypeName(n.type)!=='trigger'||n.parameters.length!==1||getTypeName(n.parameters[0].type)!=='string')triggerOverride=true;else triggerNative=true;}
  walk(a,(n,p,owner)=>{
   if(n.kind===K.StringLiteral){
    const s=readStringLiteralValue(n.text);assert(s,'UNDECODED_SOURCE_STRING');const observed=[...changed].filter(name=>s.bytes.includes(Buffer.from(name)));if(!observed.length)return;
    const name=s.bytes.toString('utf8'),target=mapping.get(name),functionBinding=proof.globalBindings.find(r=>r.source===name&&r.kind==='function');
    assert(functionBinding&&target&&s.bytes.equals(Buffer.from(name))&&observed.every(x=>x===name),'PRIVATE_NAME_STRING_ESCAPE');
    assert(triggerNative&&!triggerOverride&&p?.kind===K.CallExpression&&p.expression?.kind===K.Identifier&&p.expression.name==='TriggerCreate'&&!locals.get(owner)?.has('TriggerCreate')&&p.arguments[0]===n&&p.arguments.length===1,'CALLBACK_NATIVE_ABI_UNPROVED');
    const literal=parse('string Callback='+JSON.stringify(target)+';').statements[0].initializer;n.text=literal.text;n.value=literal.value;proof.callbackBindings.push({source:name,target,actualNativeTriggerCreate:true});
   }
   if(n.kind!==K.Identifier)return;if(p?.kind===K.PropertyAccessExpression&&p.name===n)return;
   const renamed=locals.get(owner)?.get(n.name)??mapping.get(n.name);if(renamed)n.name=renamed;
  });
  assert.deepEqual(clean(a.statements),clean(b.statements),'COMPLETE_GENERATED_PROGRAM_CHANGED');proof.matched=true;proof.completeProgramAstIdentical=true;proof.publicAbiPreserved=true;return{proof,normalizedSource:printer.printFile(a)};
 }catch(error){proof.reason=error.code??String(error.message).split('\n')[0];return{proof};}
}
