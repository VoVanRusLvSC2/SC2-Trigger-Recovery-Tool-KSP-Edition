// Resolve foreign structure members through the same hashed dependency's
// locale IDs and compiled owner/field/type. This is a metadata view only.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {bindLocalizedDependencyAbi as bindCalls,patchUniqueIdentifier} from "./localized-call-trigger-abi.mjs";
import {Parser,SyntaxKind as K} from "../exact-function-signatures/index-alternate-3.js";
import {openMpqReader} from "../../vendor/@modkit/blizzard-mpq/src/mpq/codec.js";
import {readAuthoredTriggerDocument} from "../../ast/read-authored.scope.mjs";
import {memberVarName,structureTypeName,mapParameterTypeToGalaxy,resolveRefFull,withIsolatedNamingIndexes} from "../native-expression-identity/core-alternate.mjs";
import {getTypeName,unwrapArrayType} from "../native-expression-identity/g2t-core.generated-call-provenance.mjs";
const sha=b=>createHash('sha256').update(b).digest('hex');
const sdk=JSON.parse(await readFile(new URL('../trigger_ast_implementation_2026-10-07/CONFIG.json',new URL("../../libraries/gui/localized-struct-member-abi.mjs", import.meta.url).href),'utf8')).sdk;
export function collectStructAbi(declarations){
 const structures=new Map(),conflicts=new Set();
 for(const input of declarations){
  const ast=new Parser().parseFile(input.fileName??'struct.galaxy',input.text);assert.equal(ast.parseDiagnostics.length,0);
  for(const n of ast.statements)if(n.kind===K.StructDeclaration){
   const fields=n.members.map(m=>{const {baseType,sizes}=unwrapArrayType(m.type);return [m.name.name,getTypeName(baseType),sizes.length];});
   const signature=JSON.stringify(fields),name=n.name.name;
   if(new Set(fields.map(f=>f[0])).size!==fields.length||(structures.has(name)&&structures.get(name).signature!==signature))conflicts.add(name);
   structures.set(name,{signature,fields});
  }
 }
 return {matches:(owner,name,type,dimensions)=>!conflicts.has(owner)&&!!structures.get(owner)?.fields.some(f=>f[0]===name&&f[1]===type&&f[2]===dimensions)};
}
export function patchMemberDisplayName(strings,{library,id,stem}){
 assert(/^[A-Za-z0-9]+$/.test(library)&&/^[A-Fa-f0-9]{8}$/.test(id)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(stem));
 const key=`Variable/Name/lib_${library}_${id}`;
 const re=new RegExp(`^${key}=([^\\r\\n]*)`,'gmu');
 if([...strings.matchAll(re)].length!==1)return null;
 return strings.replace(re,key+'='+stem);
}
export async function bindLocalizedDependencyAbi(prepared,documents,declarations){
 const base=await bindCalls(prepared,documents,declarations),abi=collectStructAbi(declarations);
 const out=base.documents.map(d=>({...d})),changes=[...base.proof.changes],refused=[...base.proof.refused];
 for(const mod of prepared.actualMods??[]){
  const bytes=await readFile(mod.destination);assert.equal(sha(bytes),mod.destinationSha256);
  const mpq=await openMpqReader(bytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
  try{
   const te=mpq.find('Triggers');if(!te)continue;
   const xml=Buffer.from(await mpq.read(te.id)).toString('utf8'),sourceHash=sha(xml);
   const indices=documents.flatMap((d,i)=>sha(d.triggerData)===sourceHash?[i]:[]);if(indices.length!==1)continue;
   const index=indices[0],choices=new Map();
   for(const e of mpq.entries.filter(e=>/^[a-z]{4}\.SC2Data[\\/]LocalizedData[\\/]TriggerStrings\.txt$/iu.test(e.path??''))){
    const strings=Buffer.from(await mpq.read(e.id)).toString('utf8'),doc=(await readAuthoredTriggerDocument(xml,sdk,strings)).document;
    withIsolatedNamingIndexes(()=>{
     for(const lib of doc.libraries.values())for(const st of Object.values(lib.elements).filter(e=>e.type==='Structure')){
      const owner=structureTypeName({type:'Structure',library:lib.id,id:st.id},lib,undefined,doc.libraries);if(!owner)continue;
      for(const ref of st.variables??[]){
       if((ref.library??lib.id)!==lib.id)continue;
       const member=resolveRefFull(ref,lib,undefined,doc.libraries);if(!member||member.identifier!==undefined||member.disabled)continue;
       const spelling=memberVarName(member,lib.id),type=mapParameterTypeToGalaxy(member.variableType,lib,undefined,doc.libraries),dimensions=member.isArray?(member.arraySizes?.length??1):0;
       if(!spelling.startsWith('lv_')||!abi.matches(owner,spelling,type,dimensions))continue;
       const key=lib.id+':'+st.id+':'+member.id,list=choices.get(key)??new Map();
       list.set(spelling,{owner,spelling,stem:spelling.slice(3),type,dimensions,locale:e.path,localeSha256:sha(strings)});choices.set(key,list);
      }
     }
    });
   }
   const primary=(await readAuthoredTriggerDocument(out[index].triggerData,sdk,out[index].triggerStrings??'')).document;
   let view=out[index].triggerData,strings=out[index].triggerStrings??'';
   for(const lib of primary.libraries.values())for(const st of Object.values(lib.elements).filter(e=>e.type==='Structure'))for(const ref of st.variables??[]){
    const member=resolveRefFull(ref,lib,undefined,primary.libraries),list=choices.get(lib.id+':'+st.id+':'+ref.id);
    if(!member||member.identifier!==undefined||!list)continue;
    if(list.size!==1){refused.push({library:lib.id,id:member.id,reason:'AMBIGUOUS_STRUCT_MEMBER_LOCALE_ABI'});continue;}
    const chosen=[...list.values()][0];if(memberVarName(member,lib.id)===chosen.spelling)continue;
    const patchedXml=patchUniqueIdentifier(view,{type:'Variable',id:member.id,stem:chosen.stem});
    const patchedStrings=patchMemberDisplayName(strings,{library:lib.id,id:member.id,stem:chosen.stem});
    if(patchedXml===null||patchedStrings===null){refused.push({library:lib.id,id:member.id,reason:'MEMBER_METADATA_PATCH_AMBIGUOUS'});continue;}
    // The foreign-member resolver deliberately uses the owner's compiled name
    // even when Identifier exists, so both metadata fields must agree. Neither
    // this view's labels nor XML are written back to the dependency archive.
    view=patchedXml;strings=patchedStrings;
    changes.push({library:lib.id,id:member.id,structure:st.id,elementType:'StructureMember',displayName:member.name,exactDeclaredSymbol:chosen.owner+'.'+chosen.spelling,sourceModSha256:mod.destinationSha256,sourceTriggerDataSha256:sourceHash,...chosen,sameElementIdAcrossLocales:true,exactCompiledOwnerFieldType:true,metadataViewOnly:true});
   }
   out[index].triggerData=view;out[index].triggerStrings=strings;
  }finally{mpq.dispose();}
 }
 return {documents:out,proof:{changes,refused,sourceDependenciesModified:false,sourceGalaxyModified:false,scope:'Same-mod locale IDs and compiled function/global/trigger/structure-member ABI; metadata views only; no Native/raw synthesis'}};
}
