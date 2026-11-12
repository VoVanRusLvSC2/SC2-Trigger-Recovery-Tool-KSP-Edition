import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,stat,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {writeLosslessJsonEvidence as writePart} from './lossless-json-evidence.compact.mjs';
import {readLosslessJsonEvidence as readPart} from './lossless-json-evidence.mjs';

const sha=b=>createHash('sha256').update(b).digest('hex');
const chunkCap=48*1024**2,totalCap=512*1024**2,partCap=16,reserve=192*1024**2;
const partName=i=>String(i).padStart(4,'0')+'.json';

/** A bounded lossless container. Each base64 part uses the original 128 MiB
 * uncompressed / 32 MiB compressed reader limits and 192 MiB reserve. The
 * complete JSON has a separate 512 MiB cap and its own length and SHA. The
 * manifest is published last; interrupted writes are never complete evidence. */
export async function writePartitionedJsonEvidence(file,value,options={}){
 const chunkBytes=options.chunkBytes??chunkCap,maxTotal=options.maxTotalBytes??totalCap;
 assert(Number.isSafeInteger(chunkBytes)&&chunkBytes>0&&chunkBytes<=chunkCap,'PARTITION_CHUNK_LIMIT');
 assert(Number.isSafeInteger(maxTotal)&&maxTotal>0&&maxTotal<=totalCap,'PARTITION_TOTAL_LIMIT');
 const encoded=JSON.stringify(value);assert(encoded!==undefined,'PARTITION_JSON_REQUIRED');const raw=Buffer.from(encoded+'\n');
 assert(raw.length<=maxTotal,'PARTITION_TOTAL_LIMIT');const count=Math.ceil(raw.length/chunkBytes);assert(count>0&&count<=partCap,'PARTITION_COUNT_LIMIT');
 const directory=file+'.parts';await mkdir(directory);const parts=[];
 for(let i=0;i<count;i++){
  const chunk=raw.subarray(i*chunkBytes,Math.min((i+1)*chunkBytes,raw.length)),part=path.join(directory,partName(i));
  const receipt=await writePart(part,{kind:'LOSSLESS_JSON_BYTE_PART',index:i,data:chunk.toString('base64')});
  parts.push({index:i,receipt:partName(i),receiptSha256:sha(await readFile(part)),compressedSha256:receipt.compressedSha256,bytes:chunk.length,sha256:sha(chunk)});
 }
 const manifest={kind:'LOSSLESS_PARTITIONED_JSON_EVIDENCE',version:1,directory:path.basename(directory),uncompressedBytes:raw.length,uncompressedSha256:sha(raw),chunkBytes,parts};
 const bytes=Buffer.from(JSON.stringify(manifest,null,2)+'\n');assert(bytes.length<=65536,'PARTITION_MANIFEST_SIZE_LIMIT');
 const disk=await statfs(path.dirname(file));assert(disk.bavail*disk.bsize-bytes.length>reserve,'EVIDENCE_DISK_RESERVE');
 await writeFile(file,bytes,{flag:'wx'});return manifest;
}

export async function readPartitionedJsonEvidence(file,options={}){
 assert((await stat(file)).size<=65536,'PARTITION_MANIFEST_SIZE_LIMIT');const manifest=JSON.parse(await readFile(file,'utf8'));
 const maxTotal=options.maxTotalBytes??totalCap;assert(Number.isSafeInteger(maxTotal)&&maxTotal>0&&maxTotal<=totalCap,'PARTITION_TOTAL_LIMIT');
 assert(manifest.kind==='LOSSLESS_PARTITIONED_JSON_EVIDENCE'&&manifest.version===1&&manifest.directory===path.basename(file)+'.parts','PARTITION_SCHEMA');
 assert(Number.isSafeInteger(manifest.uncompressedBytes)&&manifest.uncompressedBytes>0&&manifest.uncompressedBytes<=maxTotal,'PARTITION_TOTAL_LIMIT');
 assert(Number.isSafeInteger(manifest.chunkBytes)&&manifest.chunkBytes>0&&manifest.chunkBytes<=chunkCap,'PARTITION_CHUNK_LIMIT');
 assert(Array.isArray(manifest.parts)&&manifest.parts.length===Math.ceil(manifest.uncompressedBytes/manifest.chunkBytes)&&manifest.parts.length<=partCap,'PARTITION_COUNT_LIMIT');
 const directory=path.join(path.dirname(file),manifest.directory),chunks=[];
 for(const [i,row]of manifest.parts.entries()){
  const expected=Math.min(manifest.chunkBytes,manifest.uncompressedBytes-i*manifest.chunkBytes);
  assert(row.index===i&&row.receipt===partName(i)&&row.bytes===expected,'PARTITION_INDEX_OR_LENGTH');
  const part=path.join(directory,row.receipt);assert.equal(sha(await readFile(part)),row.receiptSha256,'PARTITION_RECEIPT_SHA');
  const receipt=JSON.parse(await readFile(part,'utf8'));assert.equal(receipt.compressedSha256,row.compressedSha256,'PARTITION_COMPRESSED_SHA');
  const payload=await readPart(part);assert(payload.kind==='LOSSLESS_JSON_BYTE_PART'&&payload.index===i&&typeof payload.data==='string','PARTITION_PAYLOAD');
  const chunk=Buffer.from(payload.data,'base64');assert.equal(chunk.toString('base64'),payload.data,'PARTITION_BASE64');
  assert.equal(chunk.length,row.bytes,'PARTITION_LENGTH');assert.equal(sha(chunk),row.sha256,'PARTITION_SHA');chunks.push(chunk);
 }
 const raw=Buffer.concat(chunks);assert.equal(raw.length,manifest.uncompressedBytes,'PARTITION_TOTAL_LENGTH');assert.equal(sha(raw),manifest.uncompressedSha256,'PARTITION_TOTAL_SHA');
 return JSON.parse(raw.toString('utf8'));
}
