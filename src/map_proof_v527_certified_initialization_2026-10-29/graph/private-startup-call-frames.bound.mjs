// Comparison only. Erase private zero-argument call frames, never their effects.
// Whole-program oracle equality remains required after the reversible projection.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.collections.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from '../model/source-function-declarations.mjs';
import {proveClosedProtocolNameAbsence} from '../analysis/protocol-name-flow.linear-terminals.mjs';
import {expressionGroupingShape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const metadata=new Set(['parent','symbol','locals','flowNode','syntaxTokens','comments']);
const clone=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(clone):Object.fromEntries(Object.entries(n).filter(([k])=>!metadata.has(k)).map(([k,v])=>[k,clone(v)]));
const shape=n=>expressionGroupingShape(clone(n));
const walk=(n,visit,owner)=>{if(n.kind===K.FunctionDeclaration)owner=n;visit(n,owner);forEachChild(n,c=>walk(c,visit,owner));};
const direct=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression.kind===K.Identifier&&!s.expression.arguments.length?s.expression:undefined;
const storageOrTransfer=new Set([K.VariableDeclaration,K.ParameterDeclaration,K.TypedefDeclaration,K.StructDeclaration,K.ReturnStatement]);
function frame(fn){
 if(!fn?.body||fn.type.kind!==K.VoidKeyword||fn.parameters.length||fn.modifiers?.length)return false;
 let unsafe=false;walk(fn.body,n=>{if(storageOrTransfer.has(n.kind))unsafe=true;});return !unsafe;
}

export function canonicalBoundPrivateStartupFrames(source,{entryPoint='InitMap',declarations=[]}={}){
 const input={fileName:'startup-frames.galaxy',sourceId:'startup-frames',text:source,owned:true,contentSha256:sha(source)};
 const program=new GalaxyProgramContext([input],{files:[input]},sha,{checks:'binding'});
 const proof={kind:'BOUND_PRIVATE_STARTUP_CALL_FRAMES',sourceSha256:sha(source),records:[],refused:[],
  entryPoint,sourceOrExportChanged:false,wholeMapAccepted:false,
  boundary:'Ordinary same-thread Galaxy business effects; private call-frame/debugger/profiler observations and resource-exhaustion limits are excluded.'};
 const unchanged=reason=>({text:source,proof:{...proof,viewSha256:sha(source),reason}});
 try{
  const ast=program.documents.get(input.fileName);program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length,0,'STARTUP_FRAME_SYNTAX');
  const groups=indexSourceFunctionDeclarations(program.documents),entryGroup=groups.get(entryPoint),entry=entryGroup?.body?.node;
  if(entryGroup?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'||!frame(entry))return unchanged('ENTRY_FRAME_NOT_CLOSED');
  const candidates=new Map(),references=new Map();
  for(const [name,g]of groups)if(name!==entryPoint&&g.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'&&frame(g.body.node)){
   candidates.set(name,g.body.node);references.set(name,[]);
  }
  walk(ast,(node,owner)=>{
   if(node.kind!==K.Identifier||!candidates.has(node.name)||node.parent?.kind===K.FunctionDeclaration&&node.parent.name===node)return;
   // Same-spelled storage or members cannot stand in for a callable binding.
   const binding=program.getBinding(node),target=canonicalSourceFunctionDeclaration(groups,program.declarationAt(node));
   if(binding.status!=='BOUND'){references.get(node.name).push({unsafe:true,reason:'UNBOUND_SAME_SPELLING_REFERENCE'});return;}
   if(target!==candidates.get(node.name))return;
   const call=node.parent,statement=call?.parent;
   references.get(node.name).push({node,owner,call,statement,unsafe:!owner||direct(statement)!==call||statement.parent!==owner.body,
    reason:'NOT_A_TOP_LEVEL_DIRECT_VOID_CALL'});
  });
  const selected=new Map();
  function collect(fn,stack=new Set()){
   assert(!stack.has(fn),'STARTUP_FRAME_RECURSION');const next=new Set([...stack,fn]);
   for(const s of fn.body.statements){const call=direct(s),name=call?.expression.name,target=candidates.get(name);if(!target)continue;
    const refs=references.get(name);if(refs.length!==1||refs[0].unsafe||refs[0].owner!==fn||refs[0].call!==call){
     proof.refused.push({function:name,reason:refs.length!==1?'CALLER_OR_REFERENCE_MULTIPLICITY':refs[0]?.reason??'BINDING_MISMATCH'});continue;
    }
    selected.set(name,target);collect(target,next);
   }
  }
  collect(entry);if(!selected.size)return unchanged('NO_CLOSED_PRIVATE_STARTUP_FRAMES');
  // The finite/affix proof covers all core name consumers and declared native
  // function-name formals, including relay callers. Unknown string flow refuses.
  const declarationAsts=declarations.map((d,i)=>parse(typeof d==='string'?d:d.text,'startup-native-'+i));
  assert(declarationAsts.every(a=>a.parseDiagnostics.length===0),'STARTUP_FRAME_NATIVE_DECLARATION_SYNTAX');
  try{proof.protocolNames=proveClosedProtocolNameAbsence([ast,...declarationAsts],[...selected.keys()]);}
  catch(error){proof.refused.push({reason:String(error.message)});return unchanged('FUNCTION_NAME_DISPATCH_NOT_CLOSED');}
  function expand(fn){
   const statements=[];
   for(const s of fn.body.statements){const call=direct(s),target=call&&selected.get(call.expression.name);
    if(target)statements.push(...expand(target));else statements.push(s);
   }return statements;
  }
  const statements=expand(entry),projection={...entry,body:{...entry.body,statements}};
  const edits=[{start:entry.pos,end:entry.end,before:source.slice(entry.pos,entry.end),replacement:printer.printNode(projection)+'\n'}];
  for(const [name,fn]of selected){
   const g=groups.get(name);for(const {node}of g.declarations)edits.push({start:node.pos,end:node.end,before:source.slice(node.pos,node.end),replacement:''});
   proof.records.push({name,bodySha256:sha(source.slice(fn.pos,fn.end)),declarations:g.declarations.length,
    onlyCaller:references.get(name)[0].owner.name.name,callSites:1,parameters:0,localDeclarations:0,returnStatements:0,
    allReferencesBound:true,callSiteIsTopLevelStatement:true,effectOrderPreserved:true});
  }
  const rewritten=applyReversibleSourceEdits(source,edits),after=parse(rewritten.text,'startup-call-frame-view');
  assert.equal(after.parseDiagnostics.length,0,'STARTUP_FRAME_VIEW_SYNTAX');
  const expected={...ast,statements:ast.statements.filter(n=>!(n.kind===K.FunctionDeclaration&&selected.has(n.name.name))).map(n=>n===entry?projection:n)};
  assert.deepEqual(shape(after),shape(expected),'STARTUP_FRAME_OTHER_AST_CHANGED');
  return {text:rewritten.text,proof:{...proof,viewSha256:sha(rewritten.text),edits:rewritten.proof.edits,
   byteInverseVerified:rewritten.proof.byteInverseVerified,allOtherAstExact:true,entryStatementCount:statements.length,
   wholeProgramOracleStillRequired:true}};
 }finally{program.dispose();}
}
