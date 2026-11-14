/** Keep XML-illegal ASCII bytes as a typed literal ScriptCode parameter.
 * Prefer the exact original source token when it is XML-safe; never delete
 * bytes or replace them with printable characters. No function/flow rewrite.
 */
const invalid=/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u;
export function quoteGalaxyAsciiLiteral(value){
 let out='"';
 for(const c of value){
  const code=c.charCodeAt(0);
  if(c==='"'||c==='\\')out+='\\'+c;
  else if(c==='\n')out+='\\n';
  else if(c==='\r')out+='\\r';
  else if(c==='\t')out+='\\t';
  else if(code<32)out+='\\x'+code.toString(16).padStart(2,'0');
  else out+=c;
 }
 return out+'"';
}
export function xmlControlLiteralParam(value,sourceToken){
 if(!invalid.test(value))return undefined;
 const scriptCode=typeof sourceToken==='string'&&!invalid.test(sourceToken)
  ? sourceToken : quoteGalaxyAsciiLiteral(value);
 return {scriptCode,valueType:{type:'string'}};
}
