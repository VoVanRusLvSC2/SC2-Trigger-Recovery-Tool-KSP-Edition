import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {readLocalArchive} from '../../map_local_dependencies_2026-10-04/pack_local_components.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),key=s=>s.replaceAll('\\','/').toLowerCase();
const internal=new Set(['(attributes)','(listfile)','(signature)']);

// Reusing a completed pack is an explicit proof operation, not a filename cache.
// Recompute all original/prepared member hashes and the expected metadata edits.
export async function verifyLocalComponentPack({source,components,receipt}){
 const p=JSON.parse(await readFile(receipt,'utf8'));
 assert(p.passed&&!p.originalChanged&&path.resolve(p.source)===path.resolve(source),'PACK_SOURCE_IDENTITY');
 const expected=new Map(components.map(c=>[key(c.path),sha(c.bytes)]));
 assert.equal(expected.size,components.length,'PACK_DUPLICATE_COMPONENT');
 assert.deepEqual(new Map(p.changedComponents.map(c=>[key(c.path),c.sha256])),expected,'PACK_EXPECTED_COMPONENTS_CHANGED');
 const before=await readLocalArchive(source);let after;
 try{
  after=await readLocalArchive(p.destination);
  assert.equal(before.sha256,p.sourceSha256,'PACK_ORIGINAL_CHANGED');assert.equal(after.sha256,p.destinationSha256,'PACK_OUTPUT_CHANGED');
  assert(!before.reader.recovered&&!before.reader.headerRepaired&&!after.reader.recovered&&!after.reader.headerRepaired,'PACK_REPAIRED_ARCHIVE_REFUSED');
  const inventory=async reader=>{const m=new Map();for(const e of reader.entries){const k=key(e.path);assert(!m.has(k),'PACK_AMBIGUOUS_MEMBER');m.set(k,sha(await reader.read(e.id)));}return m;};
  const old=await inventory(before.reader),next=await inventory(after.reader);
  for(const [name,hash]of old)if(!internal.has(name))assert.equal(next.get(name),expected.get(name)??hash,'PACK_PAYLOAD_CHANGED:'+name);
  for(const [name,hash]of expected)assert.equal(next.get(name),hash,'PACK_EXPECTED_PAYLOAD_MISSING');
  for(const name of next.keys())assert(old.has(name)||expected.has(name)||internal.has(name),'PACK_UNEXPECTED_PAYLOAD');
  return {...p,independentlyReverified:true,receipt:{path:receipt,sha256:sha(await readFile(receipt))}};
 }finally{before.reader.dispose();after?.reader.dispose();}
}
