import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const staticScope=(node,file)=>node.modifiers?.some(m=>m.kind===K.StaticKeyword)?file:null;
export function sourceFunctionAbi(node){
 assert.equal(node.kind,K.FunctionDeclaration);
 return {returnType:printer.printNode(node.type),parameters:node.parameters.map(p=>({type:printer.printNode(p.type),isReference:!!p.isReference})),native:!!node.modifiers?.some(m=>m.kind===K.NativeKeyword)};
}

// This index belongs to an already verified, closed source binding context.
// Static owners, exact source locations and ABI agreement define a family;
// a spelling match is only the candidate lookup, never emission permission.
export function indexSourceFunctionFamilies(program){
 const families=new Map(),declarations=new Map();
 for(const [file,doc]of program.documents){
  const identity=program.verifiedInputIdentity(file);assert.equal(identity?.contentSha256,sha(doc.text),'FUNCTION_FAMILY_SOURCE_IDENTITY');
  for(const node of doc.statements)if(node.kind===K.FunctionDeclaration){
   const owner=staticScope(node,file),key=JSON.stringify([owner,node.name.name]),family=families.get(key)??{key,name:node.name.name,staticOwner:owner,declarations:[]};
   const location=program.location(node);assert(location&&location.sourceFile===file&&location.contentSha256===identity.contentSha256,'FUNCTION_FAMILY_DECLARATION_LOCATION');
   const entry={node,location,abi:sourceFunctionAbi(node),declarationSha256:sha(doc.text.slice(node.pos,node.end))};
   family.declarations.push(entry);families.set(key,family);declarations.set(file+':'+node.pos+':'+node.end,{family,entry});
  }
 }
 const at=node=>{const where=program.location(node);return where&&declarations.get(where.sourceFile+':'+node.pos+':'+node.end);};
 return {families,at};
}

export function requireRetainedSourceFunctionFamily(family,ownedSources){
 assert(family&&!family.staticOwner,'SOURCE_PROTOTYPE_PUBLIC_FAMILY_REQUIRED');
 const rows=family.declarations,bodies=rows.filter(r=>r.node.body);assert.equal(bodies.length,1,'SOURCE_PROTOTYPE_UNIQUE_BODY_REQUIRED');
 assert(ownedSources.has(bodies[0].location.sourceFile),'SOURCE_PROTOTYPE_RETAINED_BODY_REQUIRED');
 const abi=JSON.stringify(rows[0].abi);assert(rows.every(r=>!r.abi.native&&JSON.stringify(r.abi)===abi),'SOURCE_PROTOTYPE_ABI_MISMATCH');
 assert(rows.every(r=>!r.node.modifiers?.length),'SOURCE_PROTOTYPE_UNSUPPORTED_MODIFIER');
 return {name:family.name,abi:rows[0].abi,body:{...bodies[0].location,declarationSha256:bodies[0].declarationSha256},
  declarations:rows.map(r=>({...r.location,declarationSha256:r.declarationSha256,hasBody:!!r.node.body}))};
}
