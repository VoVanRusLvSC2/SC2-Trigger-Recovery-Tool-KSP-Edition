import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';

export async function readLocalizedArchiveInputs(file,expectedSha256) {
 const bytes=await readFile(file),sha=b=>createHash('sha256').update(b).digest('hex');
 assert.equal(sha(bytes),expectedSha256,'LOCALIZED_ARCHIVE_SHA_CHANGED');
 const reader=await openMpqReader(bytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
 const values=new Map(),tables=[];
 try {
  for(const entry of reader.entries) {
   const name=entry.path?.replaceAll('\\','/').toLowerCase();
   if(!name||!/(?:^|\/)(?:localizeddata\/)?(?:gamestrings|gamehotkeys)\.txt$/u.test(name))continue;
   assert(!values.has(name),'AMBIGUOUS_LOCALIZED_TABLE');
   const raw=Buffer.from(await reader.read(entry.id));
   values.set(name,new TextDecoder('utf-8',{fatal:true}).decode(raw));
   tables.push({name,sha256:sha(raw),bytes:raw.length});
  }
  return {values,evidence:{path:file,sha256:expectedSha256,tables,unnamedEntries:reader.entries.filter(e=>!e.path).length}};
 }finally{reader.dispose();}
}
