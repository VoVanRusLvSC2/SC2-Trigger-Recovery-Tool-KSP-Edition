// A foreign binary string need not be rewritten or understood as Unicode to
// establish that it cannot directly spell an ASCII callback identifier. Prove
// a deliberately stronger absence: the candidate is not even a subsequence
// of the literal's ASCII identifier characters. Keep high bytes opaque.
import {createHash} from 'node:crypto';
const sha=s=>createHash('sha256').update(s).digest('hex');
export function proveBoundedByteLiteralAliasAbsence(node,source,names){
 if(node?.kind!==3||!Number.isSafeInteger(node.pos)||!Number.isSafeInteger(node.end)||!Array.isArray(names)||names.some(n=>typeof n!=='string'||!/^[A-Za-z_][A-Za-z_0-9]*$/u.test(n)))return;
 const raw=source.slice(node.pos,node.end).trim();if(raw[0]!=='"'||raw.at(-1)!=='"'||raw.length>1024*1024)return;
 const bytes=[];
 for(let i=1;i<raw.length-1;i++){
  const c=raw[i];
  if(c!=='\\'){const value=c.charCodeAt(0);if(c==='"'||value>127||c==='\n'||c==='\r')return;bytes.push(value);continue;}
  const next=raw[++i];if(next===undefined)return;
  if(/[0-7]/u.test(next)){
   let digits=next;while(digits.length<3&&i+1<raw.length-1&&/[0-7]/u.test(raw[i+1]))digits+=raw[++i];
   const value=parseInt(digits,8);if(value>255)return;bytes.push(value);continue;
  }
  if(next==='x'){
   let digits='';while(i+1<raw.length-1&&/[A-Fa-f0-9]/u.test(raw[i+1]))digits+=raw[++i];
   if(!digits||digits.length>16)return;const value=BigInt('0x'+digits);if(value>255n)return;bytes.push(Number(value));continue;
  }
  const simple={'\\':92,'"':34,"'":39,n:10,r:13,t:9,b:8,f:12,v:11,a:7};
  if(!(next in simple))return;bytes.push(simple[next]);
 }
 // Confirm the literal facts against the parser already used for the source.
 // This is not an alternative escape interpretation or an encoding rewrite.
 const decoded=bytes.map(v=>String.fromCharCode(v)).join('');if(typeof node.value!=='string'||node.value!==decoded)return;
 const projection=bytes.filter(v=>v===95||v>=48&&v<=57||v>=65&&v<=90||v>=97&&v<=122).map(v=>String.fromCharCode(v)).join('');
 for(const name of names){let at=0;for(const c of projection){if(c===name[at])at++;if(at===name.length)return;}}
 return{kind:'FOREIGN_BOUNDED_BYTE_LITERAL_NO_ASCII_IDENTIFIER_SUBSEQUENCE',literalSha256:sha(raw),bytes:bytes.length,opaqueHighBytes:bytes.filter(v=>v>127).length,asciiIdentifierProjectionSha256:sha(projection),candidateCount:names.length,candidatesSha256:sha(JSON.stringify([...names].sort())),parserDecodedByteValuesVerified:true,nonAsciiRuntimeEncodingAsserted:false,foreignLiteralOrSourceChanged:false,dynamicStringProgramAnalysisComplete:false};
}
