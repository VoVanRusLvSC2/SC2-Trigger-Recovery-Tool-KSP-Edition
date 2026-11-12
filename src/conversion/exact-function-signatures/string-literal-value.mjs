// A primitive Galaxy string literal, never an expression/program. Keep byte
// escapes distinct from UTF-8 source characters; XML must not transcode them.
import {Parser,SyntaxKind as K} from "./index-alternate-3.js";
export function readStringLiteralValue(code){
 if(typeof code!=='string'||code.length>1024*1024)return;
 const token=code.trim();
 if(token[0]!=='"'||token.at(-1)!=='"')return;
 const ast=new Parser().parseFile('literal-value','string F(){return '+token+';}');
 const statements=ast.statements[0]?.body?.statements;
 if(ast.parseDiagnostics.length||statements?.length!==1||statements[0].kind!==K.ReturnStatement||statements[0].expression?.kind!==K.StringLiteral||statements[0].expression.text!==token)return;
 const bytes=[];let opaque=false;
 const appendByte=value=>{bytes.push(value);if(value<32||value>=127)opaque=true;};
 for(let i=1;i<token.length-1;i++){
  const c=token[i];
  if(c!=='\\'){
   if(c==='"')return;
   const cp=token.codePointAt(i);
   if(cp>=0xd800&&cp<=0xdfff)return;
   const ch=String.fromCodePoint(cp);if(ch.length===2)i++;
   bytes.push(...Buffer.from(ch,'utf8'));if(cp<32||cp===127)opaque=true;
   continue;
  }
  const next=token[++i];if(next===undefined||i>=token.length-1)return;
  if(/[0-7]/u.test(next)){
   let digits=next;while(digits.length<3&&/[0-7]/u.test(token[i+1]??'')&&i+1<token.length-1)digits+=token[++i];
   const value=parseInt(digits,8);if(value>255)return;appendByte(value);continue;
  }
  if(next==='x'){
   let digits='';while(i+1<token.length-1&&/[0-9a-fA-F]/u.test(token[i+1]))digits+=token[++i];
   if(!digits||digits.length>8)return;
   const value=parseInt(digits,16);if(value>255)return;appendByte(value);continue;
  }
  const escaped={'\\':92,'"':34,"'":39,a:7,b:8,f:12,n:10,r:13,t:9,v:11};
  if(!(next in escaped))return;appendByte(escaped[next]);
 }
 // A literal physical control character cannot be stored in XML. Three octal
 // digits terminate unambiguously even if the following character is a digit.
 const xmlToken=token.replace(/[\u0000-\u001f\u007f]/gu,c=>'\\'+c.charCodeAt(0).toString(8).padStart(3,'0'));
 const buffer=Buffer.from(bytes),value=buffer.toString('utf8');
 return{token,xmlToken,bytes:buffer,needsPreset:opaque||!Buffer.from(value,'utf8').equals(buffer),value};
}
