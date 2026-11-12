import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openMpqReader} from "../vendor/@modkit/blizzard-mpq/src/mpq/codec.js";
export async function readAttributeArchiveInputs(file,expectedSha256) {
 const bytes=await readFile(file),sha256=createHash('sha256').update(bytes).digest('hex');
 assert.equal(sha256,expectedSha256,'ATTRIBUTE_SOURCE_ARCHIVE_CHANGED');
 const reader=await openMpqReader(bytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
 const result={sha256};
 try {
  for(const [key,name]of [['attributes','Attributes'],['documentInfo','DocumentInfo']]) {
   const entries=reader.entries.filter(e=>e.path?.toLowerCase()===name.toLowerCase());assert(entries.length<=1,'AMBIGUOUS_ATTRIBUTE_COMPONENT');
   const entry=reader.find(name);if(entry)result[key]=Buffer.from(await reader.read(entry.id)).toString('utf8');
  }
 }finally{reader.dispose();}
 return result;
}
