import {filterCaptionTables} from "./caption-keys.mjs";
﻿/** Editor's inline caption is DisplayText, independent of Value/ValueType.
 * Observed in four original corpus maps (display-name-research/ORIGINAL_GUI_PARAMS.json).
 * Read names from this map's Attributes + GameStrings; never write names into Galaxy values.
 */
const unescapeXml=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi,(_,v)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[v.toLowerCase()]);
const escapeXml=s=>s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function localeOf(p){return /(?:^|[\\/])([a-z]{2}[A-Z]{2})\.SC2Data[\\/]/.exec(p)?.[1]??'';}
export function attributeDisplayNames(localizedStrings,preferredLocale='enUS'){
 const priority=p=>{const locale=localeOf(p);return locale===preferredLocale?0:locale==='enUS'?1:locale==='enGB'?2:3;};
 const sources=[...localizedStrings].sort((a,b)=>priority(a.path)-priority(b.path)||a.path.localeCompare(b.path)),names=new Map();
 for(const source of sources){const seen=new Map();for(const line of source.values){const i=line.indexOf('=');if(i<1)continue;const key=line.slice(0,i).replace(/^\uFEFF/,''),value=line.slice(i+1);if(seen.has(key)&&seen.get(key)!==value)throw Error('Conflicting localization key in '+source.path+': '+key);seen.set(key,value);if(!names.has(key))names.set(key,{text:value,path:source.path});}}
 return names;
}
export function restoreAttributeDisplayText({triggerXml,attributes,localizedStrings,preferredLocale='enUS',parseXml}){
 const needed=new Set(attributes.attributes.flatMap(a=>[a.name,...a.values.map(v=>v.name)]).filter(Boolean));
 const names=attributeDisplayNames(filterCaptionTables(localizedStrings,needed),preferredLocale),defs=new Map(attributes.attributes.map(a=>[String(a.id),a]));
 if(defs.size!==attributes.attributes.length)throw Error('Ambiguous attribute IDs');
 const edits=[],changes=[],unresolved=[];
 function visit(n){
  if(n.tag==='Element'&&n.attributes.Type==='Param'){
   const t=n.children.find(c=>c.tag==='ValueType'),v=n.children.find(c=>c.tag==='Value'),type=t?.attributes.Type;
   if(['attributegame','attributeplayer','attributevalue'].includes(type)&&v&&!v.selfClosing&&!n.children.some(c=>['ScriptCode','FunctionCall','Variable','Parameter','Preset','ValueParam'].includes(c.tag))){
    let raw=unescapeXml(triggerXml.slice(v.openEnd,v.closeStart).trim());if(raw.startsWith('"')&&raw.endsWith('"'))raw=JSON.parse(raw);
    const pair=/^(\d+)(?:\|([^|]+))?$/.exec(raw),a=pair&&defs.get(pair[1]);
    if(a){
     let key;
     if(type==='attributevalue'){
      const token=pair[2],val=a.values.find(x=>String(x.id)===token||(/^\d{4}$/.test(token??'')&&String(x.id)===String(Number(token))));key=val?.name;
     }else{
      if(pair[2]||a.type!==(type==='attributeplayer'?'Player':'Global'))throw Error('Attribute caption type/owner mismatch');key=a.name;
     }
     const label=key&&names.get(key);
     if(!label||!label.text)unresolved.push({scope:n.scope??'',paramId:n.attributes.Id,value:raw,reason:'No nonempty authored localization name',key:key??null});
     else{
      if(/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(label.text))throw Error('Invalid XML character in attribute name');
      const displays=n.children.filter(c=>c.tag==='DisplayText');if(displays.length>1)throw Error('Duplicate DisplayText');
      const d=displays[0],old=d&&!d.selfClosing?unescapeXml(triggerXml.slice(d.openEnd,d.closeStart)):null;
      if(old!==label.text){
       const text='<DisplayText>'+escapeXml(label.text)+'</DisplayText>';
       if(d)edits.push({start:d.start,end:d.end,text});
       else{const position=Math.max(t.end,v.end),indent=triggerXml.slice(triggerXml.lastIndexOf('\n',t.start)+1,t.start).match(/^\s*/)[0],newline=triggerXml.includes('\r\n')?'\r\n':'\n';edits.push({start:position,end:position,text:newline+indent+text});}
       changes.push({scope:n.scope??'',paramId:n.attributes.Id,value:raw,valueType:type,localizationKey:key,localizationPath:label.path,previousDisplayText:old,displayText:label.text});
      }
     }
    }
   }
  }
  for(const child of n.children)visit(child);
 }
 visit(parseXml(triggerXml));let cursor=triggerXml.length;const parts=[];
 for(const e of edits.sort((a,b)=>b.start-a.start)){if(e.end>cursor)throw Error('Overlapping DisplayText edits');parts.push(triggerXml.slice(e.end,cursor),e.text);cursor=e.start;}
 parts.push(triggerXml.slice(0,cursor));const result=parts.reverse().join('');
 parseXml(result);return {triggerXml:result,changes,unresolved,valueAndValueTypeUnchanged:true,preferredLocale};
}
