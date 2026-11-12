import assert from 'node:assert/strict';
import {readFile,writeFile,statfs,stat} from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';
const sha=b=>createHash('sha256').update(b).digest('hex');
const defaults={maxUncompressedBytes:128*1024**2,maxCompressedBytes:32*1024**2,reserveBytes:192*1024**2};

/** Lossless diagnostic storage only. No proof field or benchmark gate is
 * removed; both the stored bytes and the original JSON bytes are hashed. */
export async function writeLosslessJsonEvidence(file,value,options={}){
 const limits={...defaults,...options},raw=Buffer.from(JSON.stringify(value,null,2)+'\n');
 assert(raw.length<=limits.maxUncompressedBytes,'EVIDENCE_JSON_SIZE_LIMIT');
 const packed=gzipSync(raw,{level:6});assert(packed.length<=limits.maxCompressedBytes,'EVIDENCE_GZIP_SIZE_LIMIT');
 const receipt={kind:'LOSSLESS_COMPRESSED_JSON_EVIDENCE',encoding:'gzip',artifact:path.basename(file)+'.gz',
  uncompressedBytes:raw.length,uncompressedSha256:sha(raw),compressedBytes:packed.length,compressedSha256:sha(packed)};
 const bytes=Buffer.from(JSON.stringify(receipt,null,2)+'\n'),disk=await statfs(path.dirname(file));
 assert(disk.bavail*disk.bsize-packed.length-bytes.length>limits.reserveBytes,'EVIDENCE_DISK_RESERVE');
 await writeFile(file+'.gz',packed,{flag:'wx'});await writeFile(file,bytes,{flag:'wx'});return receipt;
}
export async function readLosslessJsonEvidence(file,options={}){
 const limits={...defaults,...options};assert((await stat(file)).size<=65536,'EVIDENCE_RECEIPT_SIZE_LIMIT');
 const receipt=JSON.parse(await readFile(file,'utf8'));
 assert(receipt.kind==='LOSSLESS_COMPRESSED_JSON_EVIDENCE'&&receipt.encoding==='gzip'&&receipt.artifact===path.basename(file)+'.gz','EVIDENCE_RECEIPT_SCHEMA');
 assert(Number.isSafeInteger(receipt.uncompressedBytes)&&receipt.uncompressedBytes>0&&receipt.uncompressedBytes<=limits.maxUncompressedBytes,'EVIDENCE_JSON_SIZE_LIMIT');
 assert(Number.isSafeInteger(receipt.compressedBytes)&&receipt.compressedBytes>0&&receipt.compressedBytes<=limits.maxCompressedBytes,'EVIDENCE_GZIP_SIZE_LIMIT');
 const packedFile=path.join(path.dirname(file),receipt.artifact);assert.equal((await stat(packedFile)).size,receipt.compressedBytes,'EVIDENCE_GZIP_LENGTH');
 const packed=await readFile(packedFile);assert.equal(sha(packed),receipt.compressedSha256,'EVIDENCE_GZIP_SHA');
 const raw=gunzipSync(packed,{maxOutputLength:receipt.uncompressedBytes});assert.equal(raw.length,receipt.uncompressedBytes,'EVIDENCE_JSON_LENGTH');
 assert.equal(sha(raw),receipt.uncompressedSha256,'EVIDENCE_JSON_SHA');return JSON.parse(raw.toString('utf8'));
}
