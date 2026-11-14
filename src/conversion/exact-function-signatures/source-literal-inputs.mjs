// Read-only derived views for printable literal bytes. Validate original pins
// before deriving new identities; never overwrite a caller's source/snapshot.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { normalizePrintableSourceStrings } from '../../passes/printable-source-strings.shared-ast.mjs';
import { parseConversionGalaxySyntax } from './conversion-syntax-program.collections.mjs';
import { parseImmutableGalaxySyntax } from './immutable-galaxy-syntax.collections.mjs';

const sha = (text) => createHash('sha256').update(text).digest('hex');
export function printableLiteralSourceView(text, fileName) {
  assert.equal(typeof text, 'string');
  if (!text.includes('\\')) return { text, proof: { literalEdits: 0 } };
  const result = normalizePrintableSourceStrings(text, (value) =>
    parseConversionGalaxySyntax(value, fileName, () => parseImmutableGalaxySyntax(value, fileName)),
  );
  return result;
}

export function prepareSourceLiteralInputs(input) {
  const id = input.libraryId ?? 'Map',
    plans = [],
    records = [];
  function view(before, fileName, kind, field) {
    const normalized = printableLiteralSourceView(before, fileName);
    if (normalized.text !== before)
      plans.push({
        kind,
        fileName,
        before,
        after: normalized.text,
        field,
        proof: normalized.proof,
      });
    return normalized.text;
  }
  const script = view(input.script ?? '', `Lib${id}.galaxy`, 'FILE', 'script');
  const header = view(input.header ?? '', `Lib${id}_h.galaxy`, 'FILE', 'header');
  const offered = new Map();
  const additionalScripts = input.additionalScripts?.map((file) => {
    assert(!offered.has(file.fileName), 'DUPLICATE_LITERAL_SOURCE_FILE');
    const text = view(file.text, file.fileName, 'ADDITIONAL_SCRIPT', 'additionalScripts');
    offered.set(file.fileName, { before: file.text, after: text });
    return text === file.text ? file : { ...file, text };
  });
  // Keep the existing exact ownership rule for CustomAI companions. External
  // profiles/declarations are not transformed just because their basename matches.
  const customAiScripts = input.customAiScripts?.map((file) => {
    const name = file.fileName.split(/[\\/]/u).at(-1),
      linked = offered.get(name);
    if (!linked || linked.before !== file.text || linked.after === file.text) return file;
    plans.push({
      kind: 'CUSTOM_AI_SCRIPT',
      fileName: name,
      before: file.text,
      after: linked.after,
      field: 'customAiScripts',
      proof: { linkedToOwnedInclude: name },
    });
    return { ...file, text: linked.after };
  });
  if (!plans.length) return { input, records };
  const original = input.inputSnapshot;
  assert(
    original?.files && typeof input.hashText === 'function',
    'LITERAL_VIEW_REQUIRES_ORIGINAL_SNAPSHOT',
  );
  const snapshot = {
    ...original,
    files: original.files.map((p) => ({ ...p })),
    semanticMaterials: original.semanticMaterials?.map((p) => ({ ...p })),
    literalByteDerivations: [...(original.literalByteDerivations ?? [])],
  };
  const changedIncludes = new Map();
  function derive(pin, plan) {
    assert.equal(sha(plan.before), pin.contentSha256, 'ORIGINAL_LITERAL_SOURCE_SHA_MISMATCH');
    assert.equal(input.hashText(plan.before), pin.contentSha256, 'LITERAL_HASH_CONTRACT_MISMATCH');
    const digest = sha(plan.after),
      sourceId = `literal-bytes:${pin.sourceId ?? plan.fileName}:${digest}`;
    const record = {
      kind: 'PRINTABLE_LITERAL_BYTE_VIEW',
      role: plan.kind,
      fileName: plan.fileName,
      parentSourceId: pin.sourceId,
      parentContentSha256: pin.contentSha256,
      derivedSourceId: sourceId,
      derivedContentSha256: digest,
      owned: pin.owned,
      proof: plan.proof,
    };
    Object.assign(pin, { contentSha256: digest, sourceId });
    if (Object.hasOwn(pin, 'text')) pin.text = plan.after;
    records.push(record);
    snapshot.literalByteDerivations.push(record);
  }
  for (const plan of plans) {
    if (plan.kind === 'FILE') {
      const matches = snapshot.files.filter((p) => p.fileName === plan.fileName);
      assert.equal(matches.length, 1, 'AMBIGUOUS_LITERAL_SOURCE_IDENTITY');
      assert.equal(matches[0].owned, true, 'PRIMARY_LITERAL_SOURCE_NOT_OWNED');
      derive(matches[0], plan);
    } else {
      const matches =
        snapshot.semanticMaterials?.filter(
          (p) => p.kind === plan.kind && p.fileName === plan.fileName,
        ) ?? [];
      assert.equal(matches.length, 1, 'AMBIGUOUS_LITERAL_MATERIAL_IDENTITY');
      derive(matches[0], plan);
      if (plan.kind === 'ADDITIONAL_SCRIPT') {
        changedIncludes.set(plan.fileName, plan);
        // Some callers also offer this exact owned file as a declaration view.
        for (const pin of snapshot.files.filter((p) => p.fileName === plan.fileName))
          derive(pin, plan);
      }
    }
  }
  const galaxyDeclarations = input.galaxyDeclarations?.map((file) => {
    const plan = changedIncludes.get(file.fileName);
    if (!plan || file.text !== plan.before) return file;
    return { ...file, text: plan.after };
  });
  return {
    input: {
      ...input,
      script,
      header,
      ...(additionalScripts ? { additionalScripts } : {}),
      ...(customAiScripts ? { customAiScripts } : {}),
      ...(galaxyDeclarations ? { galaxyDeclarations } : {}),
      inputSnapshot: snapshot,
    },
    records,
  };
}
