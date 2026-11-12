// Preserve an explicit map startup protocol in the compiler's document context.
// GUI references alone do not describe every declared dependency initialization.
// No GUI element, wrapper, script patch, or persistent cache is introduced.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const facts=new WeakMap(),sha=s=>createHash('sha256').update(s).digest('hex');
const call=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression?.kind===K.Identifier&&s.expression.arguments.length===0?s.expression.expression.name:undefined;
export function createSourceMapStartupDependencies(source){
 const ast=new Parser().parseFile('source-map-startup',source);assert.equal(ast.parseDiagnostics.length,0,'SOURCE_MAP_STARTUP_PARSE');
 const proof={kind:'SOURCE_DECLARED_MAP_STARTUP_DEPENDENCIES',sourceSha256:sha(source),applicable:false,sourceOrArchiveChanged:false,wholeMapAccepted:false,persistentCache:false};
 const fns=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body),roots=fns.filter(n=>n.name.name==='InitMap');
 if(roots.length!==1){proof.reason='NO_UNIQUE_MAP_ENTRY';return {proof};}
 const root=roots[0];if(root.parameters.length||root.type?.kind!==K.VoidKeyword){proof.reason='NONSTANDARD_MAP_ENTRY';return {proof};}
 const name=call(root.body.statements[0]),stages=fns.filter(n=>n.name.name===name);
 if(stages.length!==1||stages[0].parameters.length||stages[0].type?.kind!==K.VoidKeyword){proof.reason='NO_UNIQUE_DIRECT_STARTUP_STAGE';return {proof};}
 const ids=stages[0].body.statements.map(s=>/^lib([A-Za-z0-9_]+)_InitLib$/u.exec(call(s)??'')?.[1]);
 if(!ids.length||ids.length>256||ids.some(id=>!id||id.length>128)||new Set(ids).size!==ids.length){proof.reason='NONCANONICAL_OR_DUPLICATE_LIBRARY_STARTUP';return {proof};}
 const value=Object.freeze({sourceSha256:proof.sourceSha256,stage:name,libraryIds:Object.freeze([...ids])});
 const capability=Object.freeze({kind:proof.kind,sourceSha256:value.sourceSha256});facts.set(capability,value);
 Object.assign(proof,{applicable:true,stage:name,libraryIds:[...ids],nativeFirstValidatedDuringCompilation:true,allDependenciesValidatedDuringCompilation:true});return {capability,proof};
}
export function resolveSourceMapStartupDependencies(capability,{library,nativeLibrary,allLibraries,derived=[]}){
 if(capability===undefined)return derived;
 const f=facts.get(capability);assert(f,'UNTRUSTED_SOURCE_MAP_STARTUP_CAPABILITY');
 // Embedded libraries retain their own dependency protocol. This context belongs
 // only to the enclosing implicit map, which starts every declared dependency.
 if(library.implicit!==true)return derived;
 assert(nativeLibrary?.id&&f.libraryIds[0]===nativeLibrary.id,'SOURCE_MAP_NATIVE_STARTUP_ORDER_CHANGED');
 const ids=f.libraryIds.slice(1);assert(!ids.includes(library.id),'SOURCE_MAP_STARTUP_SELF_DEPENDENCY');
 for(const id of ids){const l=allLibraries?.get(id);assert(l&&l.id===id,'SOURCE_MAP_STARTUP_DEPENDENCY_UNAVAILABLE:'+id);}
 for(const id of derived)assert(id===nativeLibrary.id||ids.includes(id),'SOURCE_MAP_STARTUP_OMITS_GUI_DEPENDENCY:'+id);
 return ids;
}
