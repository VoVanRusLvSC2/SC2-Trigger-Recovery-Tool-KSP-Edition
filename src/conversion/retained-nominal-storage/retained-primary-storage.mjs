import {planRetainedNominalDeclarations} from "../../bindings/retained-nominal-declarations.mjs";
import {planPrimarySourcePrototypes} from "../../model/primary-source-prototypes.mjs";
import assert from 'node:assert/strict';
import {verifyRetainedSourcePrimaryBindings} from "../../verification/retained-source-primary-bindings.mjs";
import {planPassivePrimarySourceStorage,verifyPassivePrimarySourceStorage,passivePrimaryStorageKind} from "../minimal-primary-source-storage/passive-primary-source-storage.mjs";
import {SyntaxKind as K} from "../../sdk/array-values/modules/galaxy/language-core/index.js";
export {passivePrimaryStorageKind,verifyPassivePrimarySourceStorage};

/** Retain only source-observed names or original static linkage that GUI cannot emit.
 * Other primary primitive storage remains in GUI. Static ownership is checked
 * in standalone source too; no executable body or initializer is synthesized. */
export function appendRetainedPrimaryStorage(input,policy,legacy){
 if(!policy.preserveAuthoredCode||input.existingTriggerData?.trim())return legacy;
 const source=[input.header,input.script].filter(Boolean).join('\n');
 const bindings=verifyRetainedSourcePrimaryBindings(input,source);
 assert(bindings.passed,'ORIGINAL_SOURCE_PRIMARY_BINDINGS_UNPROVED');
 const names=new Set(bindings.records.filter(r=>r.declarationKind===K.VariableDeclaration).map(r=>r.name));
 const passive=planPassivePrimarySourceStorage(input,names).filter(s=>!legacy.some(l=>l.fileName===s.fileName&&l.start<s.end&&s.start<l.end));
 for(const section of passive)verifyPassivePrimarySourceStorage(input,section);
 const nominal=planRetainedNominalDeclarations(input);
 const prototypes=planPrimarySourcePrototypes(input).filter(s=>![...legacy,...passive,...nominal].some(l=>l.fileName===s.fileName&&l.start<s.end&&s.start<l.end));
 const result=[...legacy,...passive,...nominal,...prototypes];
 if(legacy.closure)Object.defineProperty(result,'closure',{value:legacy.closure});
 return result;
}

/** Replay against separately read actual GUI. Only exact, passive original
 * declaration text qualifies; executable fallback and initializer hooks fail. */
export function verifyRetainedPrimaryStorageGui(input,section,libraries){
 const origin=verifyPassivePrimarySourceStorage(input,section),library=libraries.get(section.library);
 assert(library,'PASSIVE_PRIMARY_GUI_LIBRARY');
 const xml=s=>s.replace(/\r\n?/gu,'\n'),matches=[...new Set(Object.values(library.elements))].filter(e=>e.type==='CustomScript'&&typeof e.scriptCode==='string'&&xml(e.scriptCode)===xml(section.code));
 assert.equal(matches.length,1,'PASSIVE_PRIMARY_GUI_UNIT_MISSING_OR_DUPLICATED');
 const element=matches[0];assert.equal(element.library,section.library,'PASSIVE_PRIMARY_GUI_OWNER');
 assert(!element.disabled&&!element.flags?.length&&!element.initFunc&&element.expressionCode===undefined,'PASSIVE_PRIMARY_GUI_EXECUTABLE_METADATA');
 return {...origin,library:element.library,type:element.type,id:element.id,declarations:section.declarations.length,newRuntimeFunctions:0,newInitializationActions:0};
}
