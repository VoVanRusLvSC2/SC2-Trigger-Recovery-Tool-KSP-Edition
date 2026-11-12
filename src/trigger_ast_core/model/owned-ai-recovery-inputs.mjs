// A retained source file must not simultaneously be consumed by the optional
// Custom AI decompiler. Match physical source identities, never AI filenames.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {logicalSourcePath} from './source-ownership.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function partitionOwnedAiRecoveryInputs(policy,files,offered){
 assert(Array.isArray(files)&&Array.isArray(offered??[]),'AI_RECOVERY_INPUT_ARRAYS');
 if(!policy.preserveAuthoredCode)return {files:offered,retained:[],mode:'CONVERT_ADDITIONAL_SOURCES'};
 const owners=new Map();
 for(const f of files){assert(typeof f.text==='string'&&f.sha256===sha(f.text),'RETAINED_AI_SOURCE_SHA');for(const alias of[f.fileName,f.originalPath].filter(Boolean)){
  const key=logicalSourcePath(alias),prior=owners.get(key);assert(!prior||prior===f,'AMBIGUOUS_RETAINED_SOURCE_IDENTITY');owners.set(key,f);
 }}
 const remaining=[],retained=[];
 for(const f of offered??[]){assert(typeof f.fileName==='string'&&typeof f.text==='string','AI_RECOVERY_SOURCE_REQUIRED');
  const matches=[...new Set([f.fileName,f.originalPath].filter(Boolean).map(p=>owners.get(logicalSourcePath(p))).filter(Boolean))];assert(matches.length<=1,'AMBIGUOUS_AI_SOURCE_OWNER');
  if(!matches.length){remaining.push(f);continue;}
  const owner=matches[0];retained.push({fileName:f.fileName,originalPath:owner.originalPath??owner.fileName,sourceSha256:owner.sha256,offeredAiInputSha256:sha(f.text),originalBytesRetained:true,automaticAiDecompilationDisabledForThisOwnedSource:true});
 }
 return {files:remaining,retained,mode:'PRESERVE_OWNED_SOURCES',benchmarkVerdictChanged:false};
}
