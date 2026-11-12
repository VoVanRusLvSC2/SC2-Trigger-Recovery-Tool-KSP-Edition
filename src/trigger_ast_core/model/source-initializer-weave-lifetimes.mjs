import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {planSourceInitializerWeave} from '../lowering/source-initializer-weave.mjs';
import {indexSourceFunctionDeclarations, canonicalSourceFunctionDeclaration} from './source-function-declarations.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {proveClosedProtocolNameAbsence} from '../analysis/protocol-name-flow.projected-string-types.mjs';
import {SyntaxKind as K, Printer, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const plans = new WeakMap(), printer = new Printer();
const sha = text => createHash('sha256').update(text).digest('hex');
const unwrap = node => { while (node?.kind === K.ParenthesizedExpression) node = node.expression; return node; };
const printableHash = node => sha(printer.printNode(node));

// Moving a tail into a constructor changes that helper's call frame. This
// capability is limited to private, directly called source helpers. It neither
// establishes native callback ABI nor replaces the complete program comparison.
export function proveSourceInitializerWeaveLifetimes({program, fileName, phaseName, automaticNames}) {
  const {proof: phase} = planSourceInitializerWeave({program, fileName, phaseName, automaticNames});
  assert.equal(phase.prefix.length, 0, 'INITIALIZER_WEAVE_PREFIX_TRANSFER_UNPROVED');
  const index = indexSourceFunctionDeclarations(program.documents);
  const phaseNode = index.get(phaseName)?.body?.node;
  const changed = phase.slots.filter(slot => slot.calls.length).map(slot => {
    const group = index.get(slot.automaticName);
    assert.equal(group?.status, 'UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES', 'INITIALIZER_WEAVE_CONSTRUCTOR_NOT_UNIQUE');
    const node = group.body.node;
    assert(node.parameters.length === 0 && node.type.kind === K.VoidKeyword && !node.modifiers?.length,
      'INITIALIZER_WEAVE_CONSTRUCTOR_ABI_UNPROVED');
    return {name: slot.automaticName, node, source: program.location(node), originalAstSha256: printableHash(node),
      directCalls: [], manualCalls: slot.calls};
  });
  const names = new Map(changed.map(row => [row.name, row]));
  const inputFiles = [];
  for (const [sourceFile, ast] of program.documents) {
    const input = program.verifiedInputIdentity(sourceFile);
    assert(input?.contentSha256 === sha(ast.text), 'INITIALIZER_WEAVE_UNVERIFIED_SOURCE');
    inputFiles.push({sourceFile, sha256: input.contentSha256});
    const visit = (node, owner) => {
      if (node.kind === K.FunctionDeclaration) owner = node;
      if (node.kind === K.StringLiteral && changed.length) {
        const text = readStringLiteralValue(node.text);
        assert(text, 'INITIALIZER_WEAVE_CALLBACK_LITERAL_UNREADABLE');
        for (const name of names.keys()) assert(!text.value.includes(name), 'INITIALIZER_WEAVE_NAMED_OBSERVER:' + name);
      }
      if (node.kind === K.Identifier && names.has(node.name) && !(node.parent?.kind === K.FunctionDeclaration && node.parent.name === node)) {
        const record = names.get(node.name), binding = program.getBinding(node);
        assert(binding.status === 'BOUND', 'INITIALIZER_WEAVE_REFERENCE_BINDING_UNPROVED:' + node.name);
        if (canonicalSourceFunctionDeclaration(index, program.declarationAt(node)) === record.node) {
          let parent = node.parent;
          while (parent?.kind === K.ParenthesizedExpression) parent = parent.parent;
          assert(parent?.kind === K.CallExpression && unwrap(parent.expression) === node && parent.arguments.length === 0,
            'INITIALIZER_WEAVE_ESCAPING_FUNCTION_REFERENCE:' + node.name);
          assert(owner === phaseNode, 'INITIALIZER_WEAVE_CONSTRUCTOR_HAS_OTHER_CALLER:' + node.name);
          record.directCalls.push(program.location(parent));
        }
      }
      forEachChild(node, child => visit(child, owner));
    };
    visit(ast);
  }
  for (const record of changed) assert.equal(record.directCalls.length, 1, 'INITIALIZER_WEAVE_CONSTRUCTOR_CALL_MULTIPLICITY:' + record.name);
  // One direct caller does not make a function private: a string supplied by
  // chat or another runtime source may still reach a native name consumer.
  // Reuse the common closed-domain analysis; unknown dispatch must refuse the
  // placement, rather than relying on an unproved callback signature check.
  let protocolNames;
  try {
    protocolNames = proveClosedProtocolNameAbsence([...program.documents.values()], [phaseName, ...names.keys()]);
  } catch (error) {
    throw new Error('INITIALIZER_WEAVE_PROTOCOL_OBSERVER_UNPROVED: ' + error.message, {cause: error});
  }
  const proof = {kind: 'BOUND_SOURCE_INITIALIZER_WEAVE_LIFETIMES', sourcePhaseSha256: phase.sourceSha256,
    fileName, phaseName, automaticNames: [...automaticNames], prefixCalls: 0, inputFiles,
    changedConstructors: changed.map(({node, ...row}) => row), sourcePhaseAstSha256: printableHash(phaseNode),
    protocolNames,
    boundary: 'Same-thread typed Galaxy source calls with closed native name consumers; private helper call-frame/debugger/profiler observations excluded. No signature-based exclusion of dynamic callback names is assumed.',
    sourceChanged: false, guiEmissionAuthorized: false, nativeDispatchAbiProved: false,
    wholePhaseAccepted: false, wholeMapAccepted: false};
  const capability = Object.freeze({kind: proof.kind, sourcePhaseSha256: proof.sourcePhaseSha256});
  plans.set(capability, {program, proof, phaseNode, changed});
  return {capability, proof};
}

export function readSourceInitializerWeaveLifetimes(capability, program) {
  const plan = plans.get(capability);
  assert(plan && plan.program === program && !program.closed, 'INITIALIZER_WEAVE_UNTRUSTED_LIFETIME_CAPABILITY');
  for (const file of plan.proof.inputFiles) {
    const ast = program.documents.get(file.sourceFile);
    assert(ast && sha(ast.text) === file.sha256, 'INITIALIZER_WEAVE_SOURCE_CHANGED');
  }
  assert.equal(printableHash(plan.phaseNode), plan.proof.sourcePhaseAstSha256, 'INITIALIZER_WEAVE_PHASE_AST_CHANGED');
  for (const row of plan.changed) assert.equal(printableHash(row.node), row.originalAstSha256, 'INITIALIZER_WEAVE_CONSTRUCTOR_AST_CHANGED');
  return structuredClone(plan.proof);
}
