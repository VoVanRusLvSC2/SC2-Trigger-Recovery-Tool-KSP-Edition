import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {nativeGuiInterfacesFor} from '../bindings/native-gui-source-interfaces.naming-index.r1820.mjs';

// Authentication is intentionally UPSTREAM. A caller constructing this factory
// installs a trusted verifier which authenticates original artifacts and native
// results, not a JSON marker/self-hash. This matcher performs no independent
// native authentication, native execution, source declaration or exact ABI proof.
const claims = Object.freeze([
  'nativeGeneration','nativeCompile','compilerErrorsExactlyZero','exactCallInventory',
  'typedArgumentBindings','typedResultContexts','completeRuntimeBodyOracle',
  'activeRootRegistration','exactTopLevelDeclarations','sourcePreservingPack',
  'ownedHiddenSession','ownBridgeClosed','sdkPinsBeforeAfter','oracleBeforeAfter',
  'installedBuildBeforeAfter','sealedArtifactsUnchanged','liveDiskFloorPreserved',
]);
const sha = text => createHash('sha256').update(text).digest('hex');
const freeze = value => {
  if (value && typeof value === 'object') { for (const child of Object.values(value)) freeze(child); Object.freeze(value); }
  return value;
};
const canonical = value => JSON.stringify(value, (_, item) => item && typeof item === 'object' && !Array.isArray(item)
  ? Object.fromEntries(Object.keys(item).sort().map(key => [key,item[key]])) : item);
const text = value => assert(typeof value === 'string' && value.length > 0, 'CALL_FORM_TEXT_REQUIRED');
const digest = value => assert(typeof value === 'string' && /^[a-f0-9]{64}$/.test(value), 'CALL_FORM_DIGEST_REQUIRED');
const reference = (value, type) => { assert(value && value.type === type, 'CALL_FORM_TYPED_REFERENCE_REQUIRED'); assert.deepEqual(Object.keys(value).sort(),['id','library','type'],'CALL_FORM_TYPED_REFERENCE_EXACT_KEYS_REQUIRED'); text(value.library); text(value.id); assert(value.library !== 'Map', 'CALL_FORM_DEPENDENCY_OWNER_REQUIRED'); };
const snapshot = rows => {
  assert(Array.isArray(rows) && rows.length > 0, 'CALL_FORM_SOURCE_SNAPSHOT_REQUIRED');
  const seen = new Set();
  for (const row of rows) { text(row.fileName); digest(row.sha256); assert(!seen.has(row.fileName), 'CALL_FORM_DUPLICATE_SOURCE_SNAPSHOT'); seen.add(row.fileName); }
};
const build = value => { assert(value && typeof value === 'object', 'CALL_FORM_BUILD_REQUIRED'); text(value.buildKey); digest(value.buildInfoSha256); };
const identity = record => {
  assert(record?.kind === 'CATALOG_DERIVED_NATIVE_INTERFACE' && record.sourceDeclaration === false && record.interfaceOnly === true && record.owned === false && record.engineAvailabilityProved === false, 'CALL_FORM_DERIVED_INTERFACE_REQUIRED');
  text(record.name); reference(record.definition,'FunctionDef'); digest(record.catalog?.sha256); build(record.catalog.buildIdentity);
  const s = record.signature;
  assert(s && Array.isArray(s.parameters) && Array.isArray(s.references) && s.parameters.length === s.references.length, 'CALL_FORM_SIGNATURE_REQUIRED');
  text(s.returnType); s.parameters.forEach(text); assert(s.references.every(v => typeof v === 'boolean'), 'CALL_FORM_REFERENCE_MODES_REQUIRED');
  assert(record.returnGuiType?.type && Array.isArray(record.formals) && record.formals.length === s.parameters.length, 'CALL_FORM_GUI_ABI_REQUIRED');
  const seen = new Set();
  record.formals.forEach((f,i) => {
    reference(f.definition,'ParamDef'); const key = canonical(f.definition); assert(!seen.has(key),'CALL_FORM_DUPLICATE_GUI_FORMAL'); seen.add(key);
    assert(f.guiType?.type && typeof f.isReference === 'boolean' && f.carrier === s.parameters[i], 'CALL_FORM_GUI_FORMAL_REQUIRED');
  });
  return {buildIdentity:record.catalog.buildIdentity,catalogSha256:record.catalog.sha256,definition:record.definition,runtimeName:record.name,signature:s,returnGuiType:record.returnGuiType,formals:record.formals};
};
const expectedCallForm = record => ({kind:'DIRECT_ORDINARY_NATIVE',arity:record.signature.parameters.length,argumentCarriers:record.signature.parameters,referenceModes:record.signature.references,
  resultContext:{kind:record.signature.returnType === 'void' ? 'VOID_STATEMENT' : 'TYPED_ASSIGNMENT',carrier:record.signature.returnType}});
const boundaries = Object.freeze({independentNativeAuthentication:false,sourceDeclaration:false,typedSourceDeclarationsComplete:false,exactEngineSignatureProved:false,fullProof:false,currentSourceNativeCompiled:false,runtimeValuesProved:false,workerIntegrated:false});

export function createNativeCatalogCallFormQualifier({verifyEvidence}) {
  assert(typeof verifyEvidence === 'function', 'TRUSTED_UPSTREAM_EVIDENCE_VERIFIER_REQUIRED');
  const minted = new WeakMap();
  return Object.freeze({
    async verify(evidenceRequest) {
      // Prevent caller mutations during an asynchronous verifier from changing
      // the request that authority authenticated. Never retain verifier aliases.
      const request = freeze(structuredClone(evidenceRequest));
      const evidence = freeze(structuredClone(await verifyEvidence(request)));
      assert(evidence?.kind === 'VERIFIED_NATIVE_CATALOG_CALL_FORMS', 'VERIFIED_CALL_FORM_EVIDENCE_REQUIRED');
      text(evidence.evidenceIdentity?.sourceLabel); digest(evidence.evidenceIdentity?.sha256); build(evidence.buildIdentity); snapshot(evidence.sourceSnapshot);
      assert(evidence.compilerErrors === 0, 'CALL_FORM_ZERO_COMPILER_ERRORS_REQUIRED');
      assert(evidence.requiredClaims && Object.keys(evidence.requiredClaims).length >= claims.length && claims.every(name => evidence.requiredClaims[name] === true)
        && Object.values(evidence.requiredClaims).every(v => v === true), 'CALL_FORM_COMPLETE_REQUIRED_CLAIMS_REQUIRED');
      assert(Array.isArray(evidence.catalogPins) && evidence.catalogPins.length > 0, 'CALL_FORM_CATALOG_PINS_REQUIRED');
      const catalogs = new Set(), catalogOwners = new Set();
      for (const pin of evidence.catalogPins) { text(pin.library); digest(pin.sha256); const key = canonical([pin.library,pin.sha256]); assert(!catalogs.has(key) && !catalogOwners.has(pin.library), 'CALL_FORM_DUPLICATE_CATALOG_PIN'); catalogs.add(key); catalogOwners.add(pin.library); }
      assert(Array.isArray(evidence.records) && evidence.records.length > 0, 'CALL_FORM_NONEMPTY_INVENTORY_REQUIRED');
      const records = new Map(), owners = new Set(), names = new Set();
      for (const row of evidence.records) {
        const id = identity(row.interface), key = canonical(id), owner = canonical([id.definition.library,id.definition.type,id.definition.id]);
        assert.equal(canonical(id.buildIdentity),canonical(evidence.buildIdentity),'CALL_FORM_BUILD_MISMATCH');
        assert(catalogs.has(canonical([id.definition.library,id.catalogSha256])),'CALL_FORM_UNPINNED_CATALOG');
        assert.equal(canonical(row.callForm),canonical(expectedCallForm(row.interface)),'CALL_FORM_WITNESS_MISMATCH');
        assert(!records.has(key) && !owners.has(owner) && !names.has(id.runtimeName),'CALL_FORM_DUPLICATE_OR_CONFLICTING_IDENTITY');
        records.set(key,id); owners.add(owner); names.add(id.runtimeName);
      }
      const capability = Object.freeze({kind:'NATIVE_CATALOG_CALL_FORM_CAPABILITY'});
      minted.set(capability,{evidence,records}); return capability;
    },
    qualify({interfaces,sourceDocuments,evidence}) {
      const fresh = nativeGuiInterfacesFor(interfaces,sourceDocuments);
      const sourceSnapshot = sourceDocuments.map(d => ({fileName:d.fileName,sha256:sha(d.text)}));
      if (!fresh.length) return freeze({kind:'NATIVE_CATALOG_CALL_FORM_COVERAGE',status:'NOT_NEEDED',allFreshRecordsCovered:true,catalogCallFormsQualified:false,records:[],sourceSnapshot,...boundaries});
      const proof = minted.get(evidence); assert(proof, 'UNTRUSTED_CALL_FORM_CAPABILITY');
      const covered=[],missing=[];
      for (const record of fresh) {
        const id = identity(record), key = canonical(id);
        (proof.records.has(key) ? covered : missing).push(id);
      }
      return freeze({kind:'NATIVE_CATALOG_CALL_FORM_COVERAGE',status:missing.length ? 'UNCOVERED_FRESH_RECORDS' : 'QUALIFIED_CONCRETE_CALL_FORMS',allFreshRecordsCovered:missing.length === 0,catalogCallFormsQualified:missing.length === 0,
        records:covered,missing,sourceSnapshot,evidenceIdentity:proof.evidence.evidenceIdentity,nativeFixtureSourceSnapshot:proof.evidence.sourceSnapshot,...boundaries});
    },
  });
}
