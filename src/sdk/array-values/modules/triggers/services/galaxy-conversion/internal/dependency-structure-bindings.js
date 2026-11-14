/** Bind existing library Structure IDs only after exact header ABI validation.
 * No case-insensitive lookup, generated IDs, library edits or persistent cache.
 */
// @ts-nocheck
import {SyntaxKind,Printer} from '@modkit/blizzard-starcraft2/galaxy/language-core';
import {lookupElementIn,libraryPrefix,refKey,sanitizeIdentifier,lowerInitial} from './conversion-model.js';
const printer=new Printer();
const key=(ref,owner)=>refKey(ref,owner);
const fieldName=v=>{
 const stem=sanitizeIdentifier(v.identifier??v.name??v.id);
 return stem.startsWith('lv_')?stem:'lv_'+(v.identifier!==undefined?stem:lowerInitial(stem));
};
function fieldShape(node){
 const sizes=[];let type=node.type;
 while(type?.kind===SyntaxKind.ArrayType){
  const n=type.size?.kind===SyntaxKind.NumericLiteral?Number(type.size.value):NaN;
  if(!Number.isSafeInteger(n)||n<1)return;
  sizes.push(n);type=type.elementType;
 }
 return {name:node.name?.name,type:printer.printNode(type).trim(),sizes};
}
function metadataSizes(v){
 const dims=[...(v.arraySizes??[])].sort((a,b)=>a.dim-b.dim);
 if(v.isArray&&!dims.length||dims.some((d,i)=>!Number.isSafeInteger(d.dim)||i&&d.dim===dims[i-1].dim||d.variable||!/^\d+$/u.test(d.value??'')))return;
 const sizes=dims.map(d=>Number(d.value)+1);
 return sizes.every(n=>Number.isSafeInteger(n)&&n>0)?sizes:undefined;
}
export function buildDependencyStructureBindings(sources,libraries,typeName){
 const refsByName=new Map(),namesByRef=new Map(),membersByRef=new Map(),proof=[];
 if(sources.some(s=>s.parseDiagnostics?.length))return {refsByName,namesByRef,membersByRef,proof};
 const declared=new Map(),ambiguous=new Set();
 for(const source of sources)for(const n of source.statements??[]){
  if(n.kind!==SyntaxKind.StructDeclaration)continue;
  const name=n.name?.name,fields=(n.members??[]).map(fieldShape);
  if(!name||fields.some(f=>!f)||new Set(fields.map(f=>f.name)).size!==fields.length){ambiguous.add(name);continue;}
  const signature=JSON.stringify(fields),prior=declared.get(name);
  if(prior&&prior.signature!==signature){ambiguous.add(name);continue;}
  declared.set(name,{fields,signature,source:source.fileName});
 }
 const byRef=new Map(),byName=new Map();
 for(const library of libraries.values())for(const s of Object.values(library.elementsByType?.Structure??{})){
  if(s.disabled)continue;
  const stem=sanitizeIdentifier(s.identifier??s.name??s.id),prefix=libraryPrefix(library.id)+'gs_';
  const names=[...new Set([prefix+stem,...(s.identifier===undefined?[prefix+stem.charAt(0).toUpperCase()+stem.slice(1)]:[])])]
   .filter(n=>declared.has(n)&&!ambiguous.has(n));
  if(names.length!==1)continue;
  const ref={type:'Structure',library:library.id,id:s.id},k=key(ref,library.id);
  const candidate={ref,key:k,name:names[0],library,structure:s,declared:declared.get(names[0]),dependencies:new Set(),members:[]};
  byRef.set(k,candidate);const owners=byName.get(candidate.name)??[];owners.push(candidate);byName.set(candidate.name,owners);
 }
 const candidates=[...byRef.values()].filter(c=>byName.get(c.name).length===1),valid=new Map();
 for(const c of candidates){
  const refs=c.structure.variables??[],fields=c.declared.fields;
  if(refs.length!==fields.length)continue;
  let matches=true;
  for(let i=0;i<refs.length;i++){
   const r=refs[i],owner=r.library??c.library.id,lib=libraries.get(owner),v=lib&&lookupElementIn(lib,r),f=fields[i];
   if(!v||v.type!=='Variable'||v.disabled){matches=false;break;}
   const sizes=metadataSizes(v);let type;
   if(v.variableType?.typeElement?.type==='Structure'){
    const target=byRef.get(key(v.variableType.typeElement,owner));
    if(!target||byName.get(target.name).length!==1){matches=false;break;}
    type=target.name;c.dependencies.add(target.key);
   }else type=typeName(v.variableType,lib,libraries);
   if(!sizes||f.name!==fieldName(v)||f.type!==type||JSON.stringify(f.sizes)!==JSON.stringify(sizes)){matches=false;break;}
   c.members.push({name:f.name,ref:{type:'Variable',library:owner,id:v.id}});
  }
  if(matches)valid.set(c.key,c);
 }
 // A nested record is usable only when its complete layout also matched.
 let changed=true;
 while(changed){changed=false;for(const[k,c]of valid)if([...c.dependencies].some(d=>!valid.has(d))){valid.delete(k);changed=true;}}
 for(const c of valid.values()){
  refsByName.set(c.name,c.ref);namesByRef.set(c.key,c.name);membersByRef.set(c.key,c.members);
  proof.push({name:c.name,ref:c.ref,fields:c.declared.fields,source:c.declared.source,completeLayoutMatched:true});
 }
 return {refsByName,namesByRef,membersByRef,proof};
}
