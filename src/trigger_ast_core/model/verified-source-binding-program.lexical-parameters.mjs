import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from './galaxy-program-context.lexical-parameters.mjs';
import {partitionDeclarationViews,logicalSourcePath} from './source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {parseImmutableGalaxySyntax as parse} from './immutable-galaxy-syntax.mjs';
import {isIntrinsicScalarType} from './passive-function-entry-storage.mjs';
import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const inside=(n,owner)=>n.pos>=owner.pos&&n.end<=owner.end;

// A transient binding context for one exact comparison view and its reachable
// includes. Metadata alone neither authorizes a runtime rewrite nor proves
// native effects. The caller owns and must dispose the returned program.
export function openVerifiedSourceBindingProgram(source,context={}){
  const root={fileName:'MapScript.galaxy',text:source},owned=context.ownedSources??[];
  const views=partitionDeclarationViews(owned,context.externalSources??[]);
  if(views.conflicts.length)return {reason:'CONFLICTING_SOURCE_VIEWS'};
  const closure=removeAlreadyLoadedOwnedIncludes({root,ownedSources:owned,externalSources:views.external,
    includeEvidence:context.includeEvidence??[],includeRoot:false}).proof;
  if(!closure.completeReachableClosure)return {reason:'INCOMPLETE_INCLUDE_CLOSURE'};
  const reached=new Map(closure.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256])),files=[],seen=new Set();
  for(const f of [root,...owned,...views.external]){
    const fileName=logicalSourcePath(f.originalPath??f.fileName);
    if(!reached.has(fileName)||seen.has(fileName))continue;
    assert.equal(sha(f.text),reached.get(fileName),'SOURCE_BINDING_INCLUDE_CHANGED');seen.add(fileName);
    files.push({fileName,text:f.text,sourceId:'verified-bindings:'+fileName,contentSha256:sha(f.text),owned:f===root||owned.includes(f)});
  }
  const program=new GalaxyProgramContext(files,{files},sha,{checks:'binding'}),functions=new Map();
  try{
    for(const doc of program.documents.values()){
      program.attachOriginal(doc);assert.equal(doc.parseDiagnostics.length,0);
      for(const n of doc.statements)if(n.name?.name){const rows=functions.get(n.name.name)??[];rows.push(n);functions.set(n.name.name,rows);}
    }
    const ast=parse(source,logicalSourcePath(root.fileName));assert.equal(ast.parseDiagnostics.length,0);program.attachOriginal(ast);
    const signature=n=>JSON.stringify([printer.printNode(n.type),n.parameters?.map(p=>[printer.printNode(p.type),!!p.isReference])]);
    const calls=new Map();
    function argumentFact(call,index){
      if(!calls.has(call)){
        const target=call.expression.kind===K.Identifier?program.declarationAt(call.expression):undefined,rows=functions.get(call.expression.name)??[];
        const valid=target?.kind===K.FunctionDeclaration&&rows.includes(target)&&target.parameters.length===call.arguments.length&&
          rows.every(n=>n.kind===K.FunctionDeclaration&&signature(n)===signature(target));
        const where=valid&&program.location(target);
        calls.set(call,where&&program.verifiedInputIdentity(where.sourceFile)?.contentSha256===where.contentSha256?{target,where}:null);
      }
      const bound=calls.get(call),formal=bound?.target.parameters[index];
      if(!formal||formal.isReference||!isIntrinsicScalarType(formal.type))return;
      return {callee:call.expression.name,parameterIndex:index,type:printer.printNode(formal.type),isReference:false,
        source:bound.where,allActiveSignaturesAgree:true};
    }
    function referenceFacts(ref,owner){
      const facts=[];
      for(let p=ref.parent;p&&p!==owner;p=p.parent){
        if([K.ArrayType,K.TypeReference,K.FunctionDeclaration].includes(p.kind))return {reason:'NONVALUE_OR_NESTED_FUNCTION_REFERENCE'};
        if(p.kind!==K.CallExpression)continue;
        if(inside(ref,p.expression))return {reason:'LOCAL_USED_AS_CALLEE'};
        const index=p.arguments.findIndex(arg=>inside(ref,arg));
        if(index>=0){const fact=argumentFact(p,index);if(!fact)return {reason:'REFERENCE_OR_UNQUALIFIED_CALL_ARGUMENT'};facts.push(fact);}
      }
      return {facts};
    }
    return {program,ast,closure,referenceFacts,dispose:()=>program.dispose()};
  }catch(error){program.dispose();throw error;}
}
