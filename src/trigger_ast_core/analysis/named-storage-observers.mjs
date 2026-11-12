import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const walk=(node,visit,parent)=>{visit(node,parent);forEachChild(node,child=>walk(child,visit,node));};
const unwrap=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};

/** The standard unit-reference API observes a script storage path. Decode whole
 * constant expressions rather than just literals: "tar"+"get" is observable.
 * Mutable strings, parameters, unknown producers and escaping consumers veto
 * the alpha permission; no runtime value is guessed. */
export function inspectNamedStorageObservers(text,names,{externalSources=[]}={}){
 const wanted=new Map(names.map(name=>[name.toLowerCase(),name])),observed=new Set(),calls=[];
 const files=[{fileName:'MapScript.galaxy',text,owned:true},...externalSources.map(f=>({...f,owned:false}))];
 const inputs=files.map(f=>({...f,sourceId:f.fileName,contentSha256:sha(f.text)}));
 for(const f of files)if(f.sha256!==undefined)assert.equal(f.sha256,sha(f.text),'STORAGE_OBSERVER_SOURCE_SHA');
 const program=new GalaxyProgramContext(inputs,{files:inputs,dependencies:[]},sha,{checks:'binding'});
 let unknown=false;
 try{
  for(const ast of program.documents.values()){assert.equal(ast.parseDiagnostics.length,0,'STORAGE_OBSERVER_SYNTAX');program.attachOriginal(ast);}
  const written=new Set(),assignments=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken'].map(k=>K[k]));
  for(const ast of program.documents.values())walk(ast,node=>{
   const operand=node.kind===K.BinaryExpression&&assignments.has(node.operatorToken?.kind)?unwrap(node.left):
    [K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(node.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(node.operator?.kind??node.operator)?unwrap(node.operand):undefined;
   if(operand?.kind===K.Identifier){const declaration=program.declarationAt(operand);if(declaration)written.add(declaration);}
  });
  function value(node,seen=new Set()){
   node=unwrap(node);if(!node)return;
   if(node.kind===K.StringLiteral)return readStringLiteralValue(node.text)?.value;
   if(node.kind===K.BinaryExpression&&node.operatorToken?.kind===K.PlusToken){
    const a=value(node.left,seen),b=value(node.right,seen);if(a!==undefined&&b!==undefined&&a.length+b.length<=4096)return a+b;return;
   }
   if(node.kind!==K.Identifier||program.getBinding(node).status!=='BOUND')return;
   const declaration=program.declarationAt(node);
   if(declaration?.kind!==K.VariableDeclaration||declaration.type.kind!==K.StringKeyword||!declaration.modifiers?.some(m=>m.kind===K.ConstKeyword)||
     !declaration.initializer||written.has(declaration)||seen.has(declaration)||seen.size>=64)return;
   const next=new Set(seen);next.add(declaration);return value(declaration.initializer,next);
  }
  for(const [fileName,ast]of program.documents)walk(ast,(node,parent)=>{
   if(node.kind===K.Identifier&&node.name==='UnitRefFromVariable'&&
     !(parent?.kind===K.FunctionDeclaration&&parent.name===node)&&!(parent?.kind===K.CallExpression&&parent.expression===node))unknown=true;
   if(node.kind!==K.CallExpression||node.expression?.kind!==K.Identifier||node.expression.name!=='UnitRefFromVariable')return;
   const declaration=program.declarationAt(node.expression),bound=program.getBinding(node.expression).status==='BOUND';
   const exact=bound&&declaration?.kind===K.FunctionDeclaration&&!declaration.body&&declaration.modifiers?.length===1&&declaration.modifiers[0].kind===K.NativeKeyword&&
    declaration.type.kind===K.UnitrefKeyword&&declaration.parameters.length===1&&declaration.parameters[0].type.kind===K.StringKeyword&&!declaration.parameters[0].isReference;
   const path=exact&&node.arguments.length===1?value(node.arguments[0]):undefined;
   if(path===undefined)unknown=true;else for(const word of path.split(/[^A-Za-z0-9_]+/u)){const name=wanted.get(word.toLowerCase());if(name)observed.add(name);}
   calls.push({fileName,start:node.pos,end:node.end,nativeAbiVerified:!!exact,pathKnown:path!==undefined,
    ...(path===undefined?{}:{path}),observedNames:path===undefined?[]:[...observed]});
  });
  return {kind:'BOUND_STANDARD_NATIVE_STORAGE_PATH_OBSERVERS',observedNames:[...observed],unknownObserverInput:unknown,calls,
   allUnknownObserverInputsRefused:true,constantConcatenationsDecoded:true,mutableValuesGuessed:false,
   scope:'Verified supplied Galaxy and the standard UnitRefFromVariable native storage-path ABI; not arbitrary external engine mechanisms.',wholeMapAccepted:false};
 }finally{program.dispose();}
}
