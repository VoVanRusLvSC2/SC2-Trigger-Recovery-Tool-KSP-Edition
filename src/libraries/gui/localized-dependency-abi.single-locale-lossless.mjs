// The same three metadata-binding stages, with one source-document parse per
// locale. Only small final ABI candidate facts survive that locale's scan.
// No parsed cache, retained cross-call state or dependency archive writes.
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { openMpqReader } from '../../vendor/@modkit/blizzard-mpq/src/mpq/codec.js';
import { readAuthoredTriggerDocument } from '../../ast/read-authored.scope.mjs';
import {
  globalVariables,
  globalVariableSpellings,
} from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {
  toGalaxyFunctionName,
  triggerHandleName,
  mapParameterTypeToGalaxy,
  withIsolatedNamingIndexes,
  resolveRefFull,
  deriveNativeTypeMapping,
  memberVarName,
  structureTypeName,
} from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import { parseGalaxySource } from '../../ast/galaxy-to-trigger.mjs';
import {
  getTypeName,
  unwrapArrayType,
} from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import { collectAbiSignatures } from './localized-call-trigger-abi.mjs';
import { patchUniqueIdentifier } from './patch-unique-abi-identifier.lossless.mjs';
import { collectStructAbi, patchMemberDisplayName } from './localized-struct-member-abi.mjs';
export { collectAbiSignatures, patchUniqueIdentifier, collectStructAbi, patchMemberDisplayName };
const sha = (b) => createHash('sha256').update(b).digest('hex');
const sdk = JSON.parse(
  await readFile(new URL('../../ast/config.json', import.meta.url), 'utf8'),
).sdk;
const limits = { maxArchiveBytes: 1024 ** 3, maxEntries: 100000, maxEntryBytes: 256 * 1024 ** 2 };

export async function bindLocalizedDependencyAbi(prepared, documents, declarations) {
  const declared = new Map(),
    conflicts = new Set();
  for (const source of declarations) {
    const ast = parseGalaxySource(source.text, source.fileName);
    if (ast.parseDiagnostics.length) continue;
    for (const n of ast.statements)
      if (n.kind === 141 && n.name?.name) {
        const { baseType, sizes } = unwrapArrayType(n.type),
          type = getTypeName(baseType),
          key = JSON.stringify([type, sizes.length]);
        const prior = declared.get(n.name.name);
        if (prior && prior.key !== key) conflicts.add(n.name.name);
        declared.set(n.name.name, { key, type, dimensions: sizes.length });
      }
  }
  // Keep the original independent declaration conflict/type validators. This
  // optimization concerns repeated GUI XML parsing, not type inference policy.
  const abi = collectAbiSignatures(declarations),
    structAbi = collectStructAbi(declarations);
  const out = documents.map((d) => ({ ...d })),
    variableChanges = [],
    callChanges = [],
    memberChanges = [],
    variableRefused = [],
    callRefused = [],
    memberRefused = [];
  const work = {
    archiveReads: 0,
    mountedDocumentParses: 0,
    localeDocumentParses: 0,
    primaryDocumentParses: 0,
    fellBackToOriginal: false,
    persistentCache: false,
  };
  const parse = async (xml, strings, kind) => {
    work[kind]++;
    return (await readAuthoredTriggerDocument(xml, sdk, strings)).document;
  };
  const mountedLibraries = new Map();
  for (const d of documents) {
    const parsed = await parse(d.triggerData, d.triggerStrings ?? '', 'mountedDocumentParses');
    for (const lib of parsed.libraries.values())
      if (lib.id !== 'Map') {
        const prior = mountedLibraries.get(lib.id);
        assert(
          !prior || JSON.stringify(prior) === JSON.stringify(lib),
          'Ambiguous mounted library ID ' + lib.id,
        );
        mountedLibraries.set(lib.id, lib);
      }
  }
  const nativeTypes = mountedLibraries.get('Ntve');
  if (nativeTypes) deriveNativeTypeMapping(nativeTypes, declarations);
  const documentHashes = documents.map((d) => sha(d.triggerData));
  const facts = [];
  for (const mod of prepared.actualMods ?? []) {
    const bytes = await readFile(mod.destination);
    assert.equal(sha(bytes), mod.destinationSha256);
    work.archiveReads++;
    const mpq = await openMpqReader(bytes, limits);
    try {
      const te = mpq.find('Triggers');
      if (!te) continue;
      const xml = Buffer.from(await mpq.read(te.id)).toString('utf8'),
        sourceHash = sha(xml);
      const indices = documentHashes.flatMap((h, i) => (h === sourceHash ? [i] : []));
      if (indices.length !== 1) {
        facts.push({ mod, invalidDocument: true });
        continue;
      }
      const index = indices[0],
        variableCandidates = new Map(),
        callCandidates = new Map(),
        memberCandidates = new Map();
      for (const e of mpq.entries.filter((e) =>
        /^[a-z]{4}\.SC2Data[\\/]LocalizedData[\\/]TriggerStrings\.txt$/iu.test(e.path ?? ''),
      )) {
        const strings = Buffer.from(await mpq.read(e.id)).toString('utf8'),
          localeSha256 = sha(strings);
        const doc = await parse(xml, strings, 'localeDocumentParses');
        // Legacy variable stage: retain its own exact raw variable-type contract,
        // including its intentional distinction from preset lowering below.
        for (const library of doc.libraries.values())
          for (const variable of globalVariables(library)) {
            if (variable.identifier !== undefined || !variable.name) continue;
            for (const spelling of globalVariableSpellings(library.id, variable)) {
              const actual = declared.get(spelling);
              if (
                !actual ||
                conflicts.has(spelling) ||
                actual.type !== variable.variableType?.type ||
                actual.dimensions !== (variable.isArray ? (variable.arraySizes?.length ?? 1) : 0)
              )
                continue;
              const key = library.id + ':' + variable.id,
                list = variableCandidates.get(key) ?? new Map();
              list.set(spelling, { spelling, locale: e.path, localeSha256 });
              variableCandidates.set(key, list);
            }
          }
        const allLibraries = new Map([...mountedLibraries, ...doc.libraries]),
          nativeLibrary = allLibraries.get('Ntve');
        withIsolatedNamingIndexes(() => {
          for (const lib of doc.libraries.values()) {
            const globals = new Set(globalVariables(lib).map((v) => v.id)),
              ctx = { library: lib, libId: lib.id, allLibraries, nativeLibrary };
            const mapped = (t) => [
              mapParameterTypeToGalaxy(t, lib, nativeLibrary, allLibraries),
              0,
            ];
            for (const el of Object.values(lib.elements)) {
              if (el.identifier !== undefined || !el.name || el.disabled) continue;
              let spellings = [],
                signature,
                prefix;
              if (el.type === 'Variable' && globals.has(el.id)) {
                spellings = globalVariableSpellings(lib.id, el);
                signature = [
                  'Variable',
                  [mapped(el.variableType)[0], el.isArray ? (el.arraySizes?.length ?? 1) : 0],
                ];
                prefix = `lib${lib.id}_gv_`;
              } else if (el.type === 'Trigger') {
                spellings = [triggerHandleName(lib.id, el)];
                signature = ['Variable', ['trigger', 0]];
                prefix = `lib${lib.id}_gt_`;
              } else if (
                el.type === 'FunctionDef' &&
                !el.flags?.includes('Native') &&
                !el.flags?.includes('NoScriptPrefix')
              ) {
                const params = (el.parameters ?? []).map((r) =>
                  resolveRefFull(r, lib, nativeLibrary, allLibraries),
                );
                if (params.some((p) => !p || p.isArray || p.arraySizes?.length)) continue;
                spellings = [toGalaxyFunctionName(el, ctx)];
                signature = [
                  'FunctionDef',
                  mapped(el.returnType ?? { type: 'void' }),
                  params.map((p) => mapped(p.paramType)),
                ];
                prefix = `lib${lib.id}_gf_`;
              } else continue;
              for (const spelling of spellings) {
                if (!spelling.startsWith(prefix) || !abi.matches(spelling, signature)) continue;
                const stem = spelling.slice(prefix.length);
                if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(stem)) continue;
                const key = lib.id + ':' + el.type + ':' + el.id,
                  list = callCandidates.get(key) ?? new Map();
                list.set(spelling, { spelling, stem, signature, locale: e.path, localeSha256 });
                callCandidates.set(key, list);
              }
            }
          }
        });
        withIsolatedNamingIndexes(() => {
          for (const lib of doc.libraries.values())
            for (const st of Object.values(lib.elements).filter((el) => el.type === 'Structure')) {
              const owner = structureTypeName(
                { type: 'Structure', library: lib.id, id: st.id },
                lib,
                undefined,
                doc.libraries,
              );
              if (!owner) continue;
              for (const ref of st.variables ?? []) {
                if ((ref.library ?? lib.id) !== lib.id) continue;
                const member = resolveRefFull(ref, lib, undefined, doc.libraries);
                if (!member || member.identifier !== undefined || member.disabled) continue;
                const spelling = memberVarName(member, lib.id),
                  type = mapParameterTypeToGalaxy(
                    member.variableType,
                    lib,
                    undefined,
                    doc.libraries,
                  ),
                  dimensions = member.isArray ? (member.arraySizes?.length ?? 1) : 0;
                if (
                  !spelling.startsWith('lv_') ||
                  !structAbi.matches(owner, spelling, type, dimensions)
                )
                  continue;
                const key = lib.id + ':' + st.id + ':' + member.id,
                  list = memberCandidates.get(key) ?? new Map();
                list.set(spelling, {
                  owner,
                  spelling,
                  stem: spelling.slice(3),
                  type,
                  dimensions,
                  locale: e.path,
                  localeSha256,
                });
                memberCandidates.set(key, list);
              }
            }
        });
      }
      facts.push({ index, sourceHash, mod, variableCandidates, callCandidates, memberCandidates });
    } finally {
      mpq.dispose();
    }
  }
  // Keep the original global phase ordering, including two mods exposing the
  // same source document. Only final candidate facts cross these phases.
  for (const fact of facts) {
    const { mod } = fact;
    if (fact.invalidDocument) {
      variableRefused.push({ mod: mod.destination, reason: 'EXACT_TRIGGER_DOCUMENT_NOT_UNIQUE' });
      continue;
    }
    const { index, sourceHash, variableCandidates } = fact;
    let view = documents[index].triggerData,
      strings = documents[index].triggerStrings ?? '';
    const variablePrimary = await parse(view, strings, 'primaryDocumentParses');
    for (const library of variablePrimary.libraries.values())
      for (const variable of globalVariables(library)) {
        const choices = variableCandidates.get(library.id + ':' + variable.id);
        if (!choices || choices.size !== 1 || variable.identifier !== undefined) continue;
        const chosen = [...choices.values()][0];
        if (globalVariableSpellings(library.id, variable).includes(chosen.spelling)) continue;
        const prefix = `lib${library.id}_gv_`;
        if (!chosen.spelling.startsWith(prefix)) continue;
        const stem = chosen.spelling.slice(prefix.length);
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(stem)) continue;
        const regex = new RegExp(
            `<Element\\b(?=[^>]*\\bType="Variable")(?=[^>]*\\bId="${variable.id}")[^>]*>[\\s\\S]*?<\\/Element>`,
            'gu',
          ),
          blocks = [...view.matchAll(regex)];
        if (blocks.length !== 1 || /<Identifier(?:\s|>)/u.test(blocks[0][0])) {
          variableRefused.push({
            library: library.id,
            id: variable.id,
            reason: 'IDENTIFIER_OR_ELEMENT_AMBIGUOUS',
          });
          continue;
        }
        view = view.replace(regex, (block) =>
          block.replace('</Element>', `<Identifier>${stem}</Identifier>\n</Element>`),
        );
        variableChanges.push({
          library: library.id,
          variable: variable.id,
          displayName: variable.name,
          exactDeclaredSymbol: chosen.spelling,
          sourceModSha256: mod.destinationSha256,
          sourceTriggerDataSha256: sourceHash,
          ...chosen,
          metadataViewOnly: true,
        });
      }
    out[index].triggerData = view;
  }
  for (const fact of facts) {
    const { mod } = fact;
    if (fact.invalidDocument) {
      callRefused.push({ mod: mod.destination, reason: 'EXACT_TRIGGER_DOCUMENT_NOT_UNIQUE' });
      continue;
    }
    const { index, sourceHash, callCandidates } = fact;
    let view = out[index].triggerData,
      strings = out[index].triggerStrings ?? '';
    const callPrimary = await parse(view, strings, 'primaryDocumentParses');
    for (const lib of callPrimary.libraries.values())
      for (const el of Object.values(lib.elements)) {
        const choices = callCandidates.get(lib.id + ':' + el.type + ':' + el.id);
        if (!choices || el.identifier !== undefined) continue;
        if (choices.size !== 1) {
          callRefused.push({ library: lib.id, id: el.id, reason: 'AMBIGUOUS_DECLARED_LOCALE_ABI' });
          continue;
        }
        const chosen = [...choices.values()][0];
        const currentNames = withIsolatedNamingIndexes(() => {
          if (el.type === 'Variable') return globalVariableSpellings(lib.id, el);
          if (el.type === 'Trigger') return [triggerHandleName(lib.id, el)];
          return [
            toGalaxyFunctionName(el, {
              library: lib,
              libId: lib.id,
              allLibraries: new Map([...mountedLibraries, ...callPrimary.libraries]),
              nativeLibrary: mountedLibraries.get('Ntve'),
            }),
          ];
        });
        if (currentNames.includes(chosen.spelling)) continue;
        const patched = patchUniqueIdentifier(view, {
          type: el.type,
          id: el.id,
          stem: chosen.stem,
        });
        if (patched === null) {
          callRefused.push({
            library: lib.id,
            id: el.id,
            reason: 'IDENTIFIER_OR_ELEMENT_AMBIGUOUS',
          });
          continue;
        }
        view = patched;
        callChanges.push({
          library: lib.id,
          id: el.id,
          elementType: el.type,
          displayName: el.name,
          exactDeclaredSymbol: chosen.spelling,
          sourceModSha256: mod.destinationSha256,
          sourceTriggerDataSha256: sourceHash,
          ...chosen,
          metadataViewOnly: true,
          sameElementIdAcrossLocales: true,
          exactLoweredSignature: true,
        });
      }
    out[index].triggerData = view;
  }
  for (const fact of facts) {
    if (fact.invalidDocument) continue;
    const { index, sourceHash, mod, memberCandidates } = fact;
    let view = out[index].triggerData,
      strings = out[index].triggerStrings ?? '';
    const memberPrimary = await parse(view, strings, 'primaryDocumentParses');
    for (const lib of memberPrimary.libraries.values())
      for (const st of Object.values(lib.elements).filter((el) => el.type === 'Structure'))
        for (const ref of st.variables ?? []) {
          const member = resolveRefFull(ref, lib, undefined, memberPrimary.libraries),
            choices = memberCandidates.get(lib.id + ':' + st.id + ':' + ref.id);
          if (!member || member.identifier !== undefined || !choices) continue;
          if (choices.size !== 1) {
            memberRefused.push({
              library: lib.id,
              id: member.id,
              reason: 'AMBIGUOUS_STRUCT_MEMBER_LOCALE_ABI',
            });
            continue;
          }
          const chosen = [...choices.values()][0];
          if (memberVarName(member, lib.id) === chosen.spelling) continue;
          const patchedXml = patchUniqueIdentifier(view, {
              type: 'Variable',
              id: member.id,
              stem: chosen.stem,
            }),
            patchedStrings = patchMemberDisplayName(strings, {
              library: lib.id,
              id: member.id,
              stem: chosen.stem,
            });
          if (patchedXml === null || patchedStrings === null) {
            memberRefused.push({
              library: lib.id,
              id: member.id,
              reason: 'MEMBER_METADATA_PATCH_AMBIGUOUS',
            });
            continue;
          }
          view = patchedXml;
          strings = patchedStrings;
          memberChanges.push({
            library: lib.id,
            id: member.id,
            structure: st.id,
            elementType: 'StructureMember',
            displayName: member.name,
            exactDeclaredSymbol: chosen.owner + '.' + chosen.spelling,
            sourceModSha256: mod.destinationSha256,
            sourceTriggerDataSha256: sourceHash,
            ...chosen,
            sameElementIdAcrossLocales: true,
            exactCompiledOwnerFieldType: true,
            metadataViewOnly: true,
          });
        }
    out[index].triggerData = view;
    out[index].triggerStrings = strings;
  }
  return {
    documents: out,
    proof: {
      changes: [...variableChanges, ...callChanges, ...memberChanges],
      refused: [...variableRefused, ...callRefused, ...memberRefused],
      sourceDependenciesModified: false,
      sourceGalaxyModified: false,
      scope:
        'Same-mod locale IDs and compiled function/global/trigger/structure-member ABI; metadata views only; no Native/raw synthesis',
    },
    work,
  };
}
