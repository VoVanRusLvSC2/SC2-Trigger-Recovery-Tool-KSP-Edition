// Prepare only conversion inputs. Keep the source files and packed payloads
// separate: a proof must never compare against its own rewritten reference.
import {withGalaxyDocument} from '../model/galaxy-program.syntax.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
import {lowerTypedIntegerPredicates} from '../passes/typed-integer-predicates.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');

export async function prepareOwnedIntegerPredicateInputs({archiveBytes,archiveSha256,files,declarations=[],documents}) {
  assert(Buffer.isBuffer(archiveBytes),'OWNED_PREDICATE_ARCHIVE_BYTES_REQUIRED');
  assert.equal(sha(archiveBytes),archiveSha256,'OWNED_PREDICATE_ARCHIVE_CHANGED');
  assert(Array.isArray(files)&&Array.isArray(declarations),'OWNED_PREDICATE_INPUT_ARRAYS_REQUIRED');
  const paths=new Set(),prepared=[],records=[];
  const reader=await openMpqReader(archiveBytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
  try {
    for(const file of files) {
      assert(typeof file?.fileName==='string'&&typeof file.originalPath==='string'&&typeof file.text==='string','OWNED_PREDICATE_FILE_CONTRACT');
      const ownPath=file.originalPath.replaceAll('\\','/');
      assert(ownPath&&!ownPath.startsWith('/')&&!ownPath.includes(':')&&!ownPath.split('/').some(p=>!p||p==='.'||p==='..')&&/\.galaxy$/iu.test(ownPath),'OWNED_PREDICATE_UNSAFE_PATH');
      assert(!paths.has(ownPath.toLowerCase()),'OWNED_PREDICATE_DUPLICATE_PATH');paths.add(ownPath.toLowerCase());
      const entry=reader.find(ownPath);assert(entry,'OWNED_PREDICATE_NOT_IN_ORIGINAL_ARCHIVE');
      const original=Buffer.from(await reader.read(entry.id));
      assert.equal(sha(Buffer.from(file.text,'utf8')),sha(original),'OWNED_PREDICATE_SOURCE_BYTES_CHANGED');
      const lowered=withGalaxyDocument(file,documents,document=>document.run('lowerTypedIntegerPredicates',view=>lowerTypedIntegerPredicates(file.text,declarations,view)));
      assert(lowered.proof.allOriginalAstRetainedAfterRemovingOnlyProvedComparisons,'OWNED_PREDICATE_INVERSE_PROOF_REQUIRED');
      prepared.push({...file,text:lowered.text});
      records.push({fileName:file.fileName,originalPath:ownPath,sourceSha256:sha(original),outputSha256:sha(lowered.text),
        originalArchiveEntryVerified:true,coercions:lowered.proof.records.length,transform:lowered.proof});
    }
  } finally {reader.dispose();}
  return {files:prepared,proof:{kind:'MAP_OWNED_INCLUDED_SCRIPT_INTEGER_PREDICATE_INPUTS',archiveSha256,
    records,changedFiles:records.filter(r=>r.coercions).length,coercions:records.reduce((n,r)=>n+r.coercions,0),
    originalInputsMutated:false,sourceOrPackedFilesWritten:false,persistentCache:false,actualEditor:false,wholeMapAccepted:false}};
}
