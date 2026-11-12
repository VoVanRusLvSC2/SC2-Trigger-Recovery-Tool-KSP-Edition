import assert from 'node:assert/strict';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
const canonical=p=>p.replaceAll('\\','/').toLowerCase(),xml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
// Recover an Editor registration document from already present, versioned mod
// components. This changes no game data, scripts, GUI definitions or defaults.
export function planDependencyEditorManifest({paths,componentList,documentInfo,headerDependencies=[],documentKind='mod'}){
 assert.equal(documentKind,'mod','DEPENDENCY_MOD_REQUIRED');const names=new Map();for(const p of paths){const key=canonical(p);assert(!names.has(key),'DEPENDENCY_MEMBER_AMBIGUOUS');names.set(key,p);}
 const components=[],records=[];if(componentList!==undefined)return {components,records,existingRegistrationPreserved:true,gamePayloadsChanged:false};
 const refs=[];if(names.has('gamedata.version'))refs.push({type:'gada',name:'GameData'});
 if(names.has('documentinfo.version')){
  assert(typeof documentInfo==='string','DEPENDENCY_DOCUMENT_INFO_MISSING');const body=documentInfo.replace(/^\uFEFF/u,'').replace(/^\s*<\?xml[^?]*\?>/u,'').trim();
  if(!body){assert(headerDependencies.every(x=>typeof x==='string'),'DEPENDENCY_HEADER_REFERENCES_REQUIRED');const dependencies=headerDependencies.length?'\n    <Dependencies>\n'+headerDependencies.map(s=>'        <Value>'+xml(s)+'</Value>').join('\n')+'\n    </Dependencies>\n':'\n';components.push({path:'DocumentInfo',text:'<?xml version="1.0" encoding="utf-8"?>\n<DocInfo>'+dependencies+'</DocInfo>\n'});records.push({kind:'EMPTY_EDITOR_DOCUMENT_INFO_ROOT_FROM_EXISTING_HEADER',dependencies:[...headerDependencies]});}
  else assert.equal(xmlTree(body).tag,'DocInfo','DEPENDENCY_DOCUMENT_INFO_UNKNOWN_ROOT');refs.push({type:'info',name:'DocumentInfo'});
 }
 const locales=[...new Set([...names.keys()].map(p=>/^([a-z]{4})\.sc2data\/localizeddata\/[^/]+\.txt$/u.exec(p)?.[1]).filter(Boolean))].sort();
 if(locales.length){assert(names.has('gametext.version'),'DEPENDENCY_TEXT_VERSION_MISSING');for(const locale of locales)refs.push({type:'text',name:'GameText',locale:locale.slice(0,2)+locale.slice(2).toUpperCase()});}
 if(names.has('triggers')){assert(names.has('triggers.version'),'DEPENDENCY_TRIGGER_VERSION_MISSING');refs.push({type:'trig',name:'Triggers'});}
 assert(refs.length,'DEPENDENCY_NO_VERSIONED_COMPONENTS');components.push({path:'ComponentList.SC2Components',text:'<?xml version="1.0" encoding="utf-8"?>\n<Components>\n'+refs.map(r=>'    <DataComponent Type="'+r.type+'"'+(r.locale?' Locale="'+r.locale+'"':'')+'>'+r.name+'</DataComponent>').join('\n')+'\n</Components>\n'});
 records.push({kind:'EDITOR_COMPONENT_REGISTRATION_FROM_EXISTING_VERSIONED_PAYLOADS',references:refs,compiledGalaxyRetainedWithoutInventedGui:!names.has('triggers')});return{components,records,existingRegistrationPreserved:false,gamePayloadsChanged:false};
}
