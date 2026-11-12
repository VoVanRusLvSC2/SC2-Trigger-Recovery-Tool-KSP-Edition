import assert from 'node:assert/strict';
import {writeFile,statfs} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
import {createHash} from 'node:crypto';
import path from 'node:path';
export {readLosslessJsonEvidence} from './lossless-json-evidence.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
const defaults={maxUncompressedBytes:128*1024**2,maxCompressedBytes:32*1024**2,reserveBytes:192*1024**2};

/** Same JSON data, envelope, reader and size/reserve limits as the original
 * diagnostic store. Avoid indentation expansion of large nested witnesses. */
export async function writeLosslessJsonEvidence(file,value,options={}){
 const limits={...defaults,...options},raw=Buffer.from(JSON.stringify(value)+'\n');
 assert(raw.length<=limits.maxUncompressedBytes,'EVIDENCE_JSON_SIZE_LIMIT');
 const packed=gzipSync(raw,{level:6});assert(packed.length<=limits.maxCompressedBytes,'EVIDENCE_GZIP_SIZE_LIMIT');
 const receipt={kind:'LOSSLESS_COMPRESSED_JSON_EVIDENCE',encoding:'gzip',jsonLayout:'compact',artifact:path.basename(file)+'.gz',
  uncompressedBytes:raw.length,uncompressedSha256:sha(raw),compressedBytes:packed.length,compressedSha256:sha(packed)};
 const bytes=Buffer.from(JSON.stringify(receipt,null,2)+'\n'),disk=await statfs(path.dirname(file));
 assert(disk.bavail*disk.bsize-packed.length-bytes.length>limits.reserveBytes,'EVIDENCE_DISK_RESERVE');
 await writeFile(file+'.gz',packed,{flag:'wx'});await writeFile(file,bytes,{flag:'wx'});return receipt;
}
