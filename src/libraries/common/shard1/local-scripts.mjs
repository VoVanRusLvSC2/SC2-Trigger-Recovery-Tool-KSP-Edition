/** Inline only explicitly supplied ai<Id>.galaxy map payloads for comparison.
 * Include order and external libraries remain intact; never scan strings/comments.
 */
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
export function expandLocalAi(text,files,parseGalaxy){
 for(const f of files??[])assert(/^ai[0-9a-f]{8}\.galaxy$/iu.test(f.fileName));
 return expandLocalScripts(text,files,parseGalaxy);
}
export function expandLocalScripts(text,files,parseGalaxy){
 const byName=new Map();
 for(const file of files??[]){assert(typeof file.fileName==='string'&&/\.galaxy$/iu.test(file.fileName)&&!file.fileName.includes(':')&&!file.fileName.startsWith('/')&&!file.fileName.split(/[\\/]/u).some(x=>!x||x==='.'||x==='..'));const key=file.fileName.replaceAll('\\','/').toLowerCase();assert(!byName.has(key));byName.set(key,file);}
 const reached=new Set(),proof=[];
 const expand=source=>{
  const ast=parseGalaxy(source,'local-include.galaxy');assert.equal(ast.parseDiagnostics.length,0);
  let output='',cursor=0;
  for(const node of ast.statements){
   if(!node.path)continue;
   const value=node.path.value??node.path.text?.replace(/^"|"$/gu,'');
   if(typeof value!=='string')continue;
   const name=(value.replaceAll('\\','/').replace(/\.galaxy$/iu,'')+'.galaxy').toLowerCase(),file=byName.get(name);
   if(!file)continue;
   output+=source.slice(cursor,node.pos);
   if(!reached.has(name)){reached.add(name);proof.push({fileName:file.fileName,sha256:createHash('sha256').update(file.text).digest('hex')});output+='\n'+expand(file.text)+'\n';}
   cursor=node.end;
  }
  return output+source.slice(cursor);
 };
 return {text:expand(text),proof};
}
