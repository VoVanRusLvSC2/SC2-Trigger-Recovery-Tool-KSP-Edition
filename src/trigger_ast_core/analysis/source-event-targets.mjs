// Explain source target shapes using loaded Event metadata. This is deliberately
// diagnostic: an identifier/name match is not a semantic native binding proof.
import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {hasImmutableGalaxyOrigin} from '../model/immutable-galaxy-syntax.collections.mjs';

const unparen=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
export function describeSourceEventTargets(ast,text,fileName,eventSymbols) {
 assert(hasImmutableGalaxyOrigin(ast,text,fileName),'SOURCE_EVENT_SYNTAX_ORIGIN_MISMATCH');
 assert.equal(ast.parseDiagnostics.length,0,'SOURCE_EVENT_SYNTAX_INVALID');
 const globals=new Set(),sourceOverrides=new Set(),records=[],refused=[];
 for(const n of ast.statements) {
  const name=n.name?.name;if(!name)continue;
  if(n.kind===K.VariableDeclaration)globals.add(name);
  if(n.kind===K.FunctionDeclaration&&(n.body||!n.modifiers?.some(m=>m.kind===K.NativeKeyword)))sourceOverrides.add(name);
 }
 function inspect(fn) {
  const parameters=new Set(fn.parameters.map(p=>p.name.name)),locals=new Set();
  function collect(n){if(n.kind===K.VariableDeclaration)locals.add(n.name.name);forEachChild(n,collect);}
  collect(fn.body);
  function visit(n) {
   const callee=n.kind===K.CallExpression?unparen(n.expression):undefined;
   const symbol=callee?.kind===K.Identifier?callee.name:undefined,metadata=eventSymbols.get(symbol);
   if(metadata) {
    const site={fileName,start:n.pos,end:n.end,function:fn.name.name,symbol};
    if(parameters.has(symbol)||locals.has(symbol)||globals.has(symbol)||sourceOverrides.has(symbol))
     refused.push({...site,reason:'SOURCE_SHADOW_OR_OVERRIDE'});
    else if(n.arguments.length!==metadata.explicitArity)
     refused.push({...site,reason:'SOURCE_METADATA_ARITY_DIFFERS',actualArity:n.arguments.length,expectedArity:metadata.explicitArity});
    else {
     const target=unparen(n.arguments[0]);
     const shape=target?.kind===K.Identifier?(parameters.has(target.name)?'PARAMETER':locals.has(target.name)?'LOCAL':globals.has(target.name)?'GLOBAL':'UNRESOLVED_IDENTIFIER')
      :target?.kind===K.PropertyAccessExpression?'MEMBER':target?.kind===K.ElementAccessExpression?'INDEX'
      :target?.kind===K.CallExpression?'CALL':target?.kind===K.NullKeyword?'NULL':'OTHER';
     records.push({...site,targetShape:shape,target:text.slice(target?.pos??n.pos,target?.end??n.end),
      metadata,callSource:text.slice(n.pos,n.end),nativeBindingProved:false,guiContainerEquivalenceProved:false});
    }
   }
   forEachChild(n,visit);
  }
  visit(fn.body);
 }
 for(const n of ast.statements)if(n.kind===K.FunctionDeclaration&&n.body)inspect(n);
 return {records,refused,diagnosticOnly:true,scope:'Supplied source only; loaded Event name/arity and target shape, not native binding or target equivalence.',
  sourceFilesChanged:false,wholeMapAccepted:false};
}
