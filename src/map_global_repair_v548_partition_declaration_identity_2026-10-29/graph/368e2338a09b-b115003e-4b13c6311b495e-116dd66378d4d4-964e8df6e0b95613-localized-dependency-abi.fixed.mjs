// Display names can be localized; the compiled library ABI must use the actual







// declared symbol. Derive aliases only from locales of the same hashed mod and







// the same Variable ID. Do not infer bindings from similar titles or position.







import {readFile} from 'node:fs/promises';







import {createHash} from 'node:crypto';







import assert from 'node:assert/strict';







import {openMpqReader} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/%40modkit/blizzard-mpq/src/mpq/codec.js';







import {readAuthoredTriggerDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_implementation_2026-10-07/source-bug-v1670/subfunction-scope-v1850/read-authored.scope.mjs';







import {globalVariables,globalVariableSpellings} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';







import {parseGalaxySource} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/0b160ad329af-d83e8d2def-811635a7772277-74610374c2838123-bc62bf7a2557-08712ad196f2-galaxy-to-trigger.mjs';







import {getTypeName,unwrapArrayType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs';







const SDK=JSON.parse(await readFile(new URL('../trigger_ast_implementation_2026-10-07/CONFIG.json',"file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v24_2026-10-15/localized-dependency-abi.fixed.mjs"),'utf8')).sdk;







const sha=b=>createHash('sha256').update(b).digest('hex');







export async function bindLocalizedDependencyAbi(prepared,documents,declarations){







 const declared=new Map(),conflicts=new Set();







 for(const source of declarations){







  const ast=parseGalaxySource(source.text,source.fileName);if(ast.parseDiagnostics.length)continue;







  for(const n of ast.statements)if(n.kind===141&&n.name?.name){







   const {baseType,sizes}=unwrapArrayType(n.type),type=getTypeName(baseType),key=JSON.stringify([type,sizes.length]);







   const prior=declared.get(n.name.name);if(prior&&prior.key!==key)conflicts.add(n.name.name);







   declared.set(n.name.name,{key,type,dimensions:sizes.length});







  }







 }







 const out=documents.map(d=>({...d})),changes=[],refused=[];







 for(const mod of prepared.actualMods??[]){







  const bytes=await readFile(mod.destination);assert.equal(sha(bytes),mod.destinationSha256);







  const reader=await openMpqReader(bytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});







  try{







   const entry=reader.find('Triggers');if(!entry)continue;







   const xml=Buffer.from(await reader.read(entry.id)).toString('utf8'),hash=sha(xml);







   const docIndex=documents.map((d,i)=>sha(d.triggerData)===hash?i:-1).filter(i=>i>=0);







   if(docIndex.length!==1){refused.push({mod:mod.destination,reason:'EXACT_TRIGGER_DOCUMENT_NOT_UNIQUE'});continue;}







   const index=docIndex[0],primary=(await readAuthoredTriggerDocument(xml,SDK,documents[index].triggerStrings??'')).document;







   const candidates=new Map();







   for(const localeEntry of reader.entries)if(/^[a-z]{4}\.SC2Data[\\/]LocalizedData[\\/]TriggerStrings\.txt$/iu.test(localeEntry.path??'')){







    const strings=Buffer.from(await reader.read(localeEntry.id)).toString('utf8');







    const localized=(await readAuthoredTriggerDocument(xml,SDK,strings)).document;







    for(const library of localized.libraries.values())for(const variable of globalVariables(library)){







     if(variable.identifier!==undefined||!variable.name)continue;







     for(const spelling of globalVariableSpellings(library.id,variable)){







      const actual=declared.get(spelling);if(!actual||conflicts.has(spelling)||actual.type!==variable.variableType?.type||actual.dimensions!==(variable.isArray?(variable.arraySizes?.length??1):0))continue;







      const key=library.id+':'+variable.id,list=candidates.get(key)??new Map();list.set(spelling,{spelling,locale:localeEntry.path,localeSha256:sha(strings)});candidates.set(key,list);







     }







    }







   }







   let view=xml;







   for(const library of primary.libraries.values())for(const variable of globalVariables(library)){







    const choices=candidates.get(library.id+':'+variable.id);if(!choices||choices.size!==1||variable.identifier!==undefined)continue;







    const chosen=[...choices.values()][0];if(globalVariableSpellings(library.id,variable).includes(chosen.spelling))continue;







    const prefix=`lib${library.id}_gv_`;if(!chosen.spelling.startsWith(prefix))continue;







    const stem=chosen.spelling.slice(prefix.length);if(!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(stem))continue;







    const regex=new RegExp(`<Element\\b(?=[^>]*\\bType="Variable")(?=[^>]*\\bId="${variable.id}")[^>]*>[\\s\\S]*?<\\/Element>`,'gu');







    const blocks=[...view.matchAll(regex)];if(blocks.length!==1||/<Identifier(?:\s|>)/u.test(blocks[0][0])){refused.push({library:library.id,id:variable.id,reason:'IDENTIFIER_OR_ELEMENT_AMBIGUOUS'});continue;}







    view=view.replace(regex,block=>block.replace('</Element>',`<Identifier>${stem}</Identifier>\n</Element>`));







    changes.push({library:library.id,variable:variable.id,displayName:variable.name,exactDeclaredSymbol:chosen.spelling,sourceModSha256:mod.destinationSha256,sourceTriggerDataSha256:hash,...chosen,metadataViewOnly:true});







   }







   out[index].triggerData=view;







  }finally{reader.dispose();}







 }







 return{documents:out,proof:{changes,refused,sourceDependenciesModified:false,scope:'In-memory ABI metadata view backed by exact same-mod locale IDs and compiled declaration types'}};







}







