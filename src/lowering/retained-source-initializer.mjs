import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from "../model/source-function-declarations.mjs";
import {parseImmutableGalaxySyntax} from "../model/immutable-galaxy-syntax.mjs";
import {SyntaxKind as K,Printer} from "../sdk/array-values/modules/galaxy/language-core/index.js";
import {startupFunctionName} from "../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
const plans=new WeakMap(),printer=new Printer(),sha=s=>createHash('sha256').update(s).digest('hex');
const body=n=>n?.kind===K.FunctionDeclaration&&n.body&&n.type.kind===K.VoidKeyword&&!n.parameters.length&&!n.modifiers?.length;
const direct=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression.kind===K.Identifier&&!s.expression.arguments.length?s.expression:undefined;

// Keep the original ordinary function when its writes cannot become GUI-owned
// variable defaults. Only its scheduling metadata moves to the existing source
// include section. No function body, wrapper, source block or Native is added.
export function retainSourceInitializer(initialization,{program,statements,libraryId}){
 if(!initialization?.customInitializerBody)return initialization;
 assert(program&&!program.closed&&libraryId==='Map','RETAINED_INIT_BOUND_MAP_REQUIRED');
 assert(!initialization.customScriptInitializers?.length&&!initialization.initialValues?.size&&!initialization.structureValues?.length,'RETAINED_INIT_UNSPLIT_PHASE_REQUIRED');
 const printed=printer.printNode(initialization.customInitializerBody),matches=statements.filter(n=>body(n)&&initialization.functions.has(n.name.name)&&printer.printNode(n.body)===printed);
 assert.equal(matches.length,1,'RETAINED_INIT_UNIQUE_PHASE_BODY');const input=matches[0],name=input.name.name;
 const reserved=new Set(['InitLib','InitLibraries','InitVariables','InitCustomScript','InitTriggers'].map(role=>startupFunctionName(libraryId,role)));
 assert(!reserved.has(name),'RETAINED_INIT_RESERVED_RUNTIME_NAME');
 const index=indexSourceFunctionDeclarations(program.documents),group=index.get(name),source=group?.body?.node;
 assert(group?.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'&&body(source)&&printer.printNode(source)===printer.printNode(input),'RETAINED_INIT_SOURCE_ABI_OR_BODY');
 const location=program.location(source),identity=program.verifiedInputIdentity(location.sourceFile);
 assert(identity?.owned===true,'RETAINED_INIT_SOURCE_NOT_OWNED');
 const root=index.get('InitMap')?.body?.node;assert(body(root),'RETAINED_INIT_ROOT_ABI');
 const calls=root.body.statements.map((s,ordinal)=>({call:direct(s),ordinal})).filter(r=>r.call&&program.getBinding(r.call.expression).status==='BOUND'&&canonicalSourceFunctionDeclaration(index,program.declarationAt(r.call.expression))===source);
 assert.equal(calls.length,1,'RETAINED_INIT_DIRECT_ROOT_CALL_REQUIRED');
 const ordinal=calls[0].ordinal,prefix=root.body.statements.slice(0,ordinal).map(direct),next=direct(root.body.statements[ordinal+1]);
 assert(prefix.length&&prefix.every(c=>c&&initialization.functions.has(c.expression.name))&&next&&initialization.functions.has(next.expression.name),'RETAINED_INIT_CANONICAL_PREFIX_SLOT');
 const functions=new Set(initialization.functions);functions.delete(name);
 const result={...initialization,functions};delete result.customInitializerBody;
 const proof={kind:'RETAINED_SOURCE_FUNCTION_INITIALIZER',name,source:location,sourceSha256:identity.contentSha256,
  functionSha256:sha(printer.printNode(source)),rootSha256:sha(printer.printNode(root)),originalRootOrdinal:ordinal,
  originalNextPhase:next.expression.name,newNative:0,newRuntimeFunctions:0,newCustomScriptSections:0,
  sourceFunctionStillRequired:true,wholePhaseAccepted:false,wholeMapAccepted:false};
 result.retainedSourceInitializerProof=proof;
 plans.set(result,{program,source,root,proof:structuredClone(proof),inputIncludes:new Set(statements.filter(n=>n.kind===K.IncludeStatement).map(n=>printer.printNode(n).trim()))});
 return result;
}

export function attachRetainedSourceInitializer(initialization,{program,elements,funcNameToFuncDef,libraryId}){
 const plan=plans.get(initialization);if(!plan){assert(!initialization?.retainedSourceInitializerProof,'RETAINED_INIT_UNTRUSTED_PLAN');return;}
 assert(plan.program===program&&!program.closed&&libraryId==='Map','RETAINED_INIT_PLAN_CONTEXT');
 assert.equal(sha(printer.printNode(plan.source)),plan.proof.functionSha256,'RETAINED_INIT_SOURCE_CHANGED');
 assert.equal(sha(printer.printNode(plan.root)),plan.proof.rootSha256,'RETAINED_INIT_ROOT_CHANGED');
 const identity=program.verifiedInputIdentity(plan.proof.source.sourceFile);assert.equal(identity?.contentSha256,plan.proof.sourceSha256,'RETAINED_INIT_IDENTITY_CHANGED');
 const definition=funcNameToFuncDef.get(plan.proof.name);
 assert(definition?.type==='FunctionDef'&&definition.library===libraryId&&elements[definition.id]===definition,'RETAINED_INIT_GUI_FUNCTION_REQUIRED');
 assert((definition.identifier??definition.name)===plan.proof.name&&definition.flags?.includes('NoScriptPrefix')&&
  !definition.flags.some(f=>['Native','Operator','CreateThread','Event','SubFunctions','Template','Inline'].includes(f))&&
  !definition.disabled&&!definition.scriptCode&&!definition.expressionCode&&!definition.parameters?.length&&
  (definition.returnType?.type??'void')==='void','RETAINED_INIT_GUI_FUNCTION_ABI');
 const sections=Object.values(elements).filter(e=>e.type==='CustomScript'&&!e.disabled&&e.library===libraryId);
 assert(!sections.some(e=>e.initFunc),'RETAINED_INIT_EXISTING_SCHEDULE');
 const candidates=sections.filter(e=>{
  if(e.flags?.length||e.expressionCode||typeof e.scriptCode!=='string'||!e.scriptCode.trim())return false;
  const ast=parseImmutableGalaxySyntax(e.scriptCode,'retained-initializer-include.galaxy');
  return !ast.parseDiagnostics.length&&ast.statements.length>0&&ast.statements.every(n=>n.kind===K.IncludeStatement&&plan.inputIncludes.has(printer.printNode(n).trim()));
 });
 assert.equal(candidates.length,1,'RETAINED_INIT_EXISTING_SOURCE_INCLUDE_REQUIRED');
 const section=candidates[0],codeSha256=sha(section.scriptCode);section.initFunc=plan.proof.name;
 return {...plan.proof,section:{library:libraryId,type:'CustomScript',id:section.id,scriptCodeSha256:codeSha256},
  target:{library:libraryId,type:'FunctionDef',id:definition.id},existingSourceCodeChanged:false,actualMapNativeExportStillRequired:true};
}
