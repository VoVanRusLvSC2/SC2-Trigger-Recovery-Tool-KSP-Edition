import {createHash} from 'node:crypto';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';

const sha=text=>createHash('sha256').update(text).digest('hex');
const prefix='          '; // The stock scriptCodeTag transport prefix, not source indentation.

/** A conservative transport gate, not a Galaxy compiler or a content rewrite.
 * The tolerant SDK reader accepts shapes which the actual Editor truncates or
 * omits. Qualify the stock multiline text envelope and retain every issue.
 * Other envelopes require their own Native qualification; they are not silently
 * reinterpreted as empty code or accepted because the SDK parses them.
 */
export function inspectNativeScriptCodeFraming(xml,{implicitLibrary='Map'}={}){
 const root=xmlTree(xml),frames=[],issues=[];
 function visit(node,library,element,disabled){
  if(node.tag==='Library')library=node.attributes.Id;
  if(node.tag==='Element'){
   element={library,type:node.attributes.Type,id:node.attributes.Id};
   disabled=disabled||node.children.some(n=>n.tag==='Disabled');
  }
  if(node.tag==='ScriptCode'&&!disabled){
   const raw=node.selfClosing?'':xml.slice(node.openEnd,node.closeStart),text=raw.replace(/\r\n?/gu,'\n');
   const record={element,start:node.start,end:node.end,rawSha256:sha(raw),empty:!text.trim(),qualified:false};
   if(record.empty)record.qualified=true;
   else if(text.includes('<![CDATA['))record.reason='NON_STOCK_CODE_TEXT_ENVELOPE';
   else if(!text.startsWith('\n')||!(/\n[ \t]*$/u.test(text)))record.reason='SCRIPT_CODE_LINE_BOUNDARIES_UNQUALIFIED';
   else{
    const lines=text.split('\n').slice(1,-1),bad=lines.flatMap((line,index)=>line.trim()&&!line.startsWith(prefix)?[index+1]:[]);
    if(bad.length){record.reason='SCRIPT_CODE_PREFIX_CAN_TRUNCATE_TOKENS';record.lines=bad;}
    else record.qualified=true;
   }
   frames.push(record);if(!record.qualified)issues.push(record);
  }
  for(const child of node.children)visit(child,library,element,disabled);
 }
 visit(root,implicitLibrary,undefined,false);
 return {kind:'STOCK_NATIVE_SCRIPT_CODE_TRANSPORT_PREFLIGHT',passed:issues.length===0,sourceXmlSha256:sha(xml),
  frames,issues,activeCodeFields:frames.length,knownStockPrefixSpaces:prefix.length,
  arbitraryEnvelopeAcceptance:false,sourceOrGuiChanged:false,nativeCompilationProved:false,
  businessEquivalenceProved:false,wholeMapAccepted:false};
}
