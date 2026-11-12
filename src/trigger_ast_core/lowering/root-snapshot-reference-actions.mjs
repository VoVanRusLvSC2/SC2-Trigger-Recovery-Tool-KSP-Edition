import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {inlineSnapshotReferenceActions} from '../passes/inline-snapshot-reference-actions.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');

/** Root-only conversion input stage. Included/authored scripts supply binding
 * context but are not rewritten by this stage. The ordinary GUI/ABI/refusal
 * gates and independent comparison run after it without any exceptions.
 */
export function lowerRootSnapshotReferenceActions(source,{header='',sources=[],declarations=[]}={},document){
  document?.input(source);
  if(!source.includes('unitref'))return {text:source,proof:{records:[],changed:false,originalFilesChanged:false}};
  const offered=[{fileName:'MapScript.galaxy',text:source,owned:true},
    ...(header?[{fileName:'LibMap_h.galaxy',text:header,owned:false}]:[]),
    ...sources.map(f=>({...f,owned:false})),...declarations.map(f=>({...f,owned:false}))];
  const unique=new Map();
  for(const file of offered){
    const prior=unique.get(file.fileName);
    if(prior){if(prior.text!==file.text)throw Error('SNAPSHOT_INLINE_CONTEXT_PATH_CONFLICT');continue;}
    unique.set(file.fileName,{fileName:file.fileName,text:file.text,owned:file.owned,
      sourceId:'snapshot-inline:'+file.fileName,contentSha256:sha(file.text)});
  }
  const files=[...unique.values()],program=new GalaxyProgramContext(files,{files,dependencies:[]},sha);
  try{
    const result=inlineSnapshotReferenceActions(program),root=result.files.find(f=>f.fileName==='MapScript.galaxy');
    if(result.files.some(f=>f.fileName!=='MapScript.galaxy'))throw Error('SNAPSHOT_INLINE_MUTATED_CONTEXT_FILE');
    const text=root?.text??source;document?.output(text);
    return {text,proof:{kind:'ROOT_SNAPSHOT_FORMAL_INLINE',records:result.records,rejected:result.rejected,
      originalSha256:sha(source),outputSha256:sha(text),changed:!!root,
      originalFilesChanged:false,includedFilesChanged:false,persistentCache:false,
      newNative:0,newCustomScript:0,newRuntimeFunctions:0,wholeMapAccepted:false}};
  }finally{program.dispose();}
}
