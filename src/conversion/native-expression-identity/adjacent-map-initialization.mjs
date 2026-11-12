// Combine adjacent, private initialization stages in the recognition view only.
// The existing initializer validator must accept every assignment/array fill.
// No source function, include or runtime statement is dropped by name/fixture.
import {SyntaxKind as K,forEachChild} from "../exact-function-signatures/index-alternate-3.js";
import {parseImmutableGalaxySyntax} from "../exact-function-signatures/immutable-galaxy-syntax.collections.mjs";
import {proveProtocolNameAbsenceWithStringShapes as proveClosedProtocolNameAbsence} from "./protocol-name-string-shapes.mjs";
const skipped=new Set(['parent','symbol','locals','flowNode']);
function clone(n,rename=new Map()) {
  if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(x=>clone(x,rename));
  const result=Object.fromEntries(Object.entries(n).filter(([k])=>!skipped.has(k)).map(([k,v])=>[k,clone(v,rename)]));
  if(n.kind===K.Identifier&&rename.has(n.name))result.name=rename.get(n.name);
  return result;
}
function walk(n,fn,parent){if(!n)return;fn(n,parent);forEachChild(n,c=>walk(c,fn,n));}
const plain=f=>f?.kind===K.FunctionDeclaration&&f.body&&f.parameters.length===0&&f.type.kind===K.VoidKeyword&&!f.modifiers?.length;
const direct=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression?.kind===K.Identifier&&s.expression.arguments.length===0?s.expression:undefined;
class Refusal extends Error {}
const check=(v,s)=>{if(!v)throw new Refusal(s);};

export function recognizeAdjacentMapInitialization(nodes,libraryId,validate,typeName,recognizeAliases,{externalSources,onProof}={}) {
  if(libraryId!=='Map'||!Array.isArray(externalSources))return;
  const roots=nodes.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name==='InitMap'&&n.body);
  if(roots.length!==1||!plain(roots[0])||roots[0].body.statements.length!==4)return;
  const root=roots[0],calls=root.body.statements.map(direct);if(calls.some(c=>!c))return;
  const names=calls.map(c=>c.expression.name);if(new Set(names).size!==4)return;
  const extraName=names[2],previousName=names[1];
  const report={kind:'ADJACENT_PRIVATE_INITIALIZATION_STAGES',status:'REFUSED',sourceStages:names,extraStage:extraName,
    originalSourceChanged:false,newRuntimeFunctions:0,newNativeDefinitions:0,wholeProgramEquivalenceProved:false};
  try {
    const definitions=name=>nodes.filter(n=>n.name?.name===name),ds=definitions(extraName),extra=ds.find(n=>n.body),previousDeclarations=definitions(previousName),previous=previousDeclarations.filter(n=>n.body);
    check(ds.length>=1&&ds.length<=2&&ds.filter(n=>n.body).length===1&&plain(extra),'EXTRA_STAGE_UNIQUE_PLAIN_VOID');
    check(ds.every(n=>n.kind===K.FunctionDeclaration&&n.parameters.length===0&&n.type.kind===K.VoidKeyword&&!n.modifiers?.length),'EXTRA_STAGE_SIGNATURE');
    check(previous.length===1&&previousDeclarations.length<=2&&previousDeclarations.every(n=>n.kind===K.FunctionDeclaration&&n.parameters.length===0&&n.type.kind===K.VoidKeyword&&!n.modifiers?.length),'PREVIOUS_STAGE_SIGNATURE');
    const external=externalSources.map((s,i)=>{const a=parseImmutableGalaxySyntax(s.text,s.fileName??'stage-external-'+i);check(!a.parseDiagnostics.length,'STAGE_EXTERNAL_SYNTAX');return a;});
    const own={kind:K.SourceFile,statements:nodes},allowedDeclarations=new Set([...ds,...previousDeclarations].map(n=>n.name));
    for(const ast of [own,...external])walk(ast,(n,p)=>{
      if(n.kind!==K.Identifier||![extraName,previousName].includes(n.name))return;
      if(allowedDeclarations.has(n))return;
      // Compatible foreign prototypes do not execute or expose the stage.
      if(p?.kind===K.FunctionDeclaration&&p.name===n&&!p.body&&p.type.kind===K.VoidKeyword&&!p.parameters.length&&!p.modifiers?.length)return;
      const entryCall=calls[n.name===extraName?2:1];
      check(n===entryCall.expression&&p===entryCall,'INITIALIZATION_STAGE_REFERENCE_ESCAPES');
    });
    const protocol=proveClosedProtocolNameAbsence([own,...external],new Set([extraName,previousName]));
    walk(previous[0].body,n=>check(![K.ReturnStatement,K.BreakpointStatement].includes(n.kind),'PREVIOUS_STAGE_EARLY_EXIT'));
    const localDeclarations=[];let prefix=true;
    for(const s of extra.body.statements){if(prefix&&s.kind===K.VariableDeclaration)localDeclarations.push(s);else prefix=false;}
    const globals=new Set(nodes.filter(n=>n.kind===K.VariableDeclaration).map(n=>n.name.name)),allNames=new Set();
    walk(own,n=>{if(n.kind===K.Identifier)allNames.add(n.name);});
    check(localDeclarations.every(n=>typeName(n.type)==='int'&&!n.initializer&&!n.modifiers?.length&&!globals.has(n.name.name)),'EXTRA_STAGE_LOCAL_DECLARATIONS');
    const localSet=new Set(localDeclarations);
    walk(extra.body,n=>{
      check(![K.CallExpression,K.ReturnStatement,K.BreakStatement,K.ContinueStatement,K.BreakpointStatement,K.PropertyAccessExpression].includes(n.kind),'EXTRA_STAGE_NON_INITIALIZATION_EFFECT');
      if(n.kind===K.VariableDeclaration)check(localSet.has(n),'EXTRA_STAGE_NESTED_LOCAL');
    });
    const renames=new Map();let counter=0;
    for(const d of localDeclarations){check(!renames.has(d.name.name),'EXTRA_STAGE_LOCAL_COLLISION');let name;do{name='adjacentInitCounter'+counter++;}while(allNames.has(name));renames.set(d.name.name,name);allNames.add(name);}
    const projected=clone(nodes),projectedRoot=projected.find(n=>n.kind===K.FunctionDeclaration&&n.name.name==='InitMap'&&n.body),projectedPrevious=projected.find(n=>n.kind===K.FunctionDeclaration&&n.name.name===previousName&&n.body);
    const oldBody=projectedPrevious.body.statements;let at=0;while(oldBody[at]?.kind===K.VariableDeclaration)at++;
    const tail=extra.body.statements.slice(localDeclarations.length);
    projectedPrevious.body.statements=[...oldBody.slice(0,at),...localDeclarations.map(n=>clone(n,renames)),...oldBody.slice(at),...tail.map(n=>clone(n,renames))];
    projectedRoot.body.statements.splice(2,1);
    const merged=projected.filter(n=>!(n.kind===K.FunctionDeclaration&&n.name.name===extraName));
    const result=validate(merged)??recognizeAliases(merged,libraryId,validate,typeName);
    check(result,'COMBINED_STAGE_REJECTED_BY_EXISTING_INITIALIZER_VALIDATOR');
    check(!result.customInitializerBody&&!result.customScriptInitializers?.length,'COMBINED_STAGE_STILL_REQUIRES_RAW_INITIALIZATION');
    report.status='PROVED';report.localRenames=[...renames];report.protocol=protocol;
    report.originalStatementCounts={previous:previous[0].body.statements.length,extra:extra.body.statements.length};
    report.initializedVariables=[...(result.initialValues?.keys()??[])];report.executionOrderPreserved=true;report.noCallsOrEarlyExitsInExtraStage=true;
    onProof?.(report);
    return {...result,functions:new Set([...result.functions,extraName]),adjacentStartupFusion:report};
  }catch(error){if(!(error instanceof Refusal))report.reason=String(error.message);else report.reason=error.message;onProof?.(report);return;}
}
