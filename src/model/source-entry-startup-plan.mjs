import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from "./source-function-declarations.mjs";
import {planSourceInitializerWeave} from "../lowering/source-initializer-weave.mjs";
import {readStringLiteralValue} from "../types/string-literal-value.mjs";
import {SyntaxKind as K,Printer,forEachChild} from "../sdk/array-values/modules/galaxy/language-core/index.js";
const plans=new WeakMap(),sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const voidZero=n=>n?.kind===K.FunctionDeclaration&&n.body&&n.type.kind===K.VoidKeyword&&!n.parameters.length&&!n.modifiers?.length;
const direct=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression.kind===K.Identifier&&!s.expression.arguments.length?s.expression:undefined;
const astSha=n=>sha(printer.printNode(n));

/** Discover the constructor phase by bound source call ownership. No source name
 * or entry-length convention is used. Prefix and suffix statements remain exact
 * obligations: this plan alone cannot remove them or authorize GUI emission. */
export function planSourceEntryStartup({program,fileName,entryPoint='InitMap',automaticConstructors}){
 assert(program?.documents instanceof Map&&!program.closed,'ENTRY_PLAN_BOUND_PROGRAM_REQUIRED');
 assert(Array.isArray(automaticConstructors)&&automaticConstructors.length&&new Set(automaticConstructors).size===automaticConstructors.length,'ENTRY_PLAN_CONSTRUCTOR_SET');
 const index=indexSourceFunctionDeclarations(program.documents),entryGroup=index.get(entryPoint),entry=entryGroup?.body?.node;
 assert(entryGroup?.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'&&voidZero(entry)&&entryGroup.body.fileName===fileName,'ENTRY_PLAN_UNIQUE_VOID_ROOT');
 const sourceNames=new Set(automaticConstructors),constructors=new Map(),callSites=[],files=[];
 for(const name of automaticConstructors){const group=index.get(name);assert(group?.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'&&voidZero(group.body.node),'ENTRY_PLAN_CONSTRUCTOR_ABI');constructors.set(group.body.node,name);}
 for(const [sourceFile,ast]of program.documents){
  const identity=program.verifiedInputIdentity(sourceFile);assert(identity?.contentSha256===sha(ast.text),'ENTRY_PLAN_SOURCE_IDENTITY');
  files.push({sourceFile,sha256:identity.contentSha256});
  function visit(node,owner){
   if(node.kind===K.FunctionDeclaration)owner=node;
   if(node.kind===K.StringLiteral){const value=readStringLiteralValue(node.text);assert(value,'ENTRY_PLAN_STRING_LITERAL');
    assert(!value.value.split(/[^A-Za-z0-9_]+/u).some(name=>sourceNames.has(name)),'ENTRY_PLAN_CONSTRUCTOR_NAME_OBSERVER');}
   if(node.kind===K.Identifier&&sourceNames.has(node.name)&&!(node.parent?.kind===K.FunctionDeclaration&&node.parent.name===node)){
    assert.equal(program.getBinding(node).status,'BOUND','ENTRY_PLAN_CONSTRUCTOR_REFERENCE_UNBOUND');
    const target=canonicalSourceFunctionDeclaration(index,program.declarationAt(node));
    if(constructors.has(target)){
     const call=node.parent;assert(call?.kind===K.CallExpression&&call.expression===node&&!call.arguments.length,'ENTRY_PLAN_ESCAPING_CONSTRUCTOR');
     assert(owner?.body,'ENTRY_PLAN_CONSTRUCTOR_OUTSIDE_FUNCTION');callSites.push({owner,target,call});
    }
   }
   forEachChild(node,n=>visit(n,owner));
  }
  visit(ast);
 }
 assert.equal(callSites.length,constructors.size,'ENTRY_PLAN_CONSTRUCTOR_CALL_MULTIPLICITY');
 assert.equal(new Set(callSites.map(r=>r.target)).size,constructors.size,'ENTRY_PLAN_CONSTRUCTOR_CALL_COVERAGE');
 const owners=[...new Set(callSites.map(r=>r.owner))];assert.equal(owners.length,1,'ENTRY_PLAN_MULTIPLE_CONSTRUCTOR_PHASES');
 const phase=owners[0],phaseGroup=index.get(phase.name.name);assert(voidZero(phase)&&phase!==entry,'ENTRY_PLAN_PHASE_ABI');
 const entryCalls=entry.body.statements.map((s,position)=>({call:direct(s),position})).filter(r=>r.call&&program.getBinding(r.call.expression).status==='BOUND'&&canonicalSourceFunctionDeclaration(index,program.declarationAt(r.call.expression))===phase);
 assert.equal(entryCalls.length,1,'ENTRY_PLAN_PHASE_NOT_DIRECTLY_SCHEDULED');const anchor=entryCalls[0].position;
 const phaseRefs=[];
 for(const ast of program.documents.values()){
  function visit(node){
   if(node.kind===K.StringLiteral){const value=readStringLiteralValue(node.text);assert(value,'ENTRY_PLAN_STRING_LITERAL');
    assert(!value.value.split(/[^A-Za-z0-9_]+/u).includes(phase.name.name),'ENTRY_PLAN_PHASE_NAME_OBSERVER');}
   if(node.kind===K.Identifier&&node.name===phase.name.name&&!(node.parent?.kind===K.FunctionDeclaration&&node.parent.name===node)){
    assert.equal(program.getBinding(node).status,'BOUND','ENTRY_PLAN_PHASE_REFERENCE_UNBOUND');
    if(canonicalSourceFunctionDeclaration(index,program.declarationAt(node))===phase)phaseRefs.push(node.parent);
   }
   forEachChild(node,visit);
  }
  visit(ast);
 }
 assert(phaseRefs.length===1&&phaseRefs[0]===entryCalls[0].call,'ENTRY_PLAN_PHASE_HAS_OTHER_CALLER');
 const targets=new Map(),ordered=phase.body.statements.map(s=>{const call=direct(s);assert(call,'ENTRY_PLAN_PHASE_NON_DIRECT_EFFECT');
  assert.equal(program.getBinding(call.expression).status,'BOUND','ENTRY_PLAN_PHASE_TARGET_UNBOUND');
  const target=canonicalSourceFunctionDeclaration(index,program.declarationAt(call.expression));assert(voidZero(target),'ENTRY_PLAN_PHASE_TARGET_ABI');targets.set(target,astSha(target));return target.name.name;
 });
 const automatic=ordered.filter(name=>sourceNames.has(name));assert.equal(automatic.length,constructors.size,'ENTRY_PLAN_PHASE_COVERAGE');
 const partition=planSourceInitializerWeave({program,fileName:phaseGroup.body.fileName,phaseName:phase.name.name,automaticNames:automatic});
 const describe=node=>({source:program.location(node),astSha256:astSha(node),kind:node.kind});
 const proof={kind:'BOUND_SOURCE_ENTRY_STARTUP_SCHEDULE',entry:describe(entry),phase:describe(phase),entryPoint,phaseName:phase.name.name,
  sourcePhaseAnchor:anchor,prefix:entry.body.statements.slice(0,anchor).map(describe),suffix:entry.body.statements.slice(anchor+1).map(describe),
  automaticConstructors:automatic,allPhaseCalls:partition.proof.calls,partition:partition.proof,
  entryOperatorCount:entry.body.statements.length,phaseCallCount:ordered.length,files,
  originalSourceChanged:false,unrepresentedSourceEffectsMayBeDropped:false,guiEmissionAuthorized:false,wholeMapAccepted:false};
 const capability=Object.freeze({kind:proof.kind});plans.set(capability,{program,entry,phase,targets,proof:structuredClone(proof)});
 return {capability,proof};
}

export function readSourceEntryStartup(capability,program){
 const state=plans.get(capability);assert(state&&state.program===program&&!program.closed,'ENTRY_PLAN_UNTRUSTED_CAPABILITY');
 for(const f of state.proof.files)assert.equal(sha(program.documents.get(f.sourceFile)?.text??''),f.sha256,'ENTRY_PLAN_SOURCE_CHANGED');
 assert.equal(astSha(state.entry),state.proof.entry.astSha256,'ENTRY_PLAN_ENTRY_AST_CHANGED');
 assert.equal(astSha(state.phase),state.proof.phase.astSha256,'ENTRY_PLAN_PHASE_AST_CHANGED');
 for(const [node,digest]of state.targets)assert.equal(astSha(node),digest,'ENTRY_PLAN_TARGET_AST_CHANGED');
 return structuredClone(state.proof);
}
