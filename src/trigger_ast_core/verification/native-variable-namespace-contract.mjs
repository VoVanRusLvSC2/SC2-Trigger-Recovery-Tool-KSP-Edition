import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {readOwnedGuiLibraries} from './read-owned-gui-libraries.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {globalVariables} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const states=new WeakMap(),sha=b=>createHash('sha256').update(b).digest('hex');
const workspace=fileURLToPath(new URL('../../',import.meta.url));
const checked=async p=>{assert(typeof p?.path==='string'&&/^[a-f0-9]{64}$/u.test(p.sha256),'NAMESPACE_EVIDENCE_PIN_REQUIRED');
 const absolute=path.isAbsolute(p.path)?p.path:path.resolve(workspace,p.path);
 if(!path.isAbsolute(p.path))assert(!path.relative(workspace,absolute).startsWith('..'),'NAMESPACE_RELATIVE_EVIDENCE_ESCAPE');
 const b=await readFile(absolute);assert.equal(sha(b),p.sha256,'NAMESPACE_EVIDENCE_SHA:'+p.path);return b;};
const ast=text=>{const a=parse(text,'NamespaceEvidence.galaxy');assert.equal(a.parseDiagnostics.length,0,'NAMESPACE_EVIDENCE_SYNTAX');return a;};
const intGlobals=text=>ast(text).statements.filter(n=>n.kind===K.VariableDeclaration&&n.type.kind===K.IntKeyword&&!n.modifiers?.length);

/** Negative calibration from a retained real Editor export. The old SDK and
 * current build are read only. This scope does not claim that every GUI role,
 * type, flag or library shares the observed naming rule. */
export async function withNativeVariableNamespaceObservation({reportPin,buildPin},operation){
 const pins=[reportPin,buildPin],report=JSON.parse(await checked(reportPin));
 assert.equal(report.kind,'REAL_EDITOR_COUNTEREXAMPLE_TO_SDK_VARIABLE_PREFIX_FLAG');
 assert(report.actualEditor&&report.realEditorGeneratedAndCompiled&&report.compilerErrors===0&&report.ownBridgeClosed,'NAMESPACE_NATIVE_COMPLETION_REQUIRED');
 assert.equal(report.build.sha256,buildPin.sha256,'NAMESPACE_CURRENT_BUILD_CHANGED');
 pins.push(report.build,report.nativeReport,report.sdkExport,report.nativeExport,report.fixture,report.sdkRuntime);
 const native=JSON.parse(await checked(report.nativeReport));
 assert(native.native?.nativeGenerationVerified&&native.native?.nativeCompilePassed&&native.native.compilerErrors===0&&native.ownBridgeClosed,'NAMESPACE_REAL_NATIVE_RESULT_REQUIRED');
 assert.equal(native.export.sha256,report.nativeExport.sha256);
 pins.push(native.descriptor);const descriptor=JSON.parse(await checked(native.descriptor));pins.push(descriptor.xml);
 const libraries=readOwnedGuiLibraries((await checked(descriptor.xml)).toString('utf8'));
 const identity=report.variable,library=libraries.get(identity.library);assert(library,'NAMESPACE_FIXTURE_GUI_OWNER');
 const matches=globalVariables(library).filter(e=>e.type==='Variable'&&e.id===identity.id);assert.equal(matches.length,1);
 const variable=matches[0],stem=variable.identifier;
 assert(variable.flags?.includes('NoScriptPrefix')&&variable.variableType?.type==='int'&&!variable.isArray&&!variable.isConstant&&typeof stem==='string'&&/^[A-Za-z_]\w*$/u.test(stem),'NAMESPACE_FIXTURE_SCOPE_CHANGED');
 const sdkNames=intGlobals((await checked(report.sdkExport)).toString('utf8')).map(n=>n.name.name);
 const nativeNames=intGlobals((await checked(report.nativeExport)).toString('utf8')).map(n=>n.name.name);
 assert(sdkNames.includes(stem)&&!nativeNames.includes(stem),'NAMESPACE_COUNTEREXAMPLE_NOT_PRESENT');
 const emitted=nativeNames.filter(name=>name!==stem&&name.endsWith(stem));assert.equal(emitted.length,1);
 const prefix=emitted[0].slice(0,-stem.length);assert(/^[A-Za-z_]\w*_$/u.test(prefix),'NAMESPACE_PREFIX_NOT_IDENTIFIABLE');
 for(const p of pins)await checked(p);
 const capability=Object.freeze({kind:'OBSERVED_GUI_VARIABLE_NAMESPACE'}),state={active:true,prefix,library:identity.library,reportPin,buildPin};states.set(capability,state);
 try{return await operation(capability);}finally{state.active=false;for(const p of pins)await checked(p);}
}

/** Diagnostic veto, never a renamer or an equivalence permission. A model
 * mismatch and an unqualified scope remain explicit requirements for Native. */
export function inspectGuiVariableNamespace({capability,libraries,generatedSource,implicitLibraryId='Map',documentKind='map'}){
 const state=states.get(capability);assert(state?.active,'NAMESPACE_UNTRUSTED_OR_CLOSED_CAPABILITY');
 assert(libraries instanceof Map,'NAMESPACE_TYPED_GUI_REQUIRED');
 const source=ast(generatedSource),globals=new Map();for(const n of source.statements)if(n.kind===K.VariableDeclaration){const rows=globals.get(n.name.name)??[];rows.push(n);globals.set(n.name.name,rows);}
 const result={kind:'OBSERVED_NATIVE_VARIABLE_NAMESPACE_PREFLIGHT',observation:state.reportPin,build:state.buildPin,
  issues:[],unqualified:[],checked:[],sourceOrGuiChanged:false,actualNativeExportStillRequired:true,wholeMapAccepted:false};
 const library=libraries.get(implicitLibraryId);if(!library){result.unqualified.push({reason:'IMPLICIT_LIBRARY_MISSING'});return {...result,applicable:null,status:'UNQUALIFIED',passed:false};}
 const variables=globalVariables(library),stems=new Map();for(const e of variables){const rows=stems.get(e.identifier)??[];rows.push(e);stems.set(e.identifier,rows);}
 for(const e of variables){
  assert(e.library===undefined||e.library===implicitLibraryId,'NAMESPACE_VARIABLE_OWNER_CHANGED');
  if(!e.flags?.includes('NoScriptPrefix'))continue;
  const reference={library:implicitLibraryId,type:'Variable',id:e.id},stem=e.identifier;
  if(documentKind!=='map'||implicitLibraryId!==state.library||e.variableType?.type!=='int'||e.isArray||e.isConstant||typeof stem!=='string'||!/^[A-Za-z_]\w*$/u.test(stem)||stems.get(stem).length!==1){
   result.unqualified.push({reference,reason:'OUTSIDE_OBSERVED_SCALAR_INT_NAMESPACE_SCOPE'});continue;
  }
  const expected=state.prefix+stem,bare=globals.get(stem)??[],prefixed=globals.get(expected)??[];
  const valid=n=>n.type.kind===K.IntKeyword&&!n.modifiers?.length;
  if(bare.length===1&&valid(bare[0])&&!prefixed.length)result.issues.push({reference,sdkName:stem,observedEditorName:expected,reason:'NO_SCRIPT_PREFIX_FLAG_IGNORED_BY_OBSERVED_EDITOR'});
  else if(prefixed.length===1&&valid(prefixed[0])&&!bare.length)result.checked.push({reference,sdkName:expected,agreesWithObservedNamespace:true});
  else result.unqualified.push({reference,reason:'EMITTED_STORAGE_IDENTITY_NOT_UNIQUE',bareDeclarations:bare.length,prefixedDeclarations:prefixed.length});
 }
 const applicable=result.issues.length+result.unqualified.length+result.checked.length>0;
 return {...result,applicable,status:!applicable?'NOT_APPLICABLE':result.issues.length?'MODEL_MISMATCH':result.unqualified.length?'UNQUALIFIED':'AGREES_WITH_OBSERVATION',
  passed:applicable?result.issues.length===0&&result.unqualified.length===0:null};
}
