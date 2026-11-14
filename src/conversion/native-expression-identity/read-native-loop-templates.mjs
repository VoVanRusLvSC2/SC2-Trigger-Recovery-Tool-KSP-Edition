import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { readAuthoredTriggerDocument } from '../../utilities/read-authored-trigger-document.mjs';
import { deriveNativeLoopTemplatePreserver } from '../exact-function-signatures/native-loop-template-shapes.mjs';
import { templateMacros } from './balanced-script-template-alternate.mjs';
export async function readNativeTemplateLoopPreserver(prepared, sdk) {
  const inputs = prepared.dependencyInputs.filter((d) => d.group === 'NativeLib');
  assert.equal(inputs.length, 1, 'NATIVE_TEMPLATE_OWNER_AMBIGUOUS');
  const input = inputs[0].triggerData,
    b = await readFile(input.path),
    sha256 = createHash('sha256').update(b).digest('hex');
  assert.equal(sha256, input.sha256, 'NATIVE_TEMPLATE_INPUT_CHANGED');
  const { document } = await readAuthoredTriggerDocument(b.toString('utf8'), sdk);
  assert.equal(document.libraries.size, 1);
  const library = document.libraries.get('Ntve');
  assert(library);
  const result = deriveNativeLoopTemplatePreserver(library, { macros: templateMacros });
  result.proof.input = { path: input.path, sha256 };
  return result;
}
