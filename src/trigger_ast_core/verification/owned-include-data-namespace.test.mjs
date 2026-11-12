import {test} from 'node:test';
import assert from 'node:assert/strict';
import {qualifyOwnedIncludeDataNamespace as qualify,externalIncludeHasArchiveShadow} from './owned-include-data-namespace.mjs';
const archive=(...names)=>{const paths=new Set(names.map(s=>s.toLowerCase()));return s=>paths.has(s.toLowerCase());};
test('a pinned Base.SC2Data target uses the full request path with no root shadow',()=>{
 for(const name of ['TriggerLibs/NativeLib.galaxy','Other/SomeHeader.galaxy']){
  const p=qualify(name,'Base.SC2Data/'+name,archive('base.sc2data/'+name));assert.equal(p.kind,'EXPLICIT_BASE_SC2DATA_MOUNT');assert.equal(p.basenameResolution,false);
 }
 assert.equal(qualify('Root.galaxy','root.galaxy',archive('Root.galaxy')).kind,'EXACT_OWNED_INCLUDE_PATH');
});
test('root shadows, unsupported aliases, double mounts, missing targets and unsafe paths refuse',()=>{
 assert.throws(()=>qualify('X.galaxy','Base.SC2Data/X.galaxy',archive('X.galaxy','Base.SC2Data/X.galaxy')),/NAMESPACE_SHADOW/);
 for(const target of ['Other/X.galaxy','enUS.SC2Data/X.galaxy','Base.SC2Data/Other/X.galaxy'])assert.throws(()=>qualify('X.galaxy',target,archive(target)),/RELATIVE_ALIAS/);
 assert.throws(()=>qualify('Base.SC2Data/X.galaxy','Base.SC2Data/Base.SC2Data/X.galaxy',()=>true),/RELATIVE_ALIAS/);
 assert.throws(()=>qualify('X.galaxy','Base.SC2Data/X.galaxy',()=>false),/BODY_MISSING/);
 assert.throws(()=>qualify('../X.galaxy','Base.SC2Data/X.galaxy',()=>true),/UNSAFE/);
});
test('an external binding cannot conceal an archive shadow in either namespace',()=>{
 for(const path of ['X.galaxy','Base.SC2Data/X.galaxy'])assert(externalIncludeHasArchiveShadow('X.galaxy',archive(path)));
 assert(!externalIncludeHasArchiveShadow('X.galaxy',archive('Other/X.galaxy')));
});
