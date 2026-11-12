import assert from 'node:assert/strict';
import {logicalSourcePath} from '../model/source-ownership.mjs';
import {indexPreservedSourceFunctions,checkPreservedSourceFunctionInterface} from '../bindings/preserved-source-function-contract.scoped-carriers.mjs';
import {indexSourceFunctionDeclarations} from '../model/source-function-declarations.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

export function indexRetainedSourceStartupGuiActions(input){
 return indexPreservedSourceFunctions({root:{fileName:'MapScript.galaxy',text:[input.header,input.script].filter(Boolean).join('\n')},
  ownedSources:input.additionalScripts??[],externalSources:input.galaxyDeclarations??[],includeEvidence:input.includeEvidence});
}

/** Reconstruct source ownership and ABI from the supplied sources and serialized
 * GUI. No live emitter capability or converter receipt authorizes this action. */
export function verifyRetainedSourceStartupGuiAction({index,target,elements,library,program}){
 assert.deepEqual([...(target.flags??[])].sort(),['Action','NoScriptPrefix','Operator'],'INITIALIZER_SOURCE_INTERFACE_FLAGS');
 const proof=checkPreservedSourceFunctionInterface(index,target,elements,library);
 assert(proof.returnType==='void'&&!proof.parameters.length,'INITIALIZER_SOURCE_INTERFACE_VOID_ZERO');
 const group=indexSourceFunctionDeclarations(program.documents).get(proof.name);
 assert.equal(group?.status,'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES','INITIALIZER_SOURCE_INTERFACE_UNIQUE_BODY');
 const node=group.body.node,location=program.location(node),input=program.verifiedInputIdentity(location?.sourceFile);
 assert(node.kind===K.FunctionDeclaration&&node.body&&input?.owned===true,'INITIALIZER_SOURCE_INTERFACE_OWNED_BODY');
 assert.equal(logicalSourcePath(location.sourceFile),proof.owner,'INITIALIZER_SOURCE_INTERFACE_EXACT_OWNER');
 assert.equal(input.contentSha256,proof.sourceSha256,'INITIALIZER_SOURCE_INTERFACE_EXACT_REVISION');
 return {...proof,kind:'INDEPENDENT_RETAINED_SOURCE_STARTUP_GUI_ACTION',converterCapabilityUsed:false,newRuntimeFunctions:0};
}
