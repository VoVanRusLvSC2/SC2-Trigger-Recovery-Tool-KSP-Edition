// Generic offline transport for the unchanged oracle. Never accepts a map.
import assert from 'node:assert/strict';
import{readFile,writeFile,mkdir}from'node:fs/promises';
import{createHash}from'node:crypto';
import{dirname}from'node:path';
import{loadConversionOracle}from'../user_maps_2026-10-10/delivery-with-benchmark-v2366/benchmark/harness/src/conversion-oracle.mjs';
const[job,out]=process.argv.slice(2);assert(job&&out,'job and output required');
const W='K:/SC2_MAP_Workspace/sc2_editor_C++',read=async p=>JSON.parse(await readFile(p,'utf8')),sha=b=>createHash('sha256').update(b).digest('hex');
const result=await read(job+'/RESULT.json');assert.equal(result.status,'GENERATED');assert.equal(result.variants.length,1);
const v=result.variants[0],beforePath=dirname(v.generatedGalaxy)+'/ORIGINAL_ROOT.galaxy';
const before=await readFile(beforePath),after=await readFile(v.generatedGalaxy);assert.equal(sha(before),v.originalScriptSha256);assert.equal(sha(after),v.generatedGalaxySha256);assert.equal(sha(await readFile(v.candidate)),v.candidateSha256);
const gate=await read(job+'/GUI_GATE.json');assert.equal(gate.candidateSha256,v.candidateSha256);assert(gate.preEditorGuiGatePassed&&!gate.referenceIssues.length&&!gate.syntheticNativeDefinitions.length&&!gate.rawCodeFields.length);
const benchmarkRoot=W+'/user_maps_2026-10-10/delivery-with-benchmark-v2366',manifest=await read(benchmarkRoot+'/benchmark/MANIFEST.json');for(const f of manifest.files)assert.equal(sha(await readFile(benchmarkRoot+'/benchmark/'+f.path)),f.sha256);
const oracle=await loadConversionOracle('./benchmark/build/.benchmark-build/modkit-sc2-triggers/modules/triggers/services/galaxy-conversion/index.js',benchmarkRoot);
const comparison=oracle.compareGalaxy(before.toString('utf8'),after.toString('utf8'),{libraryId:'Map',sampleLimit:12});
const report={id:result.id,name:result.name,createdAt:new Date().toISOString(),origin:'CONVERTER_GENERATED_NOT_EDITOR_EXPORT',actualEditor:false,accepted:false,job,primaryVerdict:comparison.exact?'MATCH':comparison.syntaxValid?'REVIEW':'INVALID_SYNTAX',benchmarkChanged:false,benchmarkAssetsVerified:manifest.files.length,originalGalaxy:beforePath,originalGalaxySha256:sha(before),generatedGalaxy:v.generatedGalaxy,generatedGalaxySha256:sha(after),candidate:v.candidate,candidateSha256:v.candidateSha256,guiGate:job+'/GUI_GATE.json',guiGateSha256:sha(await readFile(job+'/GUI_GATE.json')),typedComplete:v.typedComplete,attributesComplete:v.attributesComplete,comparison};
await mkdir(out,{recursive:true});await writeFile(out+'/BENCHMARK.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({id:report.id,primaryVerdict:report.primaryVerdict,functions:comparison.functions.expected,differing:comparison.functions.differing,missing:comparison.functions.missing,benchmarkAssetsVerified:manifest.files.length,actualEditor:false,accepted:false}));
