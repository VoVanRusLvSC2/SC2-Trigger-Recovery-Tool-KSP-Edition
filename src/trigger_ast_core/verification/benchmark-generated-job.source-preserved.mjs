// Add attribute evidence to the existing offline benchmark; never replace its
// verdict or run Editor. The user's 304 benchmark assets remain untouched.
import assert from 'node:assert/strict';
import {readFile,writeFile,stat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readAttributeArchiveInputs} from './attribute-archive-inputs.mjs';
import {explainUndeclaredAttributeTokens} from './attribute-source-diagnostics.mjs';
import {readAttributes} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/map/shared/format/formats/attributes.js';
const [job,out]=process.argv.slice(2);assert(job&&out,'job and fresh report directory required');
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/u,''));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const previous=fileURLToPath(new URL('./benchmark-generated-source-job.mjs',import.meta.url));
const previousSha='0798677cc33477d2bbb46e5bade72b90a39eac0bbb8a510d5374eed58c3cd0f1';
assert.equal(sha(await readFile(previous)),previousSha);
assert.equal(await stat(path.join(out,'BENCHMARK.json')).then(()=>true,e=>{if(e.code==='ENOENT')return false;throw e;}),false,'Never replace an existing benchmark');
await promisify(execFile)(process.execPath,[previous,job,out],{cwd:fileURLToPath(new URL('../../',import.meta.url)),windowsHide:true,maxBuffer:4*1024**2});
const primary=await read(path.join(out,'BENCHMARK.json')),result=await read(path.join(job,'RESULT.json'));
assert.equal(result.variants.length,1);const variant=result.variants[0];assert(variant.attributeContract);
// Bind the stored attribute audit to the same packed map now read by the
// independent benchmark, including Triggers and DocumentInfo, not just Attributes.
assert.equal(primary.candidateSha256,variant.candidateSha256,'ATTRIBUTE_AUDIT_CANDIDATE_CHANGED');
const bytes=await readFile(variant.attributeContract.path);assert.equal(sha(bytes),variant.attributeContract.sha256);
const attributes=JSON.parse(bytes),cfg=await read(path.join(job,'config.json'));
assert.equal(attributes.sourceArchiveSha256,cfg.originalSha256);
assert.equal(attributes.originalGalaxySha256,primary.originalGalaxySha256);
assert.equal(attributes.generatedGalaxySha256,primary.generatedGalaxySha256);
const packed=await readAttributeArchiveInputs(primary.candidate,primary.candidateSha256);
assert.equal(packed.attributes===undefined?null:sha(packed.attributes),attributes.packedAttributesSha256);
const sourceProof=await read(path.join(job,'EXACT_ATTRIBUTE_SOURCE.json'));
const undeclaredTokens=attributes.documents.passed&&packed.attributes?explainUndeclaredAttributeTokens({
 before:await readFile(primary.originalGalaxy,'utf8'),after:await readFile(primary.generatedGalaxy,'utf8'),model:readAttributes(packed.attributes),
 ownedOwners:sourceProof.used&&Number.isSafeInteger(sourceProof.namespace)?['bnet:local/0.0/'+sourceProof.namespace]:[],
 apiNames:['GameAttributeGameValue','GameAttributePlayerValue']}):undefined;
const report={primaryVerdict:primary.primaryVerdict,attributeVerdict:attributes.verdict,
 combinedVerdict:primary.primaryVerdict==='MATCH'&&attributes.passed&&variant.typedComplete&&variant.customAiCompatible?'STATIC_MATCH_EDITOR_PENDING':'REVIEW',
 primaryReport:path.join(out,'BENCHMARK.json'),primaryReportSha256:sha(await readFile(path.join(out,'BENCHMARK.json'))),
 attributeReport:variant.attributeContract,undeclaredTokens,originalGalaxySha256:primary.originalGalaxySha256,generatedGalaxySha256:primary.generatedGalaxySha256,
 candidateSha256:primary.candidateSha256,benchmarkAssetsVerified:primary.benchmarkAssetsVerified,benchmarkChanged:false,actualEditor:false,accepted:false};
assert.equal(sha(await readFile(previous)),previousSha);
await writeFile(path.join(out,'BENCHMARK_WITH_ATTRIBUTES.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify(report));
