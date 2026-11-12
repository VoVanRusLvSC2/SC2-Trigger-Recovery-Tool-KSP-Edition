import {createHash} from 'node:crypto';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {declaredTriggerConstructorFrame} from './declared-trigger-constructor-frame.mjs';
import {planSourceTriggerConstructors} from './source-trigger-constructor-ownership.final-identities.mjs';
import {classifyPartitionFunctionIdentities} from './partition-function-identities.mjs';
const sha=x=>createHash('sha256').update(x,'utf8').digest('hex');
const norm=x=>x.replaceAll('\\','/').toLowerCase();

// Source identity and direct-call ownership candidates only. Dynamic name
// observers, actual GUI export, ordering and runtime equivalence remain gates.
export function analyzePartitionStartupCandidates({program,whole,part,closure,libraries,nativeLibraryId,candidates}){
 const no=reason=>({status:'REFUSED',reason,records:[],startupMovementAuthorized:false,wholeProgramEquivalenceProved:false});
 if(!program||program.closed||!whole||!part||!Array.isArray(candidates)||!candidates.length||new Set(candidates).size!==candidates.length||
    !closure?.completeReachableClosure||closure.status!=='UNCHANGED'||closure.originalInputsChanged!==false||!Array.isArray(closure.resolvedFiles))return no('CLOSED_SOURCE_INPUT_REQUIRED');
 if(whole.parseDiagnostics?.length||part.parseDiagnostics?.length||typeof whole.text!=='string'||typeof part.text!=='string'||closure.root?.sha256!==sha(whole.text))return no('SOURCE_IDENTITY_OR_PARSE');
 const docs=new Map();for(const [name,ast] of program.documents){const identity=program.verifiedInputIdentity(name);if(!identity?.contentSha256||sha(ast.text)!==identity.contentSha256||docs.has(norm(name)))return no('UNVERIFIED_DOCUMENT');docs.set(norm(name),identity.contentSha256)}
 if(docs.get(norm(whole.fileName))!==sha(whole.text)||program.conflictingDeclarationNames().length)return no('ROOT_OR_DECLARATION_CONFLICT');
 for(const f of closure.resolvedFiles){if(f.layerId===null){if(f.sha256!==sha(whole.text))return no('ROOT_CLOSURE_MISMATCH');}else if(docs.get(norm(f.path))!==f.sha256)return no('CLOSURE_MEMBER_MISMATCH');}
 const funcs=whole.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body),roots=funcs.filter(n=>n.name.name==='InitMap');if(roots.length!==1)return no('ROOT_ENTRY_NOT_UNIQUE');
 const frames=funcs.map(declaredTriggerConstructorFrame).filter(f=>f&&candidates.includes(f.callback));
 if(frames.length!==candidates.length||new Set(frames.map(f=>f.callback)).size!==candidates.length)return no('CONSTRUCTOR_FRAME_NOT_UNIQUE');
 const wholeSha256=sha(whole.text),partSha256=sha(part.text),args={whole,part,wholeSha256,partSha256};
 const constructors=classifyPartitionFunctionIdentities({...args,names:frames.map(f=>f.sourceFunction)}),callbacks=classifyPartitionFunctionIdentities({...args,names:frames.map(f=>f.callback),compareBodies:false});
 if(constructors.status!=='CLASSIFIED'||callbacks.status!=='CLASSIFIED')return no('PARTITION_IDENTITY_UNAVAILABLE');
 const identical=new Set(constructors.records.map(r=>r.name)),compatibleCallbacks=new Set(callbacks.records.map(r=>r.name));
 const matched=frames.filter(f=>identical.has(f.sourceFunction)&&compatibleCallbacks.has(f.callback));
 const ownership=planSourceTriggerConstructors({program,statements:whole.statements,candidates:new Set(candidates),libraries,nativeLibraryId});
 const excluded=new Set([...ownership.records.map(r=>r.constructor),...ownership.refused.map(r=>r.constructor)]);
 const records=matched.filter(f=>!excluded.has(f.sourceFunction)&&!ownership.ordinaryCallbacks.has(f.callback)).map(f=>({constructor:f.sourceFunction,callback:f.callback,handle:f.handle}));
 return {status:'CANDIDATES',sourceSha256:wholeSha256,partSha256,records,excludedCount:frames.length-records.length,
  directSourceOwnershipOnly:true,callbackBodiesCompared:false,dynamicObserversProved:false,startupMovementAuthorized:false,wholeProgramEquivalenceProved:false};
}
