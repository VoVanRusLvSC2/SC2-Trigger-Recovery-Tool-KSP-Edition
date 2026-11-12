import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/7fa3255fd104-immutable-galaxy-syntax.mjs';
import {logicalSourcePath,partitionDeclarationViews} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/source-ownership.mjs';
import {applyReversibleSourceEdits} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v394_linear_reversible_edits_2026-10-24/graph/751e226fe9a2-reversible-source-edits.mjs';
import {validateCompilationGlobalOwnership} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/cfbe5c9febe7-compilation-global-ownership.mjs';
import {triggerHandleName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/a8e17466d0b6-cc6e32b546f5-ttg-core.js';
import {withImplicitLibrary} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
const syntax=text=>{const ast=parse(text,'verify-storage');assert.equal(ast.parseDiagnostics.length,0);return ast.statements;};
const scalar=node=>node.kind===K.VariableDeclaration&&node.type.kind===K.TriggerKeyword&&!node.initializer&&!node.modifiers?.length;

// Verify actual before/after files, never a converter's proposed edit receipt.
// The candidate statement sequence must be the original sequence with only
// qualified passive Trigger declarations omitted; replay checks every other byte.
export function verifyOwnedTriggerStorageTransfer({root,generatedRoot,beforeFiles,afterFiles,candidateRoot,guiLibraries,implicitLibraryId,...context}) {
  const original=validateCompilationGlobalOwnership(root,{...context,ownedSources:beforeFiles});
  assert(original.passed,'ORIGINAL_STORAGE_OWNERSHIP_NOT_PROVED');
  const reached=new Set(original.files.map(f=>f.fileName)),after=new Map();
  for(const file of afterFiles){const name=logicalSourcePath(file.originalPath??file.fileName);assert(!after.has(name),'DUPLICATE_CANDIDATE_OWNED_FILE');after.set(name,file);}
  assert.equal(after.size,beforeFiles.length,'OWNED_FILE_SET_CHANGED');
  const emitted=new Map(),owners=new Map(),changes=[];
  for(const node of syntax(generatedRoot))if(node.kind===K.VariableDeclaration){const list=emitted.get(node.name.name)??[];list.push(node);emitted.set(node.name.name,list);}
  for(const [library,document]of guiLibraries)for(const element of Object.values(document.elements))if(element.type==='Trigger'){
    assert(element.identifier!==undefined||element.name!==undefined,'GUI_TRIGGER_SCRIPT_NAME_REQUIRES_LOCALIZATION');
    const owner={library:element.library??library,type:'Trigger',id:element.id};assert(owner.id);
    const name=withImplicitLibrary(implicitLibraryId,()=>triggerHandleName(owner.library,element)),list=owners.get(name)??[];list.push(owner);owners.set(name,list);
  }
  for(const before of beforeFiles){
    const fileName=logicalSourcePath(before.originalPath??before.fileName),candidate=after.get(fileName);assert(candidate,'OWNED_FILE_REMOVED');
    if(before.text===candidate.text)continue;
    assert(reached.has(fileName),'UNREACHABLE_OWNED_FILE_CHANGED');
    const old=syntax(before.text),next=syntax(candidate.text),removed=[];let cursor=0;
    for(const node of old){
      const match=next[cursor];
      if(match&&before.text.slice(node.pos,node.end)===candidate.text.slice(match.pos,match.end)){cursor++;continue;}
      const name=node.name?.name;
      assert(scalar(node),'NON_PASSIVE_TRIGGER_STATEMENT_CHANGED');
      assert.equal(owners.get(name)?.length,1,'GUI_STORAGE_OWNER_NOT_UNIQUE');
      assert.equal(emitted.get(name)?.length,1,'GENERATED_STORAGE_OWNER_NOT_UNIQUE');assert(scalar(emitted.get(name)[0]),'GENERATED_STORAGE_TYPE_OR_INITIALIZER_CHANGED');
      removed.push({start:node.pos,end:node.end,before:before.text.slice(node.pos,node.end),replacement:'',name,guiOwner:owners.get(name)[0]});
    }
    assert.equal(cursor,next.length,'CANDIDATE_OWNED_STATEMENT_ADDED');
    const replay=applyReversibleSourceEdits(before.text,removed);assert.equal(replay.text,candidate.text,'OTHER_OWNED_BYTES_CHANGED');
    changes.push({fileName,beforeSha256:sha(before.text),afterSha256:sha(candidate.text),removed,byteInverseVerified:replay.proof.byteInverseVerified});
  }
  assert(candidateRoot&&logicalSourcePath(candidateRoot.fileName)===logicalSourcePath(root.fileName),'STORED_CANDIDATE_ROOT_REQUIRED');
  const declarations=changes.flatMap(file=>file.removed.map(row=>row.before)),at=root.text.startsWith('\uFEFF')?1:0;
  const rootReplay=applyReversibleSourceEdits(root.text,declarations.length?[{start:at,end:at,before:'',replacement:declarations.join('\n')+'\n'}]:[]);
  assert.equal(candidateRoot.text,rootReplay.text,'STORED_ROOT_NOT_ATOMIC_WITH_STORAGE_TRANSFER');
  const externalSources=partitionDeclarationViews(beforeFiles,context.externalSources??[]).external;
  const storage=validateCompilationGlobalOwnership({fileName:root.fileName,text:generatedRoot},{...context,ownedSources:afterFiles,externalSources});
  assert(storage.passed,'CANDIDATE_GLOBAL_STORAGE_CONFLICT:'+storage.reason);
  const storedRootStorage=validateCompilationGlobalOwnership(candidateRoot,{...context,ownedSources:afterFiles,externalSources});assert(storedRootStorage.passed,'STORED_ROOT_STORAGE_CONFLICT');
  return {kind:'INDEPENDENT_OWNED_TRIGGER_STORAGE_TRANSFER',passed:true,changes,rootTransfer:rootReplay.proof,storedRootStorage,
    movedDeclarations:changes.reduce((sum,file)=>sum+file.removed.length,0),originalStorage:original,storage,
    converterReceiptUsedAsAuthority:false,nonDeclarationBytesPreserved:true,sourceArchiveChanged:false,wholeMapAccepted:false};
}
