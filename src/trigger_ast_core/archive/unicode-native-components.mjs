import assert from 'node:assert/strict';
import {readFile,writeFile,readdir,mkdir,lstat,realpath,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
import {packLocalComponents} from '../../map_local_dependencies_2026-10-04/pack_local_components.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const key=name=>name.replaceAll('\\','/').toLowerCase();
const internal=new Set(['(listfile)','(attributes)','(signature)']);
const options={maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2};
const contained=(root,file)=>{const r=path.relative(root,file);return !path.isAbsolute(r)&&r!=='..'&&!r.startsWith('..'+path.sep);};

function memberParts(name){
 assert.equal(typeof name,'string','MPQ_MEMBER_NAME_UNRESOLVED');
 const parts=name.replaceAll('\\','/').split('/');
 assert(parts.length&&parts.every(p=>p&&p!=='.'&&p!=='..'&&!/[\x00-\x1f<>:"|?*]/u.test(p)&&
  !/[. ]$/u.test(p)&&!/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(?:\.|$)/iu.test(p)), 'MPQ_MEMBER_NOT_LOSSLESS_WINDOWS_PATH');
 return parts;
}

async function ownedTarget(file,root){
 const base=await realpath(root),target=path.resolve(file);
 assert(contained(base,target)&&target!==base,'MPQ_ADAPTER_OUTPUT_OUTSIDE_OWNER');
 let current=target;
 while(true){
  try{const st=await lstat(current);assert(!st.isSymbolicLink(),'MPQ_ADAPTER_REPARSE_REFUSED');
   assert(!st.isFile()||st.nlink===1,'MPQ_ADAPTER_HARDLINK_REFUSED');
   assert(contained(base,await realpath(current)),'MPQ_ADAPTER_CANONICAL_PATH_OUTSIDE_OWNER');}
  catch(e){if(e.code!=='ENOENT')throw e;}
  if(current===base)break;
  const parent=path.dirname(current);assert.notEqual(parent,current);current=parent;
 }
 return target;
}

const receiptPath=directory=>directory+'.source-mpq.json';

// UTF-16 filesystem paths stay in Node; no archive member name crosses an ANSI
// argv boundary. A manifest outside the payload directory binds the exact input.
export async function extractNativeComponents({archive,output,ownerRoot,reserveBytes=192*1024**2}){
 assert(Number.isSafeInteger(reserveBytes)&&reserveBytes>=192*1024**2,'MPQ_ADAPTER_RESERVE_CANNOT_BE_LOWERED');
 const source=await realpath(archive),root=await realpath(ownerRoot);
 assert(contained(root,source),'MPQ_ADAPTER_SOURCE_OUTSIDE_OWNER');
 const target=await ownedTarget(output,root);
 await mkdir(target,{recursive:true});assert.equal((await readdir(target)).length,0,'MPQ_ADAPTER_OUTPUT_NOT_EMPTY');
 const receiptFile=await ownedTarget(receiptPath(target),root);
 const bytes=await readFile(source),reader=await openMpqReader(bytes,options),records=[],seen=new Set();
 try{
  assert(!reader.recovered&&!reader.headerRepaired,'MPQ_ADAPTER_REPAIRED_INPUT_REFUSED');
  for(const entry of reader.entries){
   const parts=memberParts(entry.path),name=parts.join('/'),identity=key(name);
   assert(!seen.has(identity),'MPQ_ADAPTER_DUPLICATE_OR_LOCALE_PATH');seen.add(identity);
   records.push({entry,name,parts});
  }
  for(const row of records){
   const data=Buffer.from(await reader.read(row.entry.id));
   const disk=await statfs(root);assert(disk.bavail*disk.bsize>reserveBytes+data.length,'MPQ_ADAPTER_LIVE_RESERVE');
   const file=await ownedTarget(path.join(target,...row.parts),root);
   await mkdir(path.dirname(file),{recursive:true});await writeFile(file,data,{flag:'wx'});
   assert.equal(sha(await readFile(file)),sha(data),'MPQ_ADAPTER_EXTRACTED_PAYLOAD_MISMATCH');
   row.sha256=sha(data);row.bytes=data.length;
  }
 }finally{reader.dispose();}
 assert.equal(sha(await readFile(source)),sha(bytes),'MPQ_ADAPTER_SOURCE_CHANGED');
 const receipt={kind:'BYTE_EXACT_UNICODE_COMPONENT_EXTRACTION',source:{path:source,sha256:sha(bytes)},directory:target,
  entries:records.map(({name,sha256,bytes})=>({name,sha256,bytes})),filesDeleted:0,sourceChanged:false};
 await writeFile(receiptFile,JSON.stringify(receipt,null,2),{flag:'wx'});
 return {receipt:receiptFile,entries:records.length,sourceSha256:receipt.source.sha256};
}

// Reuse the original compressed container. Only changed members are written;
// untouched Unicode names, codecs, assets and payloads survive byte for byte.
// The legacy writer is never given a Unicode archive-member argv string.
export async function repackNativeComponents({directory,output,ownerRoot,mpq}){
 const root=await realpath(ownerRoot),folder=await realpath(directory);
 assert(contained(root,folder),'MPQ_ADAPTER_COMPONENTS_OUTSIDE_OWNER');
 const target=await ownedTarget(output,root),receipt=JSON.parse(await readFile(receiptPath(folder),'utf8'));
 assert.equal(receipt.kind,'BYTE_EXACT_UNICODE_COMPONENT_EXTRACTION');assert.equal(receipt.directory,folder);
 const source=await realpath(receipt.source.path);assert(contained(root,source));
 assert.equal(sha(await readFile(source)),receipt.source.sha256,'MPQ_ADAPTER_SOURCE_CHANGED');
 assert(typeof mpq==='string'&&mpq.length,'MPQ_ADAPTER_LEGACY_WRITER_REQUIRED');
 assert([source,target].every(p=>/^[\x20-\x7e]+$/u.test(p)),'MPQ_ADAPTER_LEGACY_WRITE_HOST_PATH_NONASCII');
 const old=new Map(receipt.entries.map(r=>[key(r.name),r])),actual=new Map();
 assert.equal(old.size,receipt.entries.length);
 const visit=async dir=>{
  for(const entry of await readdir(dir,{withFileTypes:true})){
   const file=await ownedTarget(path.join(dir,entry.name),root);
   assert(!entry.isSymbolicLink(),'MPQ_ADAPTER_REPARSE_REFUSED');
   if(entry.isDirectory()){await visit(file);continue;}
   assert(entry.isFile(),'MPQ_ADAPTER_NONREGULAR_COMPONENT');
   const name=path.relative(folder,file).split(path.sep).join('/');memberParts(name);
   const identity=key(name);assert(!actual.has(identity),'MPQ_ADAPTER_DUPLICATE_PATH');
   actual.set(identity,{path:name,bytes:await readFile(file)});
  }
 };await visit(folder);
 for(const [name,row]of old)assert(actual.has(name),'MPQ_ADAPTER_COMPONENT_REMOVED:'+row.name);
 const changed=[...actual].filter(([name,row])=>!internal.has(name)&&sha(row.bytes)!==old.get(name)?.sha256).map(([,row])=>row);
 assert(changed.every(c=>/^[\x20-\x7e]+$/u.test(c.path)),'MPQ_ADAPTER_LEGACY_WRITE_NONASCII_UNSUPPORTED');
 const job=await ownedTarget(target+'.component-pack',root);
 const packed=await packLocalComponents({source,destination:target,components:changed,job,mpq});
 assert(packed.passed&&!packed.originalChanged);
 return {...packed,receipt:receiptPath(folder),extractedEntries:receipt.entries.length,
  unicodePayloadsRetained:receipt.entries.filter(r=>!/^[\x20-\x7e]+$/u.test(r.name)).length,
  originalContainerReused:true,opaqueAssetsNotReencoded:true};
}
