// A GUI text literal may compile to StringExternal("") when its key is absent
// in the Editor's active locale. Keep the authored lookup as the actual loaded
// native GUI call if any supplied locale lacks a unique nonempty value.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {parseOwnedTriggerDocument} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/9df4e70daea3-55336c934a77-8700bdf83655-62a38b2020d9-ba49c37dce1d-trigger_document_scope_v383.mjs';
import {xmlTree} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-local-identifier-v306-2026-10-05/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {parseLocalizedValueTable} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/queue_audit_2026-10-15/localized-value-retention.mjs';
import {applyDisjointXmlPatches} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/apply_disjoint_xml_patches_v661.mjs';
import {recoverLocalizedExternalGui as original} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/7e836cc4ec1e-01a55c486cd1-32316d5d44e2-a34e04cdceb1-52486bc415f5-localized_external_gui_v664.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;');
export function recoverLocalizedExternalGui({triggerXml,localizedTables,nativeTriggerData,source}){
 assert.equal(typeof source,'string');const ast=new Parser().parseFile('localized-key-source.galaxy',source);assert.equal(ast.parseDiagnostics.length,0,'INVALID_LOCALIZED_KEY_SOURCE');
 const sourceKeys=new Set();
 const visit=n=>{if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&n.expression.name==='StringExternal'&&n.arguments?.length===1&&n.arguments[0].kind===K.StringLiteral)sourceKeys.add(n.arguments[0].value);forEachChild(n,visit);};visit(ast);
 const tables=localizedTables.filter(t=>/^[a-z]{2}[A-Z]{2}$/u.test(t.locale??'')).map(t=>({locale:t.locale,values:parseLocalizedValueTable(Buffer.from(t.gameStrings??'','utf8')).values}));
 assert.equal(new Set(tables.map(t=>t.locale)).size,tables.length,'DUPLICATE_REAL_LOCALE');
 const libs=parseOwnedTriggerDocument(triggerXml),tree=xmlTree(triggerXml),implicit=[...libs.values()].find(l=>l.implicit)?.id,patches=[],retained=[];
 const walk=(n,parent)=>{
  const owner=n.tag==='Library'?n.attributes.Id:parent;
  if(n.tag==='Element'&&n.attributes.Type==='Param'){
   const lib=libs.get(owner),id=n.attributes.Id,p=lib?.elementsByType.Param?.[id];
   const key=lib?.implicit?`Param/Value/${id}`:`Param/Value/lib_${owner}_${id}`;
   const valueFields=['scriptCode','expressionCode','functionCall','variable','paramRef','preset','valueElement','valueId','value','array','structMember','localizedValue'];
   if(p?.valueType?.type==='text'&&sourceKeys.has(key)&&valueFields.every(k=>p[k]===undefined)){
    const missing=tables.filter(t=>{const v=t.values.get(key);return !v||v.length!==1||v.includes('');});
    if(!tables.length||missing.length){
     assert(!n.selfClosing&&Number.isInteger(n.closeStart),'TEXT_PARAM_INSERTION_UNPROVEN');
     patches.push({start:n.closeStart,end:n.closeStart,text:`<ScriptCode>${escape('StringExternal('+JSON.stringify(key)+')')}</ScriptCode>`});
     retained.push({library:owner,id,key,missingOrEmptyLocales:missing.map(t=>t.locale),authoredLiteralLookupVerified:true});
    }
   }
  }
  for(const c of n.children)walk(c,owner);
 };walk(tree,implicit);
 const augmented=applyDisjointXmlPatches(triggerXml,patches),result=original({triggerXml:augmented,localizedTables,nativeTriggerData});
 const parsed=parseOwnedTriggerDocument(result.triggerXml);
 for(const r of retained){const p=parsed.get(r.library)?.elementsByType.Param?.[r.id];assert(p?.functionCall&&!p.scriptCode&&!p.expressionCode,'AUTHORED_EXTERNAL_KEY_REQUIRES_ACTUAL_LOADED_GUI_FUNCTION');}
 return {...result,keyRetentionProof:{kind:'AUTHORED_EXTERNAL_KEYS_PRESERVED_ACROSS_PARTIAL_LOCALES',sourceSha256:sha(source),beforeSha256:sha(triggerXml),afterSha256:sha(result.triggerXml),retained,localesModified:false,newNativeDefinitions:0,rawCodeRemainingForRetainedKeys:0}};
}
