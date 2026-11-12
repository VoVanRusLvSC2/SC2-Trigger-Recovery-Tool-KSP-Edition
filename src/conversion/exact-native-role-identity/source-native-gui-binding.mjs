import assert from 'node:assert/strict';
import {declaredCarrier} from "../../ast/galaxy-program-context.identity.mjs";
import {SyntaxKind as K} from "../../sdk/array-values/modules/galaxy/language-core/index.js";

// Declaration-stage ABI bindings belong to one recovery session. A later GUI
// ancestor must not turn an explicit native call into an editor-local AUTOVAR.
// The descriptor must call the exact source symbol; no name/suffix table
// or new Native description is introduced here.
const bindings=new WeakMap();
const native=node=>node?.kind===K.FunctionDeclaration&&!node.body&&node.modifiers?.length===1&&node.modifiers[0].kind===K.NativeKeyword;
const contextual=definition=>/^\s*#AUTOVAR\([^,]+,\s*ancestor:[^()]+\)\s*$/u.test(definition?.scriptCode??'');
export function registerSourceNativeGuiBinding(session,source,definition){
 if(!session||!native(source)||source.parameters.length||!definition?.flags?.includes('Native')||definition.scriptCode||definition.disabled)return false;
 if(definition.name!==source.name.name||definition.identifier&&definition.identifier!==source.name.name)return false;
 const owner=session.candidates.libraries.get(definition.library),actual=owner?.elementsByType?.FunctionDef?.[definition.id];
 if(actual!==definition)return false;
 const abi={returnType:declaredCarrier(source.type),parameters:[]};
 const target=session.candidates.resolve({name:definition.name,libraryId:owner.id,guiUse:'value',declaration:abi});
 if(target.status!=='RESOLVED'||target.definition!==definition)return false;
 const declarations=session.program.globals.get(source.name.name)?.declarations??[],qualified=[],identities=[];
 for(const node of declarations){
  if(!native(node)||node.parameters.length||declaredCarrier(node.type)!==abi.returnType)return false;
  let file=node;while(file.parent)file=file.parent;
  const identity=session.program.verifiedInputIdentity(file.fileName);
  if(!identity||identity.owned!==false)return false;
  qualified.push(node);identities.push({fileName:file.fileName,sha256:identity.contentSha256,start:node.pos,end:node.end});
 }
 if(!qualified.length)return false;
 const records=bindings.get(session)??new Map(),previous=records.get(source.name.name);
 assert(!previous||previous.definition===definition,'SOURCE_NATIVE_GUI_BINDING_CONFLICT');
 records.set(source.name.name,{definition,declarations:new Set(qualified),proof:{kind:'DECLARATION_QUALIFIED_NATIVE_GUI_VALUE_BINDING',
  sourceSymbol:source.name.name,sourceDeclarations:identities,gui:{library:owner.id,type:'FunctionDef',id:definition.id},abi,
  exactSourceApiIdentity:true,newNativeDescriptions:0,newRuntimeFunctions:0,newCustomScript:0}});
 bindings.set(session,records);return true;
}
export function preserveSourceNativeGuiBinding(session,call,ctx,use,resolution){
 if(use!=='value'||call.expression?.kind!==K.Identifier||call.arguments?.length||resolution.status==='AMBIGUOUS')return resolution;
 const record=bindings.get(session)?.get(call.expression.name);if(!record)return resolution;
 if(resolution.status==='RESOLVED'&&!contextual(resolution.definition))return resolution;
 const source=session.program.declarationAt(call.expression);
 if(!record.declarations.has(source)||session.program.getBinding(call.expression).status!=='BOUND')return resolution;
 return {...resolution,status:'RESOLVED',definition:record.definition,candidateKeys:[`${record.definition.library}:FunctionDef:${record.definition.id}`],
  sourceNativeGuiBinding:record.proof};
}
