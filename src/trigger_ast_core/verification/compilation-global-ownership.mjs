import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {logicalSourcePath,partitionDeclarationViews} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');

// One compilation unit includes its preserved Galaxy files. GUI reference
// validity alone cannot detect declarations emitted again in the root script.
export function validateCompilationGlobalOwnership(root,context={}) {
  const owned=context.ownedSources??[],partition=partitionDeclarationViews(owned,context.externalSources??[]);
  const base={kind:'COMPILATION_GLOBAL_STORAGE_OWNERSHIP',sourceOrExportChanged:false,wholeMapAccepted:false};
  if(partition.conflicts.length)return {...base,passed:false,reason:'CONFLICTING_INCLUDE_INPUTS',conflicts:partition.conflicts};
  const closure=removeAlreadyLoadedOwnedIncludes({root,ownedSources:owned,externalSources:partition.external,
    includeEvidence:context.includeEvidence??[],includeRoot:false}).proof;
  if(!closure.completeReachableClosure)return {...base,passed:false,reason:'INCOMPLETE_INCLUDE_CLOSURE',closure};
  const reached=new Map(closure.resolvedFiles.map(file=>[logicalSourcePath(file.path),file.sha256]));
  const seen=new Set(),owners=new Map(),files=[];
  for(const file of [root,...owned,...partition.external]){
    const name=logicalSourcePath(file.originalPath??file.fileName);
    if(!reached.has(name)||seen.has(name))continue;
    const digest=sha(file.text);
    assert.equal(digest,reached.get(name),'COMPILATION_INPUT_HASH_MISMATCH');seen.add(name);
    const ast=parse(file.text,name);assert.equal(ast.parseDiagnostics.length,0,'COMPILATION_INPUT_SYNTAX');
    files.push({fileName:name,sha256:digest});
    for(const node of ast.statements){
      if(node.kind!==K.VariableDeclaration)continue;
      const list=owners.get(node.name.name)??[];
      list.push({fileName:name,sha256:digest,start:node.pos,end:node.end,typeKind:node.type.kind,initialized:!!node.initializer});
      owners.set(node.name.name,list);
    }
  }
  assert.equal(seen.size,reached.size,'COMPILATION_RESOLVED_INPUT_MISSING');
  const conflicts=[...owners].filter(([,sites])=>sites.length>1).map(([name,sites])=>({name,sites}));
  return {...base,passed:!conflicts.length,reason:conflicts.length?'MULTIPLE_GLOBAL_STORAGE_OWNERS':'UNIQUE_GLOBAL_STORAGE_OWNERS',
    conflicts,files,closure,globalNamesChecked:owners.size};
}
