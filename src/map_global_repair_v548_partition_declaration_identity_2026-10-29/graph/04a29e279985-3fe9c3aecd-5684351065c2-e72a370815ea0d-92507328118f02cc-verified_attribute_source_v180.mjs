/** Optional source adapter for isolated historical pilots. Existing exact-SHA
 * headers remain first choice; only exact registered originals get extra data.
 */
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {verifiedAttributeSource as exactSource} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/verified_attribute_source_v153.mjs';
import {approvedHistoricalAttributeSource} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/3e5c6c66621c-4a1a6-4b6ae816188e-1bae20ec5a75a5-5dba05dd3ef69eec-approved_historical_attributes_v175.mjs';
import {readAttributes,writeAttributes} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-literal-native-v173-2026-10-05/dist/modules/map/shared/format/formats/attributes.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const cold='5eea305c245c87dbd2d986055a7d0f51caec687ea0b16308396f7495ba47fe95';
const city='7c52a0da5a2e0943ee19a533b76606ee50880aec18bec4e72a3593a65780d74c';
export async function verifiedAttributeSource(options){
 const source=await exactSource(options);if(source.used)return source;
 if(options.originalSha256===city){
  const approved=await approvedHistoricalAttributeSource({row:options.row,localizedStrings:options.localizedStrings,originalGalaxy:options.originalGalaxy});
  assert(approved.used);return {...approved,proof:{...approved.proof,attributesPolicy:'Explicitly user-approved NEW City Standard test settings; authored defaults not recovered'}};
 }
 if(options.originalSha256!==cold)return source;
 const dir='map_cold_complete_attributes_v179_2026-10-05',proofPath=dir+'/RESULT.json',proofBytes=await readFile(proofPath),p=JSON.parse(proofBytes);
 assert.equal(p.sourceArchiveSha256,options.originalSha256);assert(p.publishedGamePayloadBindingProven&&p.encryptionDefinitionsAndDefaultsPreserved);
 const bindingBytes=await readFile(p.bindingPath);assert.equal(sha(bindingBytes),p.bindingSha256);
 const b=JSON.parse(bindingBytes);assert.equal(b.originalSha256,options.originalSha256);assert.equal(b.publicationSha256,p.publicationArchiveSha256);
 assert.equal(sha(await readFile(b.original)),b.originalSha256);assert.equal(sha(await readFile(b.publication)),b.publicationSha256);
 assert.equal(sha(JSON.stringify(b.payloads)),b.payloadCensusSha256);assert.equal(sha(await readFile(p.header)),p.headerSha256);
 const xmlBytes=await readFile(dir+'/NEW_TUTORIAL_TEST_ATTRIBUTES.xml');assert.equal(sha(xmlBytes),p.newTutorialTestAttributesSha256);
 const originalXml=await readFile(dir+'/PUBLISHED_ATTRIBUTES.xml');assert.equal(sha(originalXml),p.publishedAttributesSha256);
 const xml=xmlBytes.toString('utf8'),model=readAttributes(xml),published=readAttributes(originalXml.toString('utf8'));
 assert.equal(writeAttributes(model),xml);assert.equal(model.attributes.length,6);
 for(const id of ['2','3','4','5','6'])assert.deepEqual(model.attributes.find(a=>a.id===id),published.attributes.find(a=>a.id===id));
 const labelKeys=new Set(options.localizedStrings.flatMap(l=>typeof l.gameStrings==='string'?l.gameStrings.split(/\r?\n/u).map(line=>line.slice(0,line.indexOf('='))):[]));
 for(const definition of model.attributes)assert(labelKeys.has(definition.name),'Attribute name missing from ORIGINAL localization');
 return {used:true,namespace:p.namespace,model,xml,proof:{...p,proofPath,proofSha256:sha(proofBytes),sourceKind:'PUBLISHED_GAME_PAYLOAD_BINDING_PLUS_APPROVED_NEW_MODE_DEFAULT',
  attributesPolicy:'Published crypto definitions/defaults from 799 identical game payloads; only mode 7 Tutorial is an approved NEW test override. Container hashes differ; full lobby not claimed.',
  newTestDefaults:true,sourceRevisionDefaultsRecovered:true,editorVerified:false}};
}
