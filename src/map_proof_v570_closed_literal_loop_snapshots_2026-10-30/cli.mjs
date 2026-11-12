import {openPreparedDataProofContext} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/sdk_gui_closure_20261019/prepared-data-proof-context-r3650.mjs';
import assert from 'node:assert/strict';
import {readFile,writeFile,mkdir,statfs} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {readLocalArchive} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_local_dependencies_2026-10-04/pack_local_components.mjs';
import {proveArchiveFiniteProgramEquivalence} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v570_closed_literal_loop_snapshots_2026-10-30/graph/6ec7f50147f9-112b1e9-archive-finite-program-proof.private-root-alpha.protected-sources.experimental.mjs';
import {verifyArchiveIncludeBindings} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_proof_v526_data_namespace_2026-10-29/graph/45cc88b84ff8-archive-include-bindings.mjs';
import {readOwnedGuiLibraries} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/verification/read-owned-gui-libraries.mjs';
import {writeLosslessJsonEvidence} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/sdk_gui_closure_20261019/lossless-json-evidence.compact.mjs';
import {writePartitionedJsonEvidence,readPartitionedJsonEvidence} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/sdk_gui_closure_20261019/lossless-json-evidence.partitioned.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex'),d=import.meta.dirname,w=path.dirname(d);
const pin=async p=>({path:p,sha256:sha(await readFile(p))});
const checked=async p=>{const b=await readFile(p.path);assert.equal(sha(b),p.sha256,p.path);return b;};
const json=async p=>JSON.parse(await readFile(p,'utf8'));
const args=process.argv.slice(2);assert.equal(args.length,3,'Usage: job-folder output-folder native-receipt');
const nativePin=await pin(path.resolve(args[2])),native=JSON.parse(await checked(nativePin));assert(native.nativeGenerationVerified);
const job=path.resolve(args[0]),out=path.resolve(args[1]);assert(!path.relative(w,out).startsWith('..'),'CANONICAL_OUTPUT_REQUIRED');
const cfg=await json(path.join(job,'config.json')),workerPin=await pin(path.join(job,'RESULT.json')),worker=JSON.parse(await checked(workerPin));
const prep=JSON.parse(await checked({path:cfg.preparationResult,sha256:cfg.preparationResultSha256}));
await mkdir(out);const report={kind:'COMPLETE_ARCHIVE_ACTUAL_NATIVE_BENCHMARK_DIAGNOSIS',id:cfg.id,startedAt:new Date().toISOString(),state:'STARTING',
 workerResult:workerPin,sourceArchive:{path:cfg.original,sha256:cfg.originalSha256},actualNativeExport:true,nativeGenerationReceipt:nativePin,nativeCompilePassed:native.nativeCompilePassed,variants:[],
 newEquivalenceRules:1,wholeMapAccepted:false,benchmarkWeakened:false};
const publish=async()=>{const bytes=Buffer.from(JSON.stringify(report,null,2)+'\n'),disk=await statfs('K:/');assert(disk.bavail*disk.bsize-bytes.length>192*1024**2);await writeFile(path.join(out,'RESULT.json'),bytes);};
let original,connected;
try{
 await checked(report.sourceArchive);const connectedPin={path:cfg.archive,sha256:cfg.archiveSha256};await checked(connectedPin);
 const hosts=prep.actualChain.filter(l=>l.sourceId==='host'&&path.resolve(l.sourcePath)===path.resolve(cfg.archive));assert.equal(hosts.length,1);
 original=await readLocalArchive(cfg.original);connected=await readLocalArchive(cfg.archive);
 const owned=await json(path.join(job,'OWNED_SCRIPTS_PROOF.json')),names=['MapScript.galaxy',...owned.files.map(f=>f.originalPath??f.fileName)];
 let before;for(const name of names){const a=original.reader.find(name),b=connected.reader.find(name);assert(a&&b);
  const ab=Buffer.from(await original.reader.read(a.id)),bb=Buffer.from(await connected.reader.read(b.id));assert(ab.equals(bb),'ORIGINAL_CONNECTED_SOURCE_CHANGED:'+name);if(name==='MapScript.galaxy')before=ab.toString('utf8');}
 original.reader.dispose();original=undefined;connected.reader.dispose();connected=undefined;
 report.sourceIdentity={connected:connectedPin,archiveLayerId:hosts[0].id,checkedFiles:names.length,allBytesEqual:true};
 const declarations=[];for(const p of prep.declarationInputs)declarations.push({fileName:p.sourceLabel,text:(await checked(p)).toString('utf8')});
 const nativeRows=prep.dependencyInputs.filter(p=>p.triggerData?.sourceLabel?.toLowerCase().endsWith('nativelib.triggerlib'));assert.equal(nativeRows.length,1);
 const nativeGuiLibraries=readOwnedGuiLibraries((await checked(nativeRows[0].triggerData)).toString('utf8'),'Ntve');
 const nativeProof=await json(path.join(job,'LIVE_NATIVE_PROOF.json'));
 for(const v of worker.variants){
  const current={mode:v.mode,candidate:{path:v.candidate,sha256:v.candidateSha256},exportFile:native.export};
  assert.equal(current.candidate.sha256,native.candidate.sha256);assert.equal(current.candidate.path,native.candidate.path);
  await checked(current.candidate);const after=(await checked(current.exportFile)).toString('utf8');report.variants.push(current);
  report.state='VERIFYING_EXPLICIT_ARCHIVE_INCLUDE_BINDINGS';await publish();
  current.bindings=await verifyArchiveIncludeBindings({before,after,sourceArchive:report.sourceArchive,candidateArchive:current.candidate,
   declarations,nativeProof,includeEvidence:prep.includeEvidence,archiveLayerId:hosts[0].id});
  report.state='CHECKING_COMPLETE_ARCHIVE_PROGRAM';await publish();console.log(JSON.stringify({id:cfg.id,mode:v.mode,phase:report.state}));
  const comparedPair=path.join(out,v.mode+'.COMPARED_PROGRAM_PAIR.json');
  const proofStarted=performance.now(),proofCpuStarted=process.cpuUsage();
  const proof=await proveArchiveFiniteProgramEquivalence(before,after,{sourceArchive:report.sourceArchive,candidateArchive:current.candidate,
   exportFile:current.exportFile,declarations,nativeProof,openDataProofContext:()=>openPreparedDataProofContext(cfg,prep),archiveLayerId:hosts[0].id,closedContext:{includeEvidence:prep.includeEvidence},nativeGuiLibraries,
   observeComparisonPair:async pair=>{await writeLosslessJsonEvidence(comparedPair,pair);current.comparedProgramPair={receipt:await pin(comparedPair),compressed:await pin(comparedPair+'.gz'),beforeSha256:pair.beforeSha256,afterSha256:pair.afterSha256};}});
  assert.equal(current.comparedProgramPair.beforeSha256,proof.finite.viewSha256.before);assert.equal(current.comparedProgramPair.afterSha256,proof.finite.viewSha256.after);
  current.proofTiming={elapsedMs:performance.now()-proofStarted,cpuMicroseconds:process.cpuUsage(proofCpuStarted)};
  current.unpublishedProofSummary={finiteProgramEquivalent:proof.finiteProgramEquivalent,selectedProofView:proof.finite.selectedProofView,oracleAssetsVerified:proof.oracleAssetsVerified,witnessStored:false};report.state='PERSISTING_COMPLETE_WITNESS';await publish();
  const witness=path.join(out,v.mode+'.WITNESS.json');const witnessManifest=await writePartitionedJsonEvidence(witness,proof);
  const restored=await readPartitionedJsonEvidence(witness);assert.equal(restored.finiteProgramEquivalent,proof.finiteProgramEquivalent);
  assert.deepEqual(restored.finite.viewSha256,proof.finite.viewSha256);assert.equal(restored.oracleManifestSha256,proof.oracleManifestSha256);
  current.witness=await pin(witness);current.partitionedWitness={parts:witnessManifest.parts.length,uncompressedBytes:witnessManifest.uncompressedBytes,uncompressedSha256:witnessManifest.uncompressedSha256,readbackVerified:true};
  current.unpublishedProofSummary.witnessStored=true;
  report.newEquivalenceRules=proof.finite.newEquivalenceRules;
  current.loopCaptureRefinement={selected:proof.finite.closedLoopCaptures?.selected??false,completeProgramCompared:proof.finite.closedLoopCaptures?.completeProgramCompared??false};
  current.finiteProgramEquivalent=proof.finiteProgramEquivalent;current.declarationVisibility={before:{passed:proof.declarationVisibility.before.passed,failures:proof.declarationVisibility.before.failures.length},after:{passed:proof.declarationVisibility.after.passed,failures:proof.declarationVisibility.after.failures.length,unqualifiedCalls:proof.declarationVisibility.after.unqualifiedCalls}};current.offlineConversionStatus=proof.offlineConversionStatus;current.actualNativeStatus=proof.offlineConversionStatus==='PASS'&&native.nativeCompilePassed?'PASS':'REVIEW';const c=proof.finite.comparison;
  current.remainingFunctions=c.functions.differing;current.missingFunctions=c.functions.missing;current.addedFunctions=c.functions.added;
  current.sections=Object.fromEntries(Object.entries(c).filter(([,v])=>v&&typeof v==='object'&&!Array.isArray(v)).map(([k,v])=>[k,
   Object.fromEntries(Object.entries(v).filter(([name])=>['expected','actual','exact','missing','added','differing','missingCount','addedCount'].includes(name))
    .map(([name,x])=>[name,Array.isArray(x)?x.length:typeof x==='number'||typeof x==='boolean'?x:null]))]));
  current.composition={sourceFiles:proof.composition.before.files.length,candidateFiles:proof.composition.after.files.length};
  current.storageBindingSummary={accepted:proof.globalBindingTransport?.records?.length??0,refused:proof.globalBindingTransport?.refused??[],observers:proof.globalBindingTransport?.namedStorageObservers??[]};
  current.selectedProofView=proof.finite.selectedProofView;current.oracleAssetsVerified=proof.oracleAssetsVerified;
  await checked(current.candidate);await checked(current.exportFile);
 }
 report.state='TERMINAL';
}catch(error){report.state='DIAGNOSIS_REFUSED';report.error=String(error.message);report.stack=String(error.stack).slice(0,2500);}
finally{original?.reader.dispose();connected?.reader.dispose();}
await checked(report.sourceArchive);await checked(workerPin);report.inputsUnchanged=true;report.finishedAt=new Date().toISOString();await publish();
console.log(JSON.stringify({id:cfg.id,state:report.state,error:report.error,variants:report.variants.map(v=>({mode:v.mode,
 equivalent:v.finiteProgramEquivalent,remaining:v.remainingFunctions?.length,missing:v.missingFunctions?.length,added:v.addedFunctions?.length})),report:path.join(out,'RESULT.json')}));
