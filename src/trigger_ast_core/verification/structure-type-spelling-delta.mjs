// A producer-delta fence, not a whole-program equivalence certificate.
// Rename only authored type slots; ordinary identifiers/literals stay exact.
import {isDeepStrictEqual} from 'node:util';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const location=new Set(['parent','pos','end','line','char','syntaxTokens','comments','symbol','locals','flowNode']);
function shape(node,names,parent,key){
 if(!node||typeof node!=='object')return node;
 if(Array.isArray(node))return node.map(n=>shape(n,names,parent,key));
 const typeSlot=key==='type'||parent?.kind===K.ArrayType&&key==='elementType'||parent?.kind===K.StructDeclaration&&key==='name'||parent?.kind===K.MappedType&&[K.StructrefKeyword,K.ArrayrefKeyword].includes(parent.returnType?.kind)&&key==='typeArguments';
 return Object.fromEntries(Object.entries(node).filter(([k])=>!location.has(k)).map(([k,v])=>[k,
  node.kind===K.Identifier&&typeSlot&&k==='name'&&names.has(v)?names.get(v):shape(v,names,node,k)]));
}
export function inspectStructureTypeSpellingDelta(before,after,records){
 const asts=[before,after].map((text,i)=>parseImmutableGalaxySyntax(text,'producer-'+i));
 const names=new Map(records.map(r=>[r.compilerPrefix+r.oldIdentifier,r.sourceType]));
 const syntaxValid=asts.every(a=>a.parseDiagnostics.length===0);
 const equal=syntaxValid&&names.size===records.length&&isDeepStrictEqual(shape(asts[0].statements,names),shape(asts[1].statements,new Map()));
 return {passed:equal,syntaxValid,renamedTypes:names.size,allOtherExecutableAstExact:equal,wholeProgramEquivalent:false};
}
