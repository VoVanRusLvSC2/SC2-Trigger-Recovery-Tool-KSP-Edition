import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {logicalSourcePath} from "./source-ownership.mjs";
export function normalizeOwnedSourceFiles(files=[]){
 assert(Array.isArray(files),'ADDITIONAL_SCRIPTS_ARRAY_REQUIRED');const owners=new Set(),names=new Set();
 return files.map(file=>{
  const owner=logicalSourcePath(file.originalPath??file.fileName),name=logicalSourcePath(file.fileName);
  assert(!owners.has(owner),'DUPLICATE_OWNED_SCRIPT_PATH');owners.add(owner);
  assert(!names.has(name),'AMBIGUOUS_OWNED_SCRIPT_FILENAME');names.add(name);
  assert.equal(typeof file.text,'string','OWNED_SCRIPT_TEXT_REQUIRED');const sha256=createHash('sha256').update(file.text).digest('hex');
  assert(file.sha256===undefined||file.sha256===sha256,'OWNED_SCRIPT_SHA_MISMATCH');return Object.freeze({...file,sha256});
 });
}
