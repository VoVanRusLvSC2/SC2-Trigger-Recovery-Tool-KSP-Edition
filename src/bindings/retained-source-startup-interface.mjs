import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createSourceProvidedTypedFunctionDescription} from "../gui/source-provided-nominal-interfaces.mjs";
import {SyntaxKind as K} from "../sdk/array-values/modules/galaxy/language-core/index.js";
const issued=new WeakMap(),sha=s=>createHash('sha256').update(s).digest('hex');
function original(program,node,primaryFileName){
 const location=program.location(node),input=program.verifiedInputIdentity(location?.sourceFile),ast=program.documents.get(location?.sourceFile);
 assert(input?.owned===true&&input.contentSha256===sha(ast?.text??'')&&ast?.statements.includes(node),'SOURCE_STARTUP_VERIFIED_OWNER_REQUIRED');
 assert(location.sourceFile!==primaryFileName,'SOURCE_STARTUP_RETAINED_INCLUDE_REQUIRED');
 assert(node.kind===K.FunctionDeclaration&&node.body&&node.type.kind===K.VoidKeyword&&!node.parameters.length&&!node.modifiers?.length,
  'SOURCE_STARTUP_VOID_ZERO_BODY_REQUIRED');
 return {fileName:location.sourceFile,text:ast.text,sha256:input.contentSha256};
}

/** Metadata for an existing included function, never a new runtime helper.
 * The normal source-closure GUI gate still independently qualifies the call. */
export function createRetainedSourceStartupInterface({program,declaration,primaryFileName,library,allocate,existingIdentities}){
 const source=original(program,declaration,primaryFileName);
 const description=createSourceProvidedTypedFunctionDescription({program,source,symbol:declaration.name.name,library,allocate,existingIdentities});
 assert.equal(description.parameters.length,0);
 issued.set(description.definition,{program,declaration,primaryFileName,source,snapshot:JSON.stringify(description.definition)});
 return description;
}
export function isRetainedSourceStartupInterface(definition,{program,declaration}){
 const record=issued.get(definition);if(!record||record.program!==program||record.declaration!==declaration)return false;
 assert.equal(JSON.stringify(definition),record.snapshot,'SOURCE_STARTUP_INTERFACE_CHANGED');
 const current=original(program,declaration,record.primaryFileName);
 assert.equal(current.sha256,record.source.sha256,'SOURCE_STARTUP_SOURCE_CHANGED');return true;
}
