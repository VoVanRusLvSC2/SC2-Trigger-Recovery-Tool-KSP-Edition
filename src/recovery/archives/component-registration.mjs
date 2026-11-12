/** Reconstruct missing component registrations from the map's own version records.
 * This is a candidate registration list; original Editor ordering is not known.
 */
import assert from 'node:assert/strict';
import {parseVersionFile,typeTagFor} from "../../sdk/core/modules/mod/codecs/document-metadata/core/version-file.js";
const esc=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('"','&quot;');
export async function recoverComponentList(entries,read){
 const rows=[],evidence=[],seen=new Set();
 const add=(type,name,locale)=>{const key=type+'|'+name+'|'+(locale??'');if(seen.has(key))return;seen.add(key);rows.push({type,name,locale});};
 const locales=[...new Set(entries.map(e=>/^([a-z]{2}[A-Z]{2})\.SC2Data[\\/]/i.exec(e.path)?.[1]).filter(Boolean))].sort();
 for(const e of entries){
  const name=e.path.replaceAll('\\','/');if(name.includes('/')||!name.endsWith('.version'))continue;
  const record=parseVersionFile(Buffer.from(await read(e.id)));if(!record)continue;
  const component=name.slice(0,-8),expected=typeTagFor(component);
  assert(expected&&record.typeTag===expected,'Unknown or conflicting component version '+name);
  const type=record.typeTag.split('').reverse().join('');
  if(type==='text'){
   assert(locales.length,'GameText version without observable locale');for(const locale of locales)add(type,component,locale);
  }else add(type,component);
  evidence.push({path:name,typeTag:record.typeTag,component});
 }
 // Known non-versioned root metadata can also have been kept in a protected map.
 for(const name of ['DocumentInfo','MapInfo','Attributes','Triggers','CustomAI'])if(entries.some(e=>e.path.toLowerCase()===name.toLowerCase())){
  const raw=typeTagFor(name);assert(raw);add(raw.split('').reverse().join(''),name);
 }
 assert(rows.some(r=>r.name==='MapInfo')&&rows.some(r=>r.name==='DocumentInfo'),'Insufficient map metadata to reconstruct ComponentList');
 add('trig','Triggers');
 return {xml:'<?xml version="1.0" encoding="utf-8"?>\n<Components>\n'+rows.map(r=>'    <DataComponent Type="'+esc(r.type)+'"'+(r.locale?' Locale="'+esc(r.locale)+'"':'')+'>'+esc(r.name)+'</DataComponent>').join('\n')+'\n</Components>\n',evidence,rows,editorVerified:false};
}
