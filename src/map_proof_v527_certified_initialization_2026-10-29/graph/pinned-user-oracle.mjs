import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {loadConversionOracle} from '../../user_maps_2026-10-10/delivery-with-benchmark-v2366/benchmark/harness/src/conversion-oracle.mjs';
const base=new URL('../../user_maps_2026-10-10/delivery-with-benchmark-v2366/',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
// Release identity of the user's unchanged benchmark, not a map-specific rule.
const manifestSha256='94d0ee8f5a7ff489e1d161134a6a93f73c68669d00ce7f4bca2bc66f24649166';
export async function openPinnedUserOracle() {
 const bytes=await readFile(new URL('benchmark/MANIFEST.json',base));assert.equal(sha(bytes),manifestSha256);
 const manifest=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/u,''));
 const verify=async()=>{
  assert.equal(sha(await readFile(new URL('benchmark/MANIFEST.json',base))),manifestSha256);
  for(const entry of manifest.files)assert.equal(sha(await readFile(new URL('benchmark/'+entry.path,base))),entry.sha256,entry.path);
 };
 await verify();
 const oracle=await loadConversionOracle('./benchmark/build/.benchmark-build/modkit-sc2-triggers/modules/triggers/services/galaxy-conversion/index.js',fileURLToPath(base));
 return {compare:(a,b)=>oracle.compareGalaxy(a,b,{libraryId:'Map'}),verify,manifestSha256,assets:manifest.files.length};
}
