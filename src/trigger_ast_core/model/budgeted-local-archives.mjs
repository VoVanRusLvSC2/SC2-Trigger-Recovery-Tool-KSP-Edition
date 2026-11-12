// Per-source, per-session MPQ reader. The container budget is independent of
// the existing per-entry preview limit; no bytes or metadata are rewritten.
import assert from 'node:assert/strict';
import {open,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
import {confined} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-private-switch-v26-2026-10-04/dist/modules/game/battlenet/content-sources/local-files.js';

export function archiveReadBudget({maxArchiveBytes=256*1024**2,maxRetainedBytes=maxArchiveBytes,maxEntries=100000,maxEntryBytes=64*1024**2}={}) {
  for(const [key,value] of Object.entries({maxArchiveBytes,maxRetainedBytes,maxEntryBytes}))
    assert(Number.isSafeInteger(value)&&value>0&&value<=1024**3,`Invalid ${key}`);
  assert(Number.isSafeInteger(maxEntries)&&maxEntries>0&&maxEntries<=100000,'Invalid maxEntries');
  assert(maxEntryBytes<=maxArchiveBytes && maxRetainedBytes>=maxArchiveBytes,'Inconsistent MPQ budgets');
  return Object.freeze({maxArchiveBytes,maxRetainedBytes,maxEntries,maxEntryBytes});
}
const stamp=s=>[s.dev,s.ino,s.size,s.mtimeMs,s.ctimeMs].join(':');
async function readArchive(root,path,maximum,hash) {
  const file=await open(await confined(root,path),'r');
  try {
    const before=await file.stat();assert(before.isFile()&&before.size<=maximum,'Archive exceeds configured byte budget');
    const bytes=new Uint8Array(before.size);let offset=0;
    while(offset<bytes.length){const r=await file.read(bytes,offset,bytes.length-offset,offset);assert(r.bytesRead,'Archive changed during read');offset+=r.bytesRead;}
    assert.equal(stamp(await file.stat()),stamp(before),'Archive changed during read');
    if(hash)assert.equal(createHash('sha256').update(bytes).digest('hex'),hash,'Archive SHA-256 mismatch');
    return bytes;
  } finally {await file.close();}
}
export class BudgetedLocalArchives {
  constructor(budget){this.budget=archiveReadBudget(budget);this.current=undefined;this.queue=Promise.resolve();this.closed=false;this.stats={opens:0,reuses:0,evictions:0,archiveBytesRead:0,maximumArchiveBytesObserved:0,persistentCache:false};}
  use(root,path,hash,action) {
    const task=this.queue.then(async()=>{
      assert(!this.closed,'Local source is closed');
      const location=await confined(root,path),info=await lstat(location);
      assert(info.isFile()&&info.size<=this.budget.maxArchiveBytes,'Archive exceeds configured byte budget');
      const key=JSON.stringify([location,stamp(info),hash??'']);
      if(this.current?.key!==key){
        this.current?.reader.dispose();this.current=undefined;
        const bytes=await readArchive(root,path,this.budget.maxArchiveBytes,hash);
        const reader=await openMpqReader(bytes,this.budget);
        try {assert.equal(stamp(await lstat(location)),stamp(info),'Archive changed while opening');}
        catch(error){reader.dispose();throw error;}
        this.current={key,reader};this.stats.opens++;this.stats.archiveBytesRead+=bytes.length;
        this.stats.maximumArchiveBytesObserved=Math.max(this.stats.maximumArchiveBytesObserved,bytes.length);
      } else this.stats.reuses++;
      try {const result=await action(this.current.reader);assert.equal(stamp(await lstat(location)),stamp(info),'Archive changed during extraction');return result;}
      finally {if(this.current.reader.retainedBytes>this.budget.maxRetainedBytes){this.current.reader.dispose();this.current=undefined;this.stats.evictions++;}}
    });
    this.queue=task.catch(()=>undefined);return task;
  }
  async refresh(){await this.queue;this.current?.reader.dispose();this.current=undefined;}
  async dispose(){this.closed=true;await this.refresh();}
}
