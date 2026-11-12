import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/7fa3255fd104-immutable-galaxy-syntax.mjs';
import {logicalSourcePath,partitionDeclarationViews} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/source-ownership.mjs';
import {applyReversibleSourceEdits} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v394_linear_reversible_edits_2026-10-24/graph/751e226fe9a2-reversible-source-edits.mjs';
import {validateCompilationGlobalOwnership} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/cfbe5c9febe7-compilation-global-ownership.mjs';
import {triggerHandleName} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {withImplicitLibrary} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
const declarations=text=>{const ast=parse(text,'storage-owner');assert.equal(ast.parseDiagnostics.length,0);return ast.statements.filter(n=>n.kind===K.VariableDeclaration);};
const passiveTrigger=node=>node.type.kind===K.TriggerKeyword&&!node.initializer&&!node.modifiers?.length;

// Native generation declares a GUI Trigger's handle in the root. An included
// source declaration must then transfer ownership, not declare it a second time.
export function transferOwnedTriggerStorage({root,generatedRoot,guiLibraries,implicitLibraryId,...context}) {
  const original=validateCompilationGlobalOwnership(root,context);
  assert(original.passed,'SOURCE_COMPILATION_STORAGE_NOT_UNIQUE:'+original.reason);
  const owned=context.ownedSources??[],reached=new Set(original.files.map(f=>f.fileName));
  const rootDeclarations=new Map(),guiOwners=new Map(),providers=new Map();
  for(const node of declarations(generatedRoot)){
    const rows=rootDeclarations.get(node.name.name)??[];rows.push(node);rootDeclarations.set(node.name.name,rows);
  }
  for(const [library,document]of guiLibraries)for(const element of Object.values(document.elements)){
    if(element.type!=='Trigger')continue;
    assert(element.identifier!==undefined||element.name!==undefined,'GUI_TRIGGER_SCRIPT_NAME_REQUIRES_LOCALIZATION');
    const owner={library:element.library??library,type:'Trigger',id:element.id};
    assert(owner.id,'GUI_TRIGGER_STORAGE_OWNER_ID_REQUIRED');
    const name=withImplicitLibrary(implicitLibraryId,()=>triggerHandleName(owner.library,element)),rows=guiOwners.get(name)??[];rows.push(owner);guiOwners.set(name,rows);
  }
  for(const file of owned){
    const fileName=logicalSourcePath(file.originalPath??file.fileName);if(!reached.has(fileName))continue;
    for(const node of declarations(file.text)){
      const rows=providers.get(node.name.name)??[];rows.push({file,fileName,node});providers.set(node.name.name,rows);
    }
  }
  const byFile=new Map(),records=[];
  for(const [name,owners]of guiOwners){
    const emitted=rootDeclarations.get(name),source=providers.get(name);if(!emitted||!source)continue;
    assert.equal(owners.length,1,'AMBIGUOUS_GUI_TRIGGER_STORAGE_OWNER:'+name);
    assert.equal(source.length,1,'AMBIGUOUS_OWNED_TRIGGER_STORAGE_OWNER:'+name);
    assert.equal(emitted.length,1,'DUPLICATE_GENERATED_TRIGGER_STORAGE:'+name);
    const {file,fileName,node}=source[0];
    assert(passiveTrigger(node)&&passiveTrigger(emitted[0]),'TRIGGER_STORAGE_TYPE_OR_INITIALIZER_MUST_NOT_BE_DROPPED:'+name);
    const edit={start:node.pos,end:node.end,before:file.text.slice(node.pos,node.end),replacement:'',role:'transfer-passive-trigger-storage-to-gui'};
    const edits=byFile.get(fileName)??[];edits.push(edit);byFile.set(fileName,edits);
    records.push({name,guiOwner:owners[0],sourceFile:fileName,sourceRange:[node.pos,node.end],generatedRange:[emitted[0].pos,emitted[0].end],
      sourceAndTargetType:'trigger',sourceInitializerAbsent:true,targetInitializerAbsent:true,initializationEffectsRemoved:false});
  }
  const files=owned.map(file=>{
    const name=logicalSourcePath(file.originalPath??file.fileName),edits=byFile.get(name);if(!edits)return file;
    const result=applyReversibleSourceEdits(file.text,edits);assert.equal(parse(result.text,name).parseDiagnostics.length,0);
    return {...file,text:result.text,sha256:sha(result.text),storageTransfer:result.proof};
  });
  // A declaration input may be an extra view of an owned file. It must not
  // reintroduce that file's old contents after ownership has transferred.
  const externalSources=partitionDeclarationViews(owned,context.externalSources??[]).external;
  const moved=files.flatMap(file=>byFile.has(logicalSourcePath(file.originalPath??file.fileName))?file.storageTransfer.edits.map(edit=>edit.before):[]);
  const at=root.text.startsWith('\uFEFF')?1:0;
  const rootTransfer=applyReversibleSourceEdits(root.text,moved.length?[{start:at,end:at,before:'',replacement:moved.join('\n')+'\n',role:'hoist-passive-trigger-storage'}]:[]);
  const candidateRoot={...root,text:rootTransfer.text,sha256:sha(rootTransfer.text)};
  assert.equal(parse(candidateRoot.text,root.fileName).parseDiagnostics.length,0);
  return {files,externalSources,root:candidateRoot,proof:{kind:'OWNED_PASSIVE_TRIGGER_STORAGE_TRANSFER',rootSha256:sha(root.text),rootTransfer:rootTransfer.proof,storedRootSha256:sha(candidateRoot.text),generatedRootSha256:sha(generatedRoot),records,
    files:files.filter(file=>byFile.has(logicalSourcePath(file.originalPath??file.fileName))).map(file=>({fileName:logicalSourcePath(file.originalPath??file.fileName),...file.storageTransfer})),
    movedDeclarations:records.length,changedFiles:byFile.size,sourceArchiveChanged:false,nonDeclarationBytesPreserved:true,
    runtimeCallsAdded:0,newNative:0,newCustomScript:0,wholeMapAccepted:false}};
}
