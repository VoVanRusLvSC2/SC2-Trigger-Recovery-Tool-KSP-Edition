// Extend the existing primary/attribute benchmark. No oracle or old result is
// replaced, and equal Galaxy cannot hide changed packed localization values.
import assert from 'node:assert/strict';
import {readFile,writeFile} from 'node:fs/promises';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {readLocalizedArchiveInputs} from './localized-archive-inputs.mjs';
import {compareLocalizedValues} from './localized-value-preservation.mjs';

const [job,out]=process.argv.slice(2);assert(job&&out,'JOB FRESH_BENCHMARK_DIRECTORY');
const previous=fileURLToPath(new URL('./benchmark-generated-job.mjs',import.meta.url));
const previousSha256='3fab3dcff90d9b500e463f8cfbaa16e1ca180a0d51784cfa35267beac127ee9b';
const sha=b=>createHash('sha256').update(b).digest('hex');
const read=async file=>JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/u,''));
assert.equal(sha(await readFile(previous)),previousSha256,'PRIMARY_ATTRIBUTE_BENCHMARK_CHANGED');
await promisify(execFile)(process.execPath,[previous,job,out],{cwd:fileURLToPath(new URL('../../',import.meta.url)),windowsHide:true,maxBuffer:4*1024**2});
const primary=await read(path.join(out,'BENCHMARK.json')),attributesPath=path.join(out,'BENCHMARK_WITH_ATTRIBUTES.json');
const attributes=await read(attributesPath),cfg=await read(path.join(job,'config.json'));
const before=await readLocalizedArchiveInputs(cfg.original,cfg.originalSha256);
const prepared=cfg.original===cfg.archive&&cfg.originalSha256===cfg.archiveSha256?before:
 await readLocalizedArchiveInputs(cfg.archive,cfg.archiveSha256);
const after=await readLocalizedArchiveInputs(primary.candidate,primary.candidateSha256);
const compare=(a,b)=>compareLocalizedValues(a.values,b.values,{discoveryComplete:!a.evidence.unnamedEntries&&!b.evidence.unnamedEntries});
const wholeDelta=compare(before,after),preparationDelta=compare(before,prepared),conversionDelta=compare(prepared,after);
const resourcesPassed=[wholeDelta,preparationDelta,conversionDelta].every(d=>d.status==='EXACT_EFFECTIVE_TABLES');
for(const pin of [before.evidence,prepared.evidence,after.evidence]) {
 const hash=createHash('sha256');for await(const chunk of createReadStream(pin.path))hash.update(chunk);
 assert.equal(hash.digest('hex'),pin.sha256,'SEALED_LOCALIZATION_ARCHIVE_CHANGED');
}
assert.equal(sha(await readFile(previous)),previousSha256);
const report={id:primary.id,primaryVerdict:primary.primaryVerdict,attributeVerdict:attributes.attributeVerdict,
 resourceVerdict:resourcesPassed?'PASSED':'REVIEW',resourcesPassed,
 combinedVerdict:resourcesPassed?attributes.combinedVerdict:'REVIEW',
 primaryReport:{path:path.join(out,'BENCHMARK.json'),sha256:sha(await readFile(path.join(out,'BENCHMARK.json')))},
 attributeReport:{path:attributesPath,sha256:sha(await readFile(attributesPath))},
 original:before.evidence,prepared:prepared.evidence,candidate:after.evidence,wholeDelta,preparationDelta,conversionDelta,
 finalInputRehash:true,actualEditor:false,accepted:false,originalOracleChanged:false,
 scope:'Additional map GameStrings/GameHotkeys preservation gate. No external mod fallback, other assets or engine equivalence claim.'};
await writeFile(path.join(out,'BENCHMARK_WITH_RESOURCES.json'),JSON.stringify(report,null,2)+'\n',{flag:'wx'});
console.log(JSON.stringify({id:report.id,resourceVerdict:report.resourceVerdict,combinedVerdict:report.combinedVerdict,actualEditor:false,accepted:false}));
