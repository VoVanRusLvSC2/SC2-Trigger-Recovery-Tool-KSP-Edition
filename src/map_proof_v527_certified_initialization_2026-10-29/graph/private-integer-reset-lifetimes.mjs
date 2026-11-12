import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lazy-carriers.mjs';
import {partitionDeclarationViews,logicalSourcePath} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {isIntrinsicScalarType} from '../model/passive-function-entry-storage.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K,forEachChild,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
function walk(n,visit){visit(n);forEachChild(n,c=>walk(c,visit));}
const inside=(n,owner)=>n.pos>=owner.pos&&n.end<=owner.end;
const memberName=n=>n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n;

// A reset at function-body level executes at most once per invocation. Its RHS
// must not read the old integer cell. Splitting this private cell at that reset
// retains every store/read, all nested control flow, and every call in order.
// Reference/unknown argument bindings, non-entry locals, and shadowing refuse.
// This is a reversible comparison view, never rewritten runtime or GUI code.
export function canonicalPrivateIntegerResetLifetimes(source,context={}){
  const proof={kind:'BOUND_PRIVATE_INTEGER_UNCONDITIONAL_RESET_LIFETIMES',records:[],refused:[],
    sourceSha256:sha(source),sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
  const unchanged=reason=>({text:source,proof:{...proof,reason,viewSha256:sha(source)}});
  const root={fileName:'MapScript.galaxy',text:source},owned=context.ownedSources??[];
  const views=partitionDeclarationViews(owned,context.externalSources??[]);
  if(views.conflicts.length)return unchanged('CONFLICTING_SOURCE_VIEWS');
  const closure=removeAlreadyLoadedOwnedIncludes({root,ownedSources:owned,externalSources:views.external,
    includeEvidence:context.includeEvidence??[],includeRoot:false}).proof;
  if(!closure.completeReachableClosure)return unchanged('INCOMPLETE_INCLUDE_CLOSURE');
  const reached=new Map(closure.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256])),files=[],seen=new Set();
  for(const f of [root,...owned,...views.external]){
    const fileName=logicalSourcePath(f.originalPath??f.fileName);
    if(!reached.has(fileName)||seen.has(fileName))continue;
    assert.equal(sha(f.text),reached.get(fileName),'RESET_LIFETIME_INCLUDE_CHANGED');seen.add(fileName);
    files.push({fileName,text:f.text,sourceId:'reset-lifetimes:'+fileName,contentSha256:sha(f.text),owned:f===root||owned.includes(f)});
  }
  const program=new GalaxyProgramContext(files,{files},sha,{checks:'binding'});
  try{
    for(const ast of program.documents.values()){program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length,0);}
    const ast=parse(source,logicalSourcePath(root.fileName));program.attachOriginal(ast);
    const edits=[],renamed=new Map(),replaced=new Map(),names=new Set(),functions=new Map();
    walk(ast,n=>{if(n.kind===K.Identifier)names.add(n.name);});
    let prefix='proofResetInt';while([...names].some(n=>n.startsWith(prefix)))prefix+='X';
    for(const doc of program.documents.values())for(const n of doc.statements)if(n.name?.name){
      const group=functions.get(n.name.name)??[];group.push(n);functions.set(n.name.name,group);
    }
    const signature=n=>JSON.stringify([printer.printNode(n.type),n.parameters?.map(p=>[printer.printNode(p.type),!!p.isReference])]);
    const checkedCalls=new Map();
    function byValueCall(call,index){
      if(!checkedCalls.has(call)){
        const target=call.expression.kind===K.Identifier?program.declarationAt(call.expression):undefined;
        const rows=functions.get(call.expression.name)??[];
        const valid=target?.kind===K.FunctionDeclaration&&rows.includes(target)&&rows.every(n=>
          n.kind===K.FunctionDeclaration&&signature(n)===signature(target))&&target.parameters.length===call.arguments.length;
        const where=valid&&program.location(target);
        checkedCalls.set(call,where&&program.verifiedInputIdentity(where.sourceFile)?.contentSha256===where.contentSha256?{target,where}:null);
      }
      const bound=checkedCalls.get(call),parameter=bound?.target.parameters[index];
      if(!parameter||parameter.isReference||!isIntrinsicScalarType(parameter.type))return;
      return {callee:call.expression.name,parameterIndex:index,parameterType:printer.printNode(parameter.type),
        isReference:false,source:bound.where,allActiveSignaturesAgree:true};
    }
    for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
      const prefixDeclarations=[];for(const s of fn.body.statements){if(s.kind!==K.VariableDeclaration)break;prefixDeclarations.push(s);}
      const localDeclarations=[...fn.parameters];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)localDeclarations.push(n);});
      if(new Set(localDeclarations.map(n=>n.name.name)).size!==localDeclarations.length)continue;
      const selected=[];
      for(const local of prefixDeclarations){
        if(local.type.kind!==K.IntKeyword||local.initializer||local.isReference||local.modifiers?.length)continue;
        const binding=program.getBinding(local.name);if(binding.status!=='BOUND')continue;
        const refs=[];let failure;
        walk(fn.body,n=>{
          if(n.kind!==K.Identifier||n===local.name||memberName(n)||n.name!==local.name.name)return;
          const ref=program.getBinding(n);
          if(ref.status!=='BOUND'){failure='UNRESOLVED_SAME_SPELLING_REFERENCE';return;}
          if(ref.symbolId!==binding.symbolId)return;
          for(let p=n.parent;p&&p!==fn.body;p=p.parent){
            if([K.ArrayType,K.TypeReference,K.FunctionDeclaration].includes(p.kind)){failure='NONVALUE_OR_NESTED_FUNCTION_REFERENCE';break;}
            if(p.kind===K.CallExpression){
              if(inside(n,p.expression)){failure='LOCAL_USED_AS_CALLEE';break;}
              const i=p.arguments.findIndex(arg=>inside(n,arg));
              if(i>=0&&!byValueCall(p,i)){failure='REFERENCE_OR_UNQUALIFIED_CALL_ARGUMENT';break;}
            }
          }
          refs.push(n);
        });
        const resets=[];
        for(const s of fn.body.statements){
          const expr=un(s.kind===K.ExpressionStatement?s.expression:undefined),lhs=un(expr?.left);
          if(expr?.kind!==K.BinaryExpression||expr.operatorToken.kind!==K.EqualsToken||lhs?.kind!==K.Identifier||
             program.getBinding(lhs).symbolId!==binding.symbolId||refs.some(n=>inside(n,expr.right)))continue;
          resets.push({start:expr.pos,statement:s});
        }
        if(failure){proof.refused.push({function:fn.name.name,name:local.name.name,reason:failure});continue;}
        if(!resets.length||!refs.length)continue;
        const epochs=new Map();
        for(const ref of refs){let index=0;while(index<resets.length&&resets[index].start<=ref.pos)index++;
          const group=epochs.get(index)??[];group.push(ref);epochs.set(index,group);}
        selected.push({local,symbolId:binding.symbolId,resets,epochs});
      }
      const epochs=selected.flatMap(item=>[...item.epochs].map(([index,refs])=>({item,index,refs}))).sort((a,b)=>a.refs[0].pos-b.refs[0].pos);
      for(const [ordinal,epoch]of epochs.entries()){
        const name=prefix+ordinal;epoch.name=name;
        for(const ref of epoch.refs){renamed.set(ref,name);edits.push({start:ref.pos,end:ref.pos+ref.name.length,before:ref.name,replacement:name});}
        const calls=[];for(const ref of epoch.refs)for(let p=ref.parent;p&&p!==fn.body;p=p.parent)if(p.kind===K.CallExpression){
          const i=p.arguments.findIndex(arg=>inside(ref,arg));if(i>=0)calls.push(byValueCall(p,i));
        }
        proof.records.push({function:fn.name.name,sourceSymbolId:epoch.item.symbolId,from:epoch.item.local.name.name,to:name,
          epoch:epoch.index,reset:epoch.index?epoch.item.resets[epoch.index-1].start:null,
          references:epoch.refs.map(n=>({start:n.pos,end:n.pos+n.name.length})),byValueCalls:calls,
          defaultBeforeFirstResetRetained:epoch.index===0,storesCallsAndControlFlowRetained:true});
      }
      for(const item of selected){
        const names=epochs.filter(e=>e.item===item).map(e=>e.name);
        const declarations=names.map(name=>({...item.local,name:{...item.local.name,name}}));replaced.set(item.local,declarations);
        edits.push({start:item.local.pos,end:item.local.end,before:source.slice(item.local.pos,item.local.end),replacement:names.map(n=>'int '+n+';').join('\n')});
      }
    }
    const applied=applyReversibleSourceEdits(source,edits),reparsed=parse(applied.text,'reset-lifetime-view');assert.equal(reparsed.parseDiagnostics.length,0);
    function project(n){
      if(renamed.has(n))return {...n,name:renamed.get(n)};
      if(!n||typeof n!=='object')return n;
      if(Array.isArray(n))return n.flatMap(x=>replaced.has(x)?replaced.get(x).map(project):[project(x)]);
      return Object.fromEntries(Object.entries(n).filter(([k])=>k!=='parent').map(([k,v])=>[k,project(v)]));
    }
    assert.deepEqual(shape(reparsed),shape(project(ast)),'RESET_LIFETIME_REPARSE_CHANGED_UNPLANNED_STRUCTURE');
    return {text:applied.text,proof:{...proof,viewSha256:sha(applied.text),closure,edits:applied.proof.edits,
      byteInverseVerified:applied.proof.byteInverseVerified,exactPlannedStructureVerified:true,bindingOnly:true,
      noPersistentCache:true,noRuntimeNativeOrGuiAdded:true,integerCellsOnly:true}};
  }finally{program.dispose();}
}
