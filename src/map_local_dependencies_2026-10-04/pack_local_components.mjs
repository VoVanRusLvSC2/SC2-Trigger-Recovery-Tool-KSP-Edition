/** Full container verification for reversible local dependency/source copies. */
import {readFile,writeFile,mkdir,copyFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {createHash} from 'node:crypto';
import path from 'node:path';
import assert from 'node:assert/strict';
import {openMpqReader} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
const execute=promisify(execFile),sha=b=>createHash('sha256').update(b).digest('hex');
const key=s=>s.replaceAll('\\','/').toLowerCase();
export async function readLocalArchive(file){
 const bytes=await readFile(file),reader=await openMpqReader(bytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
 return {bytes,reader,sha256:sha(bytes)};
}
export async function packLocalComponents({source,destination,components,job,mpq='E:/SK2/Trigger Revize KSP/tools/mpqcli/bin/mpqcli.exe'}){
 source=path.resolve(source);destination=path.resolve(destination);job=path.resolve(job);
 assert.notEqual(source.toLowerCase(),destination.toLowerCase());
 assert.equal(path.basename(source),path.basename(destination),'Preserve document filename');
 try{await readFile(destination);throw Error('Destination already exists');}catch(e){if(e.code!=='ENOENT')throw e;}
 await mkdir(job,{recursive:true});await mkdir(path.dirname(destination),{recursive:true});
 const before=await readLocalArchive(source),old=new Map(),internal=new Set(['(listfile)','(attributes)','(signature)']);
 const changed=new Map(components.map(c=>[key(c.path),c]));assert.equal(changed.size,components.length);
 try{for(const e of before.reader.entries)old.set(key(e.path),{path:e.path,sha256:sha(await before.reader.read(e.id))});}
 finally{before.reader.dispose();}
 await copyFile(source,destination);
 for(let i=0;i<components.length;i++){
  const c=components[i];assert(!path.isAbsolute(c.path)&&!c.path.split(/[\\/]/u).some(p=>!p||p==='.'||p==='..'));
  const local=path.join(job,'components',...c.path.replaceAll('\\','/').split('/'));await mkdir(path.dirname(local),{recursive:true});await writeFile(local,c.bytes,{flag:'wx'});
  const r=await execute(mpq,['add',destination,local,'--path',c.path.replaceAll('/','\\'),'--overwrite','--game','starcraft2'],{windowsHide:true,timeout:180000,maxBuffer:8*1024**2});
  await writeFile(path.join(job,'pack-'+i+'.log'),r.stdout+r.stderr);
 }
 // A common MPQ user-data preamble mirrors DocumentHeader. Updating one without
 // the other is unsafe. Handle that exact mirror; refuse an unknown preamble.
 if(changed.has('documentheader')&&before.bytes.subarray(0,4).equals(Buffer.from('MPQ\x1b','binary'))){
  const oldArchive=await readLocalArchive(source);
  try{
   const e=oldArchive.reader.find('DocumentHeader');assert(e);
   const oldHeader=Buffer.from(await oldArchive.reader.read(e.id));
   assert(Buffer.from(oldArchive.reader.preamble??[]).equals(oldHeader),'Unknown user-data preamble; copy retained for diagnosis');
   const nextHeader=Buffer.from(changed.get('documentheader').bytes),archive=await readFile(destination);
   const offset=archive.readUInt32LE(8),newOffset=Math.max(offset,Math.ceil((16+nextHeader.length)/512)*512);
   const prefix=Buffer.alloc(newOffset);archive.copy(prefix,0,0,16);prefix.writeUInt32LE(nextHeader.length,4);prefix.writeUInt32LE(newOffset,8);nextHeader.copy(prefix,16);
   await writeFile(destination,Buffer.concat([prefix,archive.subarray(offset)]));
  }finally{oldArchive.reader.dispose();}
 }
 const after=await readLocalArchive(destination);let untouched=0;
 try{
  assert(!after.reader.recovered&&!after.reader.headerRepaired,'New archive needs repair');
  const inventory=new Map();for(const e of after.reader.entries)inventory.set(key(e.path),sha(await after.reader.read(e.id)));
  for(const [name,item] of old){if(internal.has(name))continue;
   assert.equal(inventory.get(name),changed.has(name)?sha(changed.get(name).bytes):item.sha256,'Payload changed: '+item.path);
   if(!changed.has(name))untouched++;
  }
  for(const [name,c] of changed)assert.equal(inventory.get(name),sha(c.bytes));
  for(const name of inventory.keys())assert(old.has(name)||changed.has(name)||internal.has(name),'Unexpected payload: '+name);
  assert.equal(sha(await readFile(source)),before.sha256,'Source changed during packing');
  const report={source,sourceSha256:before.sha256,destination,destinationSha256:after.sha256,
   passed:true,untouchedPayloads:untouched,changedComponents:components.map(c=>({path:c.path,sha256:sha(c.bytes)})),
   originalChanged:false,editorVerified:false,semanticsClaim:false};
  await writeFile(path.join(job,'PACK_VERIFICATION.json'),JSON.stringify(report,null,2),{flag:'wx'});return report;
 }finally{after.reader.dispose();}
}
