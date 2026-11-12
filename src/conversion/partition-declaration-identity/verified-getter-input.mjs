import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {deriveVerifiedGetterHeader} from "./verified-getter-header.mjs";
import {parseTriggerXmlSync} from "../implicit-gui-localization/sax-reader.mjs";
const W='K:/SC2_MAP_Workspace/sc2_editor_C++',proofPath=W+'/trigger_ast_implementation_2026-10-07/runs/EDITOR98310_GETTER_ALIAS_PROOF_v1626.json',proofSha256='c8e982948cdd27965367d7982e1d85b4b61b506bcc81217c312f1d0464d213a4',sha=b=>createHash('sha256').update(b).digest('hex');
export async function deriveGetterInput({sourceText,declarations,documents,missingSymbols}){
 const proofBytes=await readFile(proofPath);assert.equal(sha(proofBytes),proofSha256,'Operation evidence changed');const proof=JSON.parse(proofBytes),editorSha256=sha(await readFile(proof.identity.exe));
 const libraries=new Map();for(const doc of documents)for(const [id,library] of parseTriggerXmlSync(doc.triggerData)){assert(!libraries.has(id),'Loaded library owner is ambiguous: '+id);libraries.set(id,library);}
 const sources=declarations.map(d=>({...d,contentSha256:sha(d.text)}));
 const derived=deriveVerifiedGetterHeader({sourceText,missingSymbols,declarations:sources,libraries,proofText:proofBytes.toString('utf8'),proofContentSha256:proofSha256,expectedProofContentSha256:proofSha256,actualEditorSha256:editorSha256,hashText:sha});
 return {fileName:'VerifiedNativeGetterAlias.galaxy',text:derived.text,contentSha256:sha(derived.text),provenance:{originalSourceSha256:sha(sourceText),proofPath,proofSha256,editorPath:proof.identity.exe,editorSha256,sourceMaterials:sources.map(d=>({fileName:d.fileName,contentSha256:d.contentSha256})),libraryMaterials:documents.map(d=>({sourcePath:d.sourcePath,contentSha256:sha(d.triggerData)})),evidence:derived.evidence,owned:false,rawSourceCallNamesChanged:false,guiDefinitionsCreated:0}};
}
export async function verifyGetterInput({sourceText,declarations,documents,derivedInput,provenance}){
 assert.equal(derivedInput.fileName,'VerifiedNativeGetterAlias.galaxy');const missingSymbols=provenance.evidence.map(e=>e.alias),actual=await deriveGetterInput({sourceText,declarations,documents,missingSymbols});
 assert.equal(derivedInput.text,actual.text,'Derived getter header text changed');assert.deepEqual(provenance,actual.provenance,'Getter header provenance changed');return actual;
}
