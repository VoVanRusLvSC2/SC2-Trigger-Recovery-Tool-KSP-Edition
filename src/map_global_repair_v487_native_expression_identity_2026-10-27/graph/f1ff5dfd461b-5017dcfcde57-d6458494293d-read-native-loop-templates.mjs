import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {readAuthoredTriggerDocument} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/read_authored_trigger_document_v1632.mjs";
import {deriveNativeLoopTemplatePreserver} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/ea5773d84e1a-native-loop-template-shapes.mjs";
import {templateMacros} from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/d5734da0691b-56a9139d7536-a7e6f1fe81bc-cf5412e476e04e5a-balanced-script-template.mjs";
export async function readNativeTemplateLoopPreserver(prepared,sdk){
 const inputs=prepared.dependencyInputs.filter(d=>d.group==='NativeLib');assert.equal(inputs.length,1,'NATIVE_TEMPLATE_OWNER_AMBIGUOUS');
 const input=inputs[0].triggerData,b=await readFile(input.path),sha256=createHash('sha256').update(b).digest('hex');assert.equal(sha256,input.sha256,'NATIVE_TEMPLATE_INPUT_CHANGED');
 const {document}=await readAuthoredTriggerDocument(b.toString('utf8'),sdk);assert.equal(document.libraries.size,1);const library=document.libraries.get('Ntve');assert(library);
 const result=deriveNativeLoopTemplatePreserver(library,{macros:templateMacros});result.proof.input={path:input.path,sha256};return result;
}
