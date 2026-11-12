import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer();

// A prototype is an ABI declaration, not a second runtime function. Retain the
// declarations themselves; choose a body only after checking the entire group.
export function indexSourceFunctionDeclarations(documents){
 const groups=new Map();
 for(const [fileName,ast] of documents)for(const node of ast.statements){
  if(!node.name?.name)continue;
  const rows=groups.get(node.name.name)??[];rows.push({fileName,node});groups.set(node.name.name,rows);
 }
 const result=new Map();
 for(const [name,rows] of groups){
  if(!rows.some(r=>r.node.kind===K.FunctionDeclaration))continue;
  const bodies=rows.filter(r=>r.node.kind===K.FunctionDeclaration&&r.node.body);
  const signatures=rows.map(({node})=>node.kind===K.FunctionDeclaration?JSON.stringify({
   result:printer.printNode(node.type),parameters:node.parameters.map(p=>({type:printer.printNode(p.type),reference:!!p.isReference})),
   modifiers:(node.modifiers??[]).map(m=>m.kind).sort((a,b)=>a-b)
  }):undefined);
  const compatible=signatures.every(s=>s!==undefined&&s===signatures[0]);
  const restricted=rows.some(r=>r.node.modifiers?.some(m=>[K.StaticKeyword,K.NativeKeyword].includes(m.kind)));
  result.set(name,Object.freeze({name,status:!compatible?'ABI_CONFLICT':restricted?'RESTRICTED_LINKAGE':bodies.length!==1?'BODY_NOT_UNIQUE':'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES',
   declarations:Object.freeze(rows.map(Object.freeze)),...(compatible&&!restricted&&bodies.length===1?{body:bodies[0]}:{})}));
 }
 return result;
}

export function canonicalSourceFunctionDeclaration(index,node){
 if(node?.kind!==K.FunctionDeclaration||node.parent?.kind!==K.SourceFile)return node;
 const group=index.get(node.name.name);
 return group?.status==='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'?group.body.node:node;
}

// Public interfaces expose the single original body. Compatible prototypes in
// that same source unit remain in the exact source replay and add no interface.
export function publicAuthoredFunctionBodies(unit){
 const names=new Set(unit.publicCalls.map(c=>c.name));
 return unit.declarations.filter(d=>d.kind===K.FunctionDeclaration&&d.hasBody&&names.has(d.name));
}
