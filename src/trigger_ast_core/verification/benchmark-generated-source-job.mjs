// The original comparison oracle stays byte-identical. Only representation
// provenance differs in the user-authorized source-preserving mode.
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {loadConversionOracle} from '../../user_maps_2026-10-10/delivery-with-benchmark-v2366/benchmark/harness/src/conversion-oracle.mjs';
const [job,out]=process.argv.slice(2);assert(job&&out);
const read=async p=>JSON.parse((await readFile(p,'utf8')).replace(/^\uFEFF/u,''));
const sha=b=>createHash('sha256').update(b).digest('hex');
const result=await read(path.join(job,'RESULT.json'));
assert.equal(result.status,'GENERATED');assert.equal(result.guiRecoveryMode,'preserve-source');assert.equal(result.variants.length,1);
const v=result.variants[0],beforePath=path.join(path.dirname(v.generatedGalaxy),'ORIGINAL_ROOT.galaxy');
const before=await readFile(beforePath),after=await readFile(v.generatedGalaxy);
assert.equal(sha(before),v.originalScriptSha256);assert.equal(sha(after),v.generatedGalaxySha256);
assert.equal(sha(await readFile(v.candidate)),v.candidateSha256);
const gatePath=path.join(job,'PACKED_SOURCE_GUI_GATE.json'),gate=await read(gatePath);
assert.equal(gate.mode,'preserve-source');assert.equal(gate.candidate.sha256,v.candidateSha256);
assert(gate.passed&&gate.archivePackingVerified&&gate.structure.foldersAndOriginalOrderingPreserved);
assert.equal(gate.gui.newNative,0);assert.equal(gate.gui.newFallbackCustomScript,0);
const benchmarkRoot=path.resolve(import.meta.dirname,'../../user_maps_2026-10-10/delivery-with-benchmark-v2366');
const manifestPath=path.join(benchmarkRoot,'benchmark/MANIFEST.json'),manifestBytes=await readFile(manifestPath);
assert.equal(sha(manifestBytes),'94d0ee8f5a7ff489e1d161134a6a93f73c68669d00ce7f4bca2bc66f24649166');
const manifest=JSON.parse(manifestBytes);
for(const file of manifest.files)assert.equal(sha(await readFile(path.join(benchmarkRoot,'benchmark',file.path))),file.sha256);
const oracle=await loadConversionOracle('./benchmark/build/.benchmark-build/modkit-sc2-triggers/modules/triggers/services/galaxy-conversion/index.js',benchmarkRoot);
const comparison=oracle.compareGalaxy(before.toString('utf8'),after.toString('utf8'),{libraryId:'Map',sampleLimit:12});
const report={id:result.id,name:result.name,createdAt:new Date().toISOString(),mode:'preserve-source',
 origin:'CONVERTER_GENERATED_NOT_EDITOR_EXPORT',actualEditor:false,accepted:false,job,
 primaryVerdict:comparison.exact?'MATCH':comparison.syntaxValid?'REVIEW':'INVALID_SYNTAX',
 benchmarkChanged:false,benchmarkAssetsVerified:manifest.files.length,
 originalGalaxy:beforePath,originalGalaxySha256:sha(before),generatedGalaxy:v.generatedGalaxy,generatedGalaxySha256:sha(after),
 candidate:v.candidate,candidateSha256:v.candidateSha256,sourceGuiGate:gatePath,sourceGuiGateSha256:sha(await readFile(gatePath)),
 sourceRaw:gate.originalRawCount,outputRaw:gate.outputRawCount,typedComplete:v.typedComplete,attributesComplete:v.attributesComplete,comparison,
 scope:'Exact same original oracle and literal/attribute/resource vetoes; source-bound representation gate, never a claim of full GUI or Editor acceptance.'};
await mkdir(out,{recursive:true});await writeFile(path.join(out,'BENCHMARK.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({id:report.id,mode:report.mode,primaryVerdict:report.primaryVerdict,functions:comparison.functions.expected,differing:comparison.functions.differing,missing:comparison.functions.missing,benchmarkAssetsVerified:manifest.files.length,actualEditor:false,accepted:false}));
