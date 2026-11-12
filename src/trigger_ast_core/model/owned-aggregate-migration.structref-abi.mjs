import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {logicalSourcePath} from './source-ownership.mjs';

const sha=text=>createHash('sha256').update(text).digest('hex');
const path=value=>logicalSourcePath(value).replace(/\.galaxy$/u,'');
const source=node=>{while(node?.parent)node=node.parent;return node;};
const walk=(node,visit,parent)=>{visit(node,parent);forEachChild(node,child=>walk(child,visit,node));};

/** An ownership transaction, not a GUI/equivalence certificate. Move complete
 * owned include units connected to an aggregate used by the GUI document.
 * Scalar-only and unrelated source libraries retain their original bytes.
 * The caller supplies the existing verified binder, never a name-only linker. */
export function planOwnedAggregateMigration({program,primaryFiles,ownedFiles,existingTriggerData=''}) {
  assert(typeof program?.verifiedInputIdentity==='function','VERIFIED_AGGREGATE_PROGRAM_REQUIRED');
  const originals=new Map(),aliases=new Map(),documents=new Map(),edges=new Map(),seeds=new Set();
  const resolve=name=>aliases.get(path(name));
  for(const file of [...primaryFiles,...ownedFiles]) {
    assert.equal(typeof file.text,'string','AGGREGATE_SOURCE_TEXT');
    assert.equal(file.sha256,sha(file.text),'AGGREGATE_SOURCE_SHA');
    const key=path(file.fileName);assert(!originals.has(key),'AMBIGUOUS_AGGREGATE_SOURCE');
    originals.set(key,file);edges.set(key,new Set());
    for(const alias of [file.fileName,file.originalPath].filter(Boolean)) {
      const name=path(alias);assert(!aliases.has(name)||aliases.get(name)===key,'AMBIGUOUS_AGGREGATE_ALIAS');aliases.set(name,key);
    }
    const ast=program.documents.get(file.fileName),input=program.verifiedInputIdentity(file.fileName);
    assert(ast&&input?.owned===true&&input.contentSha256===file.sha256,'AGGREGATE_INPUT_NOT_VERIFIED');
    assert(!ast.parseDiagnostics?.length,'AGGREGATE_SOURCE_SYNTAX');program.attachOriginal(ast);documents.set(key,ast);
  }
  const primary=new Set(primaryFiles.map(f=>path(f.fileName))),owned=new Set(ownedFiles.map(f=>path(f.fileName)));
  const includes=new Map(),bindings=[];
  for(const [key,ast]of documents) {
    const direct=[];includes.set(key,direct);
    for(const node of ast.statements)if(node.kind===K.IncludeStatement) {
      const target=resolve(node.path.value);if(target){direct.push({node,target});edges.get(key).add(target);}
    }
    walk(ast,(node,parent)=>{
      if(node.kind!==K.Identifier&&node.kind!==K.PropertyAccessExpression)return;
      const declaration=program.declarationAt(node),file=source(declaration)?.fileName;
      const target=file&&resolve(file);if(!target||target===key)return;
      const binding=program.getBinding(node);assert.equal(binding.status,'BOUND','AGGREGATE_REFERENCE_NOT_BOUND');
      edges.get(key).add(target);
      // The existing source contracts already own ordinary scalar/aggregate
      // field uses. Trigger migration only for a direct structref call ABI,
      // whose source-only interface cannot represent an ordinary GUI formal.
      // A type mention alone must not absorb unrelated authored AI libraries.
      const aggregate=declaration.kind===K.FunctionDeclaration&&
        declaration.parameters.some(p=>p.type?.kind===K.MappedType&&p.type.returnType?.kind===K.StructrefKeyword&&p.type.typeArguments?.length===1);
      if(primary.has(key)&&owned.has(target)&&aggregate&&parent?.kind===K.CallExpression&&parent.expression===node&&parent.arguments.length===declaration.parameters.length) {
        seeds.add(target);bindings.push({from:program.location(node),declaration:program.location(declaration),symbolId:binding.symbolId});
      }
    });
  }
  const selected=new Set(seeds);
  // File-granular atomicity: no retained file may keep declarations or includes
  // that depend on a removed unit. Do not traverse through the GUI root, which
  // would incorrectly absorb every scalar library the map happens to call.
  let changed=true;
  while(changed){changed=false;for(const [from,targets]of edges)for(const to of targets) {
    if(!owned.has(from)||!owned.has(to))continue;
    if(selected.has(from)!==selected.has(to)){selected.add(from);selected.add(to);changed=true;}
  }}
  const proof={kind:'CLOSED_STRUCTREF_ABI_OWNERSHIP_MIGRATION',seedPolicy:'DIRECT_OWNED_STRUCTREF_CALL_ABI',status:selected.size?'PLANNED':'NOT_NEEDED',
    aggregateUses:bindings,selected:[...selected].map(k=>({fileName:originals.get(k).fileName,sha256:originals.get(k).sha256})),
    retained:ownedFiles.filter(f=>!selected.has(path(f.fileName))).map(f=>({fileName:f.fileName,sha256:f.sha256})),
    newNative:0,newCustomScript:0,newRuntimeFunctions:0,sourceChanged:false,guiGraphVerified:false,wholeProgramEquivalent:false};
  if(selected.size&&existingTriggerData.trim())return {proof:{...proof,status:'REFUSED',reason:'EXISTING_GUI_REQUIRES_DECLARATION_PATCH_TRANSACTION'},inputChanged:false};
  if(!selected.size)return {proof,inputChanged:false};
  const emitted=new Set(),slices=[];
  const expand=key=>{
    const file=originals.get(key),edits=[];
    for(const {node,target}of includes.get(key))if(selected.has(target)) {
      assert(!emitted.has(target),'AGGREGATE_REPEATED_OR_CYCLIC_INCLUDE');emitted.add(target);
      const end=node.path.pos+node.path.text.length;
      assert.equal(file.text.slice(node.path.pos,end),node.path.text,'AGGREGATE_INCLUDE_TOKEN_RANGE');
      const text=expand(target);edits.push({start:node.pos,end,text:'\n'+text+'\n'});
      slices.push({from:file.fileName,start:node.pos,end,insertedFile:originals.get(target).fileName,insertedSha256:sha(text)});
    }
    let output=file.text;for(const edit of edits.reverse())output=output.slice(0,edit.start)+edit.text+output.slice(edit.end);
    return output;
  };
  const projected=primaryFiles.map(f=>({...f,text:expand(path(f.fileName))}));
  assert.equal(emitted.size,selected.size,'AGGREGATE_COMPONENT_NOT_REACHABLE_AT_ORIGINAL_INCLUDE_POINT');
  for(const name of selected)for(const next of edges.get(name))assert(!owned.has(next)||selected.has(next),'AGGREGATE_OUTGOING_OWNER_ESCAPE');
  return {proof:{...proof,includeEdits:slices,allSelectedEmittedOnce:true,originalIncludeOrderPreserved:true},inputChanged:true,
    primaryFiles:projected,ownedFiles:ownedFiles.filter(f=>!selected.has(path(f.fileName))),
    selectedFiles:ownedFiles.filter(f=>selected.has(path(f.fileName)))};
}
