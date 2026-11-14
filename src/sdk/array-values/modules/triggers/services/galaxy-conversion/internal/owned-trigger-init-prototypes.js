/** Declare only existing own void()/Trigger Init functions called by templates.
 * These declarations register nothing and execute no actions.
 */
// @ts-nocheck
function codeTokens(text){
 let out='',state='code';
 for(let i=0;i<text.length;i++){
  const c=text[i],next=text[i+1];
  if(state==='line'){if(c==='\n'){state='code';out+='\n';}else out+=' ';continue;}
  if(state==='block'){if(c==='*'&&next==='/'){out+='  ';i++;state='code';}else out+=' ';continue;}
  if(state==='string'){if(c==='\\'){out+='  ';i++;}else {out+=' ';if(c==='"')state='code';}continue;}
  if(c==='"'){state='string';out+=' ';continue;}
  if(c==='/'&&next==='/'){state='line';out+='  ';i++;continue;}
  if(c==='/'&&next==='*'){state='block';out+='  ';i++;continue;}
  out+=c;
 }
 return out;
}
export function ownedTriggerInitPrototypes(elements,libId,nameOf){
 const own=new Set(Object.values(elements).filter(e=>e.type==='Trigger'&&(e.library??libId)===libId).map(e=>nameOf(libId,e)));
 const calls=new Set(),declared=new Set();
 for(const e of Object.values(elements)){
  if(e.disabled||!e.scriptCode)continue;
  const code=codeTokens(e.scriptCode);
  for(const m of code.matchAll(/\bvoid\s+([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)\s*;/gu))declared.add(m[1]);
  if(e.type!=='FunctionDef'&&e.type!=='FunctionCall')continue;
  for(const m of code.matchAll(/\b([A-Za-z_][A-Za-z0-9_]*)\s*\(\s*\)\s*;/gu))if(own.has(m[1]))calls.add(m[1]);
 }
 const names=[...calls].filter(n=>!declared.has(n)).sort();
 return {names,scriptCode:names.map(n=>'void '+n+' ();').join('\n')};
}
