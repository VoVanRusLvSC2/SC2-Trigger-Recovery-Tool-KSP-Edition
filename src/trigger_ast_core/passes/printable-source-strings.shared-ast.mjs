/** Normalize only source-owned, decoded printable ASCII literals before G2T.
 * Keep controls/non-ASCII/unsupported escapes verbatim for separate transport.
 * No calls, identifiers, operators, comments or statement order are edited.
 */
import {decodeBoundAsciiString} from '../../galaxy_ascii_string_v1246.mjs';
const ignored=new Set(['parent','symbol','locals','flowNode','syntaxTokens']);
export function normalizePrintableSourceStrings(text,parse,document) {
 const ast=document?document.input(text):parse(text);if(ast.parseDiagnostics?.length)throw Error('String normalization source syntax errors: '+JSON.stringify(ast.parseDiagnostics.map(d=>({start:d.start,length:d.length,message:d.messageText??d.message}))));
 const edits=[],pending=[ast];
 while(pending.length){
  const n=pending.pop();if(!n||typeof n!=='object')continue;
  if(n.kind===3){
   const raw=text.slice(n.pos,n.end).trim();
   if(raw!==n.text)throw Error('String token source ownership differs');
   const value=decodeBoundAsciiString(n,text);
   if(value!==undefined&&!/[\x00-\x1f\x7f]/u.test(value)&&raw.includes('\\')){
    const quoted=JSON.stringify(value);
    if(raw!==quoted){const start=n.pos+text.slice(n.pos,n.end).indexOf(raw);edits.push({start,end:start+raw.length,raw,quoted,value});}
   }
  }
  for(const[k,v]of Object.entries(n)){if(ignored.has(k))continue;if(Array.isArray(v))pending.push(...v);else if(v&&typeof v==='object')pending.push(v);}
 }
 edits.sort((a,b)=>b.start-a.start);let out=text,boundary=text.length;
 for(const e of edits){if(e.end>boundary)throw Error('String token edits overlap');out=out.slice(0,e.start)+e.quoted+out.slice(e.end);boundary=e.start;}
 const after=document?document.output(out):parse(out);if(after.parseDiagnostics?.length)throw Error('Normalized string source syntax errors');
 return {text:out,proof:{literalEdits:edits.length,examples:edits.slice(0,12).map(({raw,quoted,value})=>({raw,quoted,value})),
  controlAndNonAsciiLiteralsPreserved:true,sourceArchiveChanged:false,nativeAcceptance:false}};
}
