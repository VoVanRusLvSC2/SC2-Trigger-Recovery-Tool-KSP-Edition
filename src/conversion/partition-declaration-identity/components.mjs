import {verifyArchiveStorageSourceComponents} from "../native-expression-identity/owned-trigger-storage-preparation.archive-bound.gui-payload.mjs";
import {mergeLocalization} from "../../utilities";
import {restoreQualifiedAttributeGui} from "../../utilities";
import {customAiComponentPlan} from "../../libraries/custom-ai/custom-ai-component-plan.mjs";
import {ensureEmptyMapCategory} from "../../recovery/repairs/empty-map-category.mjs";
/** Read-only MPQ inspection and additive recovered-component preparation.
 * Called by the batch runner; source archive and converter files are immutable.
 */
import {readFile,writeFile,mkdir,readdir} from 'node:fs/promises'
import path from 'node:path'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import {openMpqReader} from "../../vendor/@modkit/blizzard-mpq/src/mpq/codec.js"
import {xmlTree} from "../../sdk/core/modules/triggers/shared/trigger-document/lossless-xml.js"
import {writeVersionFile,parseVersionFile} from "../../sdk/core/modules/mod/codecs/document-metadata/core/version-file.js"
import {recoverComponentList} from "../../recovery/archives/component-registration.mjs"
import {readAttributes} from "../../sdk/core/modules/map/shared/format/formats/attributes.js"
import {Sc2DesktopContentSources} from "../../sdk/core/modules/game/battlenet/content-sources/local-content-sources.js"
import {restoreAttributeGui,nativeAttributeGuiSchema} from "../../utilities/attribute-gui.mjs"
import {restoreAttributeDisplayText} from "../../recovery/repairs/attribute-display-fixed.mjs"
import {restoreExternalDisplayText} from "./string-external-display-fixed.mjs"
import {applyEditorProfile} from "../../libraries/triggers/services/editor-recovery-addon/editor-profile.mjs"
export async function components(mode,archivePath,jobPath,session,storageSourceCapability){
const job=path.resolve(jobPath),sha=x=>createHash('sha256').update(x).digest('hex')
const canonical=name=>name.replaceAll('\\','/').toLowerCase()
const save=async(file,bytes)=>{await mkdir(path.dirname(file),{recursive:true});await writeFile(file,bytes)}
const bytes=await readFile(archivePath)
const reader=await openMpqReader(bytes,{maxArchiveBytes:512*1024*1024,maxEntries:100000,maxEntryBytes:512*1024*1024})
try{
 if(mode==='inspect'||mode==='verify'){
  const entries=[],folder=path.join(job,mode==='inspect'?'original-inspection':'restored-inspection')
  for(const entry of reader.entries){
   const data=Buffer.from(await reader.read(entry.id)),name=entry.path.replaceAll('\\','/')
   entries.push({path:name,size:data.length,sha256:sha(data)})
   // Extract only the small metadata/localization and the Galaxy source needed
   // for independent checks; textures/models stay solely in the map copies.
   if(mode==='inspect'&&(name.toLowerCase().endsWith('.galaxy')||canonical(name)==='attributes'||name.endsWith('.version')
      ||canonical(name)==='componentlist.sc2components'||/^[a-z]{2}[a-z]{2}\.sc2data\/localizeddata\/(triggerstrings|gamestrings)\.txt$/iu.test(name))){
    assert(!name.split('/').some(part=>part==='..'),'Unsafe component path')
    const target=path.resolve(folder,...name.split('/'));assert(target.startsWith(path.resolve(folder)+path.sep),'Unsafe extraction path');await save(target,data)
   }
  }
  const inventory={archive:archivePath,archiveSha256:sha(bytes),archiveBytes:bytes.length,
   recovered:reader.recovered,headerRepaired:reader.headerRepaired,entries}
  await save(path.join(folder,'inventory.json'),JSON.stringify(inventory,null,2))
  if(mode==='verify'){
   const old=JSON.parse(await readFile(path.join(job,'original-inspection/inventory.json'),'utf8'))
   const manifest=JSON.parse(await readFile(path.join(job,'components/manifest.json'),'utf8'))
   const before=new Map(old.entries.map(e=>[canonical(e.path),e])),after=new Map(entries.map(e=>[canonical(e.path),e]))
   const changed=new Map(manifest.components.map(e=>[canonical(e.path),e]))
   const internal=new Set(['(listfile)','(attributes)','(signature)'])
   let unchanged=0
   for(const [key,entry] of before){
    if(internal.has(key)||changed.has(key))continue
    assert.equal(after.get(key)?.sha256,entry.sha256,'Unrelated payload changed/missing: '+entry.path);unchanged++
   }
   for(const [key,entry] of changed)assert.equal(after.get(key)?.sha256,entry.sha256,'Component mismatch: '+entry.path)
   for(const key of after.keys())assert(before.has(key)||changed.has(key)||internal.has(key),'Unexpected new payload '+key)
   const originalGalaxyPreserved=after.get('mapscript.galaxy')?.sha256===before.get('mapscript.galaxy')?.sha256
   const verifiedSourceStorage=originalGalaxyPreserved?undefined:verifyArchiveStorageSourceComponents(storageSourceCapability,
    {beforeEntries:old.entries,afterEntries:entries,manifest})
   assert(!reader.recovered&&!reader.headerRepaired,'Restored archive needs repair')
   const verified={passed:true,unchangedPayloads:unchanged,originalGalaxyPreserved,verifiedSourceStorage,
    originalAttributesPreserved:before.has('attributes')?after.get('attributes')?.sha256===before.get('attributes').sha256:null,
    archiveSha256:sha(bytes),componentCount:changed.size,editorAcceptance:'pending: separate actual Editor compile/export evidence required'}
   await save(path.join(job,'PACKAGE_VERIFICATION.json'),JSON.stringify(verified,null,2))
   console.log(JSON.stringify(verified))
  }else console.log(JSON.stringify({entries:entries.length,archiveBytes:bytes.length,hasGalaxy:!!reader.find('MapScript.galaxy'),hasTriggers:!!reader.find('Triggers')}))
 }else if(mode==='prepare'){
  const generated=path.join(job,'conversion'),stage=path.join(job,'components')
  const manifest={components:[],profile:null,localization:[],versionPolicy:null,attributesPolicy:'Preserve original Attributes; recovered candidate remains separate',editorAcceptance:'pending'}
  const add=async(name,data)=>{const buffer=Buffer.from(data);await save(path.join(stage,...name.split('/')),buffer);manifest.components.push({path:name,bytes:buffer.length,sha256:sha(buffer)})}
  const oldBytes=async name=>{const entry=reader.find(name);return entry?Buffer.from(await reader.read(entry.id)):Buffer.alloc(0)}
  const merge=mergeLocalization
  let xml=await readFile(path.join(generated,'Triggers'),'utf8');xmlTree(xml)
  const strings=new Map()
  for(const locale of await readdir(generated)){
   if(!/^[a-z]{2}[A-Z]{2}\.SC2Data$/u.test(locale))continue
   for(const file of ['TriggerStrings.txt','GameStrings.txt']){
    const name=locale+'/LocalizedData/'+file
    let recovered
    try{recovered=await readFile(path.join(generated,...name.split('/')),'utf8')}catch(error){if(error.code==='ENOENT')continue;throw error}
    const original=await oldBytes(name),merged=merge(original,recovered)
    strings.set(name,{original,bytes:merged.bytes})
    manifest.localization.push({path:name,originalKeysPreserved:true,addedKeys:merged.added,conflictsRetainedAsOriginal:merged.conflicts})
   }
  }
  // Apply optional folder/flag metadata only to the known generated map shape.
  // Multi-library documents are retained intact and explicitly reported.
  const primary=[...strings.keys()].find(name=>name.startsWith('enUS.')&&name.endsWith('TriggerStrings.txt'))
   ?? [...strings.keys()].find(name=>name.endsWith('TriggerStrings.txt'))
  try{
   const profile=applyEditorProfile(xml,{parseXml:xmlTree,triggerStrings:primary?strings.get(primary).bytes.toString('utf8'):''})
   xml=profile.xml
   manifest.profile={counts:profile.counts,changes:profile.changes,notes:profile.notes}
   if(primary)strings.get(primary).bytes=Buffer.from(profile.triggerStrings)
  }catch(error){
   if(!/populated implicit map Root|Generated Functions\/Actions|non-bool return type|category expansion/u.test(error.message))throw error
   manifest.profile={skipped:true,reason:error.message}
  }
  // UI caption only: preserve runtime StringExternal keys and all authored locales.
  const captionTables=new Map()
  for(const e of reader.entries)if(/localizeddata[\\/](?:game|trigger)strings\.txt$/i.test(e.path))captionTables.set(canonical(e.path),{path:e.path,values:Buffer.from(await reader.read(e.id)).toString('utf8').split(/\r?\n/)})
  for(const [name,value] of strings)captionTables.set(canonical(name),{path:name,values:value.bytes.toString('utf8').split(/\r?\n/)})
  const conversionReport=JSON.parse(await readFile(path.join(generated,'report.json'),'utf8'))
  const category=ensureEmptyMapCategory(xml,xmlTree);xml=category.xml;manifest.mapCategoryVisibility={...category,xml:undefined};
  if(category.added){
   const names=[...strings.keys()].filter(name=>name.endsWith('TriggerStrings.txt'));
   if(!names.length){const name=(conversionReport.locale??'enUS')+'.SC2Data/LocalizedData/TriggerStrings.txt';strings.set(name,{original:await oldBytes(name),bytes:await oldBytes(name)});names.push(name);}
   for(const name of names){const entry=strings.get(name),text=entry.bytes.toString('utf8');entry.bytes=Buffer.from(text+(text.endsWith('\n')||!text?'':'\n')+`Category/Name/${category.id}=Triggers\n`);}
  }
  const captions=restoreExternalDisplayText({triggerXml:xml,localizedStrings:[...captionTables.values()],preferredLocale:conversionReport.locale??'enUS',parseXml:xmlTree})
  xml=captions.triggerXml
  manifest.stringExternalDisplay={changes:captions.changes,unresolved:captions.unresolved,preferredLocale:captions.preferredLocale,scriptCodeUnchanged:captions.scriptCodeUnchanged}
  // Existing authored Attributes are authoritative. Never invent defaults for this corpus.
  // Optional GUI passes use live CASC NativeLib and this map's localized names.
  const originalAttributeBytes=await oldBytes('Attributes');
  const exactSource=session.attributeMode==='with-attribute-recovery'?session.attributeRecoverySource:null;
  const recoveredAttributeBytes=!originalAttributeBytes.length&&exactSource?.used?Buffer.from(exactSource.xml):Buffer.alloc(0);
  const attributeBytes=originalAttributeBytes.length?originalAttributeBytes:recoveredAttributeBytes;
  if(recoveredAttributeBytes.length){
   await add('Attributes',recoveredAttributeBytes);manifest.exactAttributeSource=exactSource.proof;
   manifest.attributesPolicy=exactSource.proof.attributesPolicy??'Definitions/defaults from exact original archive s2mh; other lobby variants/unknown requirements not claimed; no invented defaults';
   const versionBytes=await oldBytes('Attributes.version');
   if(versionBytes.length)assert.equal(parseVersionFile(versionBytes).typeTag,'rtta');
   else{
    const v=JSON.parse(await readFile(path.join(job,'editor-version.json'),'utf8'));
    const bytes=Buffer.from(writeVersionFile({typeTag:'rtta',formatVersion:2,buildNumber:v.build,buildNumber2:v.build,majorVersion:v.major,minorVersion:v.minor,patchVersion:v.patch,entryCount:exactSource.model.attributes.length,timestamp:Math.floor(Date.now()/1000),terminal:1}));
    assert(Buffer.from(writeVersionFile(parseVersionFile(bytes))).equals(bytes));await add('Attributes.version',bytes);
    manifest.attributeVersionPolicy='New candidate rtta v2 sidecar for installed Editor; native acceptance pending';
   }
  }
  if(attributeBytes.length && session.attributeMode==='with-attribute-recovery'){
   const beforeGui=xml;let sources,context
   try{
    const attributes=readAttributes(attributeBytes.toString('utf8'))
    if(attributes.attributes.length){
     sources=session.sources
     context=await session.open({schemaVersion:1,target:archivePath})
     const native=await context.locate('Base.SC2Data/TriggerLibs/NativeLib.TriggerLib');assert(native,'Missing live NativeLib')
     const nativeXml=Buffer.from(await context.read(native.layerId,native.path,64*1024**2)).toString('utf8')
     const gui=restoreAttributeGui({triggerXml:xml,attributes,schema:nativeAttributeGuiSchema(nativeXml,xmlTree),parseXml:xmlTree})
     const tables=new Map()
     for(const e of reader.entries)if(/localizeddata[\\/]gamestrings\.txt$/i.test(e.path))tables.set(canonical(e.path),{path:e.path,values:Buffer.from(await reader.read(e.id)).toString('utf8').split(/\r?\n/)})
     for(const [name,value] of strings)if(/gamestrings\.txt$/i.test(name))tables.set(canonical(name),{path:name,values:value.bytes.toString('utf8').split(/\r?\n/)})
     if(exactSource?.used){
      const linked=restoreQualifiedAttributeGui({triggerXml:xml,attributes,schema:nativeAttributeGuiSchema(nativeXml,xmlTree),localizedStrings:[...tables.values()],parseXml:xmlTree,namespace:exactSource.namespace});
      xml=linked.triggerXml;manifest.attributeGui={...linked,triggerXml:undefined,nativeReadLive:true};
     }else{
      const display=restoreAttributeDisplayText({triggerXml:gui.triggerXml,attributes,localizedStrings:[...tables.values()],parseXml:xmlTree});
      xml=display.triggerXml;manifest.attributeGui={changes:gui.changes,displayChanges:display.changes,unresolved:display.unresolved,nativeReadLive:true};
     }
    }else manifest.attributeGui={definitionCount:0}
   }catch(error){xml=beforeGui;manifest.attributeGui={skipped:true,reason:String(error)}}
   finally{if(context)await session.release(context)}
  }else manifest.attributeGui={skipped:true,reason:session.attributeMode==='without-attribute-recovery'?'Attribute GUI restoration disabled for control variant; original definitions/defaults retained':'No original Attributes; recovered definitions remain diagnostic; no invented defaults'}
  await add('Triggers',xml)
  for(const [name,{original,bytes}] of strings)if(!original.equals(bytes))await add(name,bytes)
  let recoveredCustomAi
  try{recoveredCustomAi=await readFile(path.join(generated,'CustomAI'))}catch(error){if(error.code!=='ENOENT')throw error}
  const customAi=customAiComponentPlan({originalDocument:await oldBytes('CustomAI'),originalVersion:await oldBytes('CustomAI.version'),
   recoveredDocument:recoveredCustomAi,report:JSON.parse(await readFile(path.join(generated,'report.json'),'utf8')),parseXml:xmlTree,version:JSON.parse(await readFile(path.join(job,'editor-version.json'),'utf8'))})
  manifest.customAiPolicy=customAi.policy
  for(const component of customAi.components)await add(component.path,component.bytes)
  const originalVersion=await oldBytes('Triggers.version')
  if(originalVersion.length){parseVersionFile(originalVersion);manifest.versionPolicy='original record retained byte-for-byte'}
  else{
   const version=JSON.parse(await readFile(path.join(job,'editor-version.json'),'utf8'))
   const record=writeVersionFile({typeTag:'girt',formatVersion:2,buildNumber:version.build,buildNumber2:version.build,
    majorVersion:version.major,minorVersion:version.minor,patchVersion:version.patch,entryCount:0,timestamp:Math.floor(Date.now()/1000),terminal:1})
   assert.deepEqual(writeVersionFile(parseVersionFile(record)),record)
   await add('Triggers.version',record)
   manifest.versionPolicy='new experimental 44-byte v2 girt record for installed Editor; original record missing; load not proved'
  }
  const originalList=await oldBytes('ComponentList.SC2Components')
  if(!originalList.length){
   // Register added AI metadata from its own generated sidecar as well as the
   // original records. No source payload or source version is replaced here.
   const virtual=new Map(await Promise.all(manifest.components.map(async c=>[c.path,await readFile(path.join(stage,...c.path.split('/')))])))
   const entries=[...reader.entries,...manifest.components.filter(c=>!reader.find(c.path)).map(c=>({path:c.path,id:'new:'+c.path}))]
   const reconstructed=await recoverComponentList(entries,id=>typeof id==='string'&&id.startsWith('new:')?virtual.get(id.slice(4)):reader.read(id))
   xmlTree(reconstructed.xml);await add('ComponentList.SC2Components',reconstructed.xml)
   manifest.registration={policy:'Reconstructed from original version records/locales; Editor acceptance pending',...reconstructed,xml:undefined}
   await save(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2))
   console.log(JSON.stringify({components:manifest.components.length,registration:manifest.registration.policy}));process.exitCode=0
  }else{
  let list=originalList.toString('utf8');const tree=xmlTree(list);assert.equal(tree.tag,'Components')
  const trig=tree.children.filter(child=>child.tag==='DataComponent'&&child.attributes.Type==='trig')
  assert(trig.length<=1,'Ambiguous Triggers component registration')
  if(trig.length){assert.equal(list.slice(trig[0].openEnd,trig[0].closeStart).trim(),'Triggers','Unknown trigger component path')}
  else{
   assert(!tree.selfClosing,'Empty component list requires explicit reconstruction')
   list=list.slice(0,tree.closeStart)+'    <DataComponent Type="trig">Triggers</DataComponent>\n'+list.slice(tree.closeStart)
   xmlTree(list);await add('ComponentList.SC2Components',list)
  }
  if(customAi.registrationNeeded){
   const current=xmlTree(list),ai=current.children.filter(child=>child.tag==='DataComponent'&&child.attributes.Type==='aiai')
   assert(ai.length<=1,'Ambiguous CustomAI component registration')
   if(ai.length)assert.equal(list.slice(ai[0].openEnd,ai[0].closeStart).trim(),'CustomAI','Unknown CustomAI component path')
   else{assert(!current.selfClosing,'Cannot append CustomAI to a self-closing ComponentList');
    list=list.slice(0,current.closeStart)+'    <DataComponent Type="aiai">CustomAI</DataComponent>\n'+list.slice(current.closeStart)
    xmlTree(list)
    // Replace only our staged list, never an authored map or prior attempt.
    const present=manifest.components.findIndex(c=>c.path==='ComponentList.SC2Components')
    if(present>=0)manifest.components.splice(present,1)
    await add('ComponentList.SC2Components',list)
   }
  }
  if(recoveredAttributeBytes.length){
   const current=xmlTree(list),attrs=current.children.filter(n=>n.tag==='DataComponent'&&n.attributes.Type==='attr');
   assert(attrs.length<=1,'Ambiguous Attributes registration');
   if(attrs.length)assert.equal(list.slice(attrs[0].openEnd,attrs[0].closeStart).trim(),'Attributes');
   else{assert(!current.selfClosing);list=list.slice(0,current.closeStart)+'    <DataComponent Type="attr">Attributes</DataComponent>\n'+list.slice(current.closeStart);xmlTree(list);
    const present=manifest.components.findIndex(c=>c.path==='ComponentList.SC2Components');if(present>=0)manifest.components.splice(present,1);await add('ComponentList.SC2Components',list);
   }
  }
  manifest.registration='existing component preserved or missing registration appended'
  await save(path.join(stage,'manifest.json'),JSON.stringify(manifest,null,2))
  console.log(JSON.stringify({components:manifest.components.length,profile:manifest.profile?.counts??manifest.profile,versionPolicy:manifest.versionPolicy}))
 }
 }else throw new Error('Unknown operation '+mode)
}finally{reader.dispose()}

}
