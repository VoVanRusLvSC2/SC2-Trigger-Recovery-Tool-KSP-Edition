/** Replace complete printer placeholders once, outside literals/comments.
 * Never substitute slot_1 inside slot_10 or inside an authored quoted value. */
export function replaceStructuredMarkers(code,replacements){
 let result='',cursor=0;
 for(let i=0;i<code.length;){
  if(code[i]==='"'||code[i]==="'"){
   const quote=code[i++];while(i<code.length){if(code[i++]==='\\'){i++;continue;}if(code[i-1]===quote)break;}continue;
  }
  if(code.startsWith('//',i)){const end=code.indexOf('\n',i+2);i=end<0?code.length:end+1;continue;}
  if(code.startsWith('/*',i)){const end=code.indexOf('*/',i+2);i=end<0?code.length:end+2;continue;}
  if(!/[A-Za-z_$]/.test(code[i])){i++;continue;}
  const start=i++;while(i<code.length&&/[A-Za-z0-9_$]/.test(code[i]))i++;
  const token=code.slice(start,i);let replacement=replacements.get(token);
  if(replacement===undefined&&code.slice(i,i+3)==='();'){replacement=replacements.get(token+'();');if(replacement!==undefined)i+=3;}
  if(replacement!==undefined){result+=code.slice(cursor,start)+replacement;cursor=i;}
 }
 return result+code.slice(cursor);
}
