// Extend the established variable-only metadata view. Dependency archives and
// the source Galaxy remain unchanged; aliases need same-mod locale IDs and ABI.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {bindLocalizedDependencyAbi as bindVariables} from '../map_global_repair_v24_2026-10-15/localized-dependency-abi.fixed.mjs';
import {Parser,SyntaxKind as K} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {openMpqReader} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
import {readAuthoredTriggerDocument} from '../trigger_ast_implementation_2026-10-07/source-bug-v1670/subfunction-scope-v1850/read-authored.scope.mjs';
import {globalVariables,globalVariableSpellings} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {toGalaxyFunctionName,triggerHandleName,mapParameterTypeToGalaxy,withIsolatedNamingIndexes,resolveRefFull,deriveNativeTypeMapping} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {getTypeName,unwrapArrayType} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const sha=b=>createHash('sha256').update(b).digest('hex');
const sdk=JSON.parse(await readFile(new URL('../trigger_ast_implementation_2026-10-07/CONFIG.json',import.meta.url),'utf8')).sdk;
const typeKey=t=>{const {baseType,sizes}=unwrapArrayType(t);return [getTypeName(baseType),sizes.length];};
export function collectAbiSignatures(declarations){
 const signatures=new Map(),conflicts=new Set();
 for(const input of declarations){
  const ast=new Parser().parseFile(input.fileName??'abi.galaxy',input.text);
  assert.equal(ast.parseDiagnostics.length,0,'Malformed ABI declarations');
  for(const n of ast.statements){
   let signature;
   if(n.kind===K.VariableDeclaration)signature=['Variable',typeKey(n.type)];
   if(n.kind===K.FunctionDeclaration)signature=['FunctionDef',typeKey(n.type),n.parameters.map(p=>typeKey(p.type))];
   if(!signature)continue;
   const key=JSON.stringify(signature),name=n.name.name;
   if(signatures.has(name)&&signatures.get(name)!==key)conflicts.add(name);
   signatures.set(name,key);
  }
 }
 return {matches:(name,signature)=>!conflicts.has(name)&&signatures.get(name)===JSON.stringify(signature),conflicts};
}
export function patchUniqueIdentifier(xml,{type,id,stem}){
 assert(/^(Variable|FunctionDef|Trigger)$/.test(type)&&/^[A-Fa-f0-9]{8}$/.test(id)&&/^[A-Za-z_][A-Za-z0-9_]*$/.test(stem));
 const pattern=new RegExp(`<Element\\b(?=[^>]*\\bType="${type}")(?=[^>]*\\bId="${id}")[^>]*>[\\s\\S]*?<\\/Element>`,'gu');
 const blocks=[...xml.matchAll(pattern)];
 if(blocks.length!==1||/<Identifier(?:\s|>)/u.test(blocks[0][0]))return null;
 return xml.replace(pattern,b=>b.replace('</Element>',`<Identifier>${stem}</Identifier>\n</Element>`));
}
export async function bindLocalizedDependencyAbi(prepared,documents,declarations){
 const baseline=await bindVariables(prepared,documents,declarations);
 const abi=collectAbiSignatures(declarations),changes=[...baseline.proof.changes],refused=[...baseline.proof.refused];
 const out=baseline.documents.map(d=>({...d}));
 // Preset parameter types can belong to another mounted library (notably
 // Ntve). Lower them from the actual supplied documents, never from a guessed
 // preset-to-primitive table or from the Galaxy declaration being matched.
 const mountedLibraries=new Map();
 for(const d of documents){
  const parsed=(await readAuthoredTriggerDocument(d.triggerData,sdk,d.triggerStrings??'')).document;
  for(const lib of parsed.libraries.values())if(lib.id!=='Map'){
   const prior=mountedLibraries.get(lib.id);
   assert(!prior||JSON.stringify(prior)===JSON.stringify(lib),'Ambiguous mounted library ID '+lib.id);
   mountedLibraries.set(lib.id,lib);
  }
 }
 const nativeTypes=mountedLibraries.get('Ntve');
 if(nativeTypes)deriveNativeTypeMapping(nativeTypes,declarations);
 for(const mod of prepared.actualMods??[]){
  const bytes=await readFile(mod.destination);assert.equal(sha(bytes),mod.destinationSha256);
  const mpq=await openMpqReader(bytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
  try{
   const entry=mpq.find('Triggers');if(!entry)continue;
   const xml=Buffer.from(await mpq.read(entry.id)).toString('utf8'),sourceHash=sha(xml);
   const indices=documents.flatMap((d,i)=>sha(d.triggerData)===sourceHash?[i]:[]);
   if(indices.length!==1){refused.push({mod:mod.destination,reason:'EXACT_TRIGGER_DOCUMENT_NOT_UNIQUE'});continue;}
   const index=indices[0],primary=(await readAuthoredTriggerDocument(out[index].triggerData,sdk,out[index].triggerStrings??'')).document;
   const candidates=new Map();
   for(const e of mpq.entries.filter(e=>/^[a-z]{4}\.SC2Data[\\/]LocalizedData[\\/]TriggerStrings\.txt$/iu.test(e.path??''))){
    const strings=Buffer.from(await mpq.read(e.id)).toString('utf8');
    const doc=(await readAuthoredTriggerDocument(xml,sdk,strings)).document;
    const allLibraries=new Map([...mountedLibraries,...doc.libraries]);
    const nativeLibrary=allLibraries.get('Ntve');
    withIsolatedNamingIndexes(()=>{
     for(const lib of doc.libraries.values()){
      const globals=new Set(globalVariables(lib).map(v=>v.id));
      const ctx={library:lib,libId:lib.id,allLibraries,nativeLibrary};
      const mapped=t=>[mapParameterTypeToGalaxy(t,lib,nativeLibrary,allLibraries),0];
      for(const el of Object.values(lib.elements)){
       if(el.identifier!==undefined||!el.name||el.disabled)continue;
       let spellings=[],signature,prefix;
       if(el.type==='Variable'&&globals.has(el.id)){
        spellings=globalVariableSpellings(lib.id,el);signature=['Variable',[mapped(el.variableType)[0],el.isArray?(el.arraySizes?.length??1):0]];prefix=`lib${lib.id}_gv_`;
       }else if(el.type==='Trigger'){
        spellings=[triggerHandleName(lib.id,el)];signature=['Variable',['trigger',0]];prefix=`lib${lib.id}_gt_`;
       }else if(el.type==='FunctionDef'&&!el.flags?.includes('Native')&&!el.flags?.includes('NoScriptPrefix')){
        // Authored-document keys can include the element kind: an ID alone is
        // not a complete lookup key. Use the same typed resolver as conversion.
        const params=(el.parameters??[]).map(r=>resolveRefFull(r,lib,nativeLibrary,allLibraries));
        if(params.some(p=>!p||p.isArray||p.arraySizes?.length))continue;
        spellings=[toGalaxyFunctionName(el,ctx)];signature=['FunctionDef',mapped(el.returnType??{type:'void'}),params.map(p=>mapped(p.paramType))];prefix=`lib${lib.id}_gf_`;
       }else continue;
       for(const spelling of spellings){
        if(!spelling.startsWith(prefix)||!abi.matches(spelling,signature))continue;
        const stem=spelling.slice(prefix.length);if(!/^[A-Za-z_][A-Za-z0-9_]*$/.test(stem))continue;
        const key=lib.id+':'+el.type+':'+el.id,list=candidates.get(key)??new Map();
        list.set(spelling,{spelling,stem,signature,locale:e.path,localeSha256:sha(strings)});candidates.set(key,list);
       }
      }
     }
    });
   }
   let view=out[index].triggerData;
   for(const lib of primary.libraries.values())for(const el of Object.values(lib.elements)){
    const choices=candidates.get(lib.id+':'+el.type+':'+el.id);if(!choices||el.identifier!==undefined)continue;
    if(choices.size!==1){refused.push({library:lib.id,id:el.id,reason:'AMBIGUOUS_DECLARED_LOCALE_ABI'});continue;}
    const chosen=[...choices.values()][0];
    const currentNames=withIsolatedNamingIndexes(()=>{
     if(el.type==='Variable')return globalVariableSpellings(lib.id,el);
     if(el.type==='Trigger')return [triggerHandleName(lib.id,el)];
     return [toGalaxyFunctionName(el,{library:lib,libId:lib.id,allLibraries:new Map([...mountedLibraries,...primary.libraries]),nativeLibrary:mountedLibraries.get('Ntve')})];
    });
    if(currentNames.includes(chosen.spelling))continue;
    const patched=patchUniqueIdentifier(view,{type:el.type,id:el.id,stem:chosen.stem});
    if(patched===null){refused.push({library:lib.id,id:el.id,reason:'IDENTIFIER_OR_ELEMENT_AMBIGUOUS'});continue;}
    view=patched;
    changes.push({library:lib.id,id:el.id,elementType:el.type,displayName:el.name,exactDeclaredSymbol:chosen.spelling,sourceModSha256:mod.destinationSha256,sourceTriggerDataSha256:sourceHash,...chosen,metadataViewOnly:true,sameElementIdAcrossLocales:true,exactLoweredSignature:true});
   }
   out[index].triggerData=view;
  }finally{mpq.dispose();}
 }
 return {documents:out,proof:{changes,refused,sourceDependenciesModified:false,sourceGalaxyModified:false,scope:'Same-mod locale-ID ABI metadata view; exact lowered global/function/trigger signatures; no struct-member or Native synthesis'}};
}
