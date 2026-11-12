import assert from 'node:assert/strict';
import {logicalSourcePath} from '../model/source-ownership.mjs';
// SC2's Base.SC2Data mount, from an already layer-bound include edge.
// This never guesses a basename, owner directory, locale or dependency layer.
export function qualifyOwnedIncludeDataNamespace(request,target,hasEntry){
 const key=logicalSourcePath(request),path=logicalSourcePath(target);
 if(key===path)return {kind:'EXACT_OWNED_INCLUDE_PATH',request:key,target:path};
 assert(!key.startsWith('base.sc2data/')&&path==='base.sc2data/'+key,'ARCHIVE_INCLUDE_RELATIVE_ALIAS_NOT_SUPPORTED');
 assert(!hasEntry(key),'ARCHIVE_INCLUDE_DATA_NAMESPACE_SHADOW');
 assert(hasEntry(path),'ARCHIVE_INCLUDE_OWNED_BODY_MISSING:'+path);
 return {kind:'EXPLICIT_BASE_SC2DATA_MOUNT',request:key,target:path,rootShadowAbsent:true,basenameResolution:false};
}
export function externalIncludeHasArchiveShadow(request,hasEntry){
 const key=logicalSourcePath(request);return !!hasEntry(key)||!key.startsWith('base.sc2data/')&&!!hasEntry('base.sc2data/'+key);
}
