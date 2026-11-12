import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {indexSourceFunctionDeclarations,canonicalSourceFunctionDeclaration} from './source-function-declarations.mjs';
import {declaredTriggerConstructorFrame} from './declared-trigger-constructor-frame.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const sha=text=>createHash('sha256').update(text).digest('hex');
const zeroCall=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&
 s.expression.expression.kind===K.Identifier&&!s.expression.arguments.length?s.expression:undefined;

/** Ownership edges only. If GUI recovers a constructor, its source-scheduled
 * caller must join that same ownership transaction. This does not recognize
 * generated initialization, remove code, or grant API/equivalence permission. */
export function sourceStartupOwnershipEdges({program,primaryFiles,ownedFiles,entryPoint='InitMap'}){
 assert(program?.documents instanceof Map&&!program.closed,'STARTUP_OWNERSHIP_BOUND_PROGRAM_REQUIRED');
 const files=new Map([...primaryFiles,...ownedFiles].map(f=>[f.fileName,f])),primary=new Set(primaryFiles.map(f=>f.fileName));
 assert.equal(files.size,primaryFiles.length+ownedFiles.length,'STARTUP_OWNERSHIP_DUPLICATE_SOURCE');
 for(const file of files.values()){
  const identity=program.verifiedInputIdentity(file.fileName),ast=program.documents.get(file.fileName);
  assert(identity?.owned===true&&ast&&identity.contentSha256===sha(file.text)&&ast.text===file.text,'STARTUP_OWNERSHIP_SOURCE_CHANGED');
 }
 const index=indexSourceFunctionDeclarations(program.documents),entry=index.get(entryPoint);
 if(entry?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'||!primary.has(entry.body?.fileName))return [];
 const node=entry.body.node;
 if(node.type.kind!==K.VoidKeyword||node.parameters.length||node.modifiers?.length)return [];
 const output=[],seen=new Set();
 for(const statement of node.body.statements){
  const call=zeroCall(statement);if(!call||program.getBinding(call.expression).status!=='BOUND')continue;
  const phase=canonicalSourceFunctionDeclaration(index,program.declarationAt(call.expression)),group=phase&&index.get(phase.name.name);
  if(group?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'||!phase?.body||!files.has(group.body.fileName)||primary.has(group.body.fileName)||seen.has(phase))continue;
  if(phase.type.kind!==K.VoidKeyword||phase.parameters.length||phase.modifiers?.length)continue;
  seen.add(phase);
  const targets=new Map();
  for(const s of phase.body.statements){
   const c=zeroCall(s);if(!c||program.getBinding(c.expression).status!=='BOUND')continue;
   const target=canonicalSourceFunctionDeclaration(index,program.declarationAt(c.expression)),frame=declaredTriggerConstructorFrame(target);
   const owner=target&&index.get(target.name.name)?.body?.fileName;
   if(!frame||!files.has(owner)||owner===group.body.fileName)continue;
   // A single bound witness per source unit suffices for a file-ownership edge.
   if(!targets.has(owner))targets.set(owner,{fileName:owner,constructor:program.location(target),call:program.location(c)});
  }
  if(targets.size)output.push({kind:'BOUND_SOURCE_SCHEDULE_CALLER_OWNERSHIP',phaseFileName:group.body.fileName,
   entry:program.location(node),phase:program.location(phase),scheduledCall:program.location(call),constructorOwners:[...targets.values()],
   classificationOnly:true,startupMovementAuthorized:false,wholeProgramEquivalent:false});
 }
 return output;
}
