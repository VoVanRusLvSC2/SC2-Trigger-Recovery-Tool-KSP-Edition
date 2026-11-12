import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
import {qualifyNativePrefixBeforeComposition} from './native-prefix-before-owned-composition.mjs';
import {composeArchiveOwnedSourcePair} from './map-owned-source-composition.include-once.v3.mjs';
import {proveClosedFiniteProgramEquivalence} from './finite-program-proof-pipeline.grouped-global-layout.mjs';
import {readOwnedGuiLibraries} from './read-owned-gui-libraries.mjs';

const sha=value=>createHash('sha256').update(value).digest('hex');
const limits={maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2};
const checked=async pin=>{const bytes=await readFile(pin.path);assert.equal(sha(bytes),pin.sha256,'ARCHIVE_PROOF_INPUT_SHA');return bytes;};

/** Compare the actual server root and complete archive-owned bodies. Root-only
 * differences remain evidence; the existing finite checker sees one complete
 * pair, never a union of independently passing functions. This grants no Editor,
 * compile, original lobby/defaults, GUI-quality or whole-map acceptance. */
export async function proveArchiveFiniteProgramEquivalence(before,after,options){
 const {sourceArchive,candidateArchive,exportFile,declarations=[],nativeProof,closedContext={}}=options;
 assert(typeof before==='string'&&typeof after==='string','ARCHIVE_PROOF_ROOT_TEXT_REQUIRED');
 assert((await checked(exportFile)).toString('utf8')===after,'ARCHIVE_PROOF_EXPORT_BYTES_REQUIRED');
 const source=await openMpqReader(await checked(sourceArchive),limits);
 try{const entry=source.find('MapScript.galaxy');assert(entry,'ARCHIVE_PROOF_ORIGINAL_ROOT_MISSING');
  assert(Buffer.from(await source.read(entry.id)).toString('utf8')===before,'ARCHIVE_PROOF_ORIGINAL_ROOT_NOT_SERVER_BYTES');
 }finally{source.dispose();}
 const candidate=await openMpqReader(await checked(candidateArchive),limits);let guiLibraries;
 try{const entry=candidate.find('Triggers');assert(entry,'ARCHIVE_PROOF_CANDIDATE_GUI_MISSING');
  guiLibraries=readOwnedGuiLibraries(Buffer.from(await candidate.read(entry.id)).toString('utf8'),'Map');
 }finally{candidate.dispose();}
 const oracle=await openPinnedUserOracle();
 const rawRootComparison=await oracle.compare(before,after);
 const prefix={before:qualifyNativePrefixBeforeComposition(before,{declarations,nativeProof}),
  after:qualifyNativePrefixBeforeComposition(after,{declarations,nativeProof})};
 const composition=await composeArchiveOwnedSourcePair(prefix.before.text,prefix.after.text,
  {sourceArchive,candidateArchive,declarations,includeEvidence:closedContext.includeEvidence});
 // The bodies are now present in these roots. Retaining duplicate declaration
 // views would invent ambiguous symbols and alter source ownership.
 const proof=await proveClosedFiniteProgramEquivalence(composition.before,composition.after,{
  ...options,declarations:composition.declarations,guiLibraries,
  closedContext:{...closedContext,ownedSources:[],externalSources:composition.declarations,
   includeEvidence:composition.includeEvidence}});
 await oracle.verify();await checked(sourceArchive);await checked(candidateArchive);await checked(exportFile);
 const implementations=await Promise.all(['archive-finite-program-proof.mjs','map-owned-source-composition.include-once.v3.mjs',
  'native-prefix-before-owned-composition.mjs','finite-program-proof-pipeline.grouped-global-layout.mjs'].map(async name=>{
   const url=new URL(name,import.meta.url);return {path:url.href,sha256:sha(await readFile(url))};}));
 return {kind:'ACTUAL_ARCHIVE_COMPOSED_FINITE_PROGRAM_PROOF',sourceArchive,candidateArchive,exportFile,
  inputSha256:{before:sha(before),after:sha(after)},rawRootComparison,
  nativePrefix:{before:prefix.before.proof,after:prefix.after.proof},composition:composition.proof,
  finite:proof,finiteProgramEquivalent:proof.finiteProgramEquivalent,
  completeProgramPairOnly:true,perFunctionProofUnion:false,archiveBytesRechecked:true,
  implementations,oracleAssetsVerified:oracle.assets,oracleManifestSha256:oracle.manifestSha256,
  rawOracleReplaced:false,newEquivalenceRules:0,persistentCache:false,sourceOrExportChanged:false,
  actualEditor:false,compile:false,wholeMapAccepted:false,fullOriginalLobbyProved:false};
}
