// Source binding and SDK ABI identity are facts, not permission to emit a
// Native/CustomScript element, move an operation, or assume its effect is pure.
import {SyntaxKind as K, Printer} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {stockGuiNativeContracts} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/7b411dd1ce3e-6692a1d100ab-728e91a8eae8-stock-gui-native-contracts.bound-owner.mjs';
const printer = new Printer();
const abi = node => ({returnType: printer.printNode(node.type), parameters: node.parameters.map(p => printer.printNode(p.type))});
const same = (a, b) => a.returnType === b.returnType && JSON.stringify(a.parameters) === JSON.stringify(b.parameters);
const un = node => {while (node?.kind === K.ParenthesizedExpression) node = node.expression;return node;};

export function createSourceNativeApiFacts(program, libraries) {
  const declarations = new Map(), catalogs = new Map(), records = new Map();let active = true;
  for (const [fileName, ast] of program.documents) {
    const input = program.verifiedInputIdentity(fileName);
    if (!input?.contentSha256) throw Error('NATIVE_API_VERIFIED_SOURCE_REQUIRED');
    program.attachOriginal(ast);
    for (const node of ast.statements) if (node.name?.name) {
      const list = declarations.get(node.name.name) ?? [];
      list.push({node, fileName, contentSha256: input.contentSha256, owned: input.owned});
      declarations.set(node.name.name, list);
    }
  }
  function declaration(call, nativeLibraryId) {
    const callee = un(call?.expression);
    if (call?.kind !== K.CallExpression || callee?.kind !== K.Identifier || program.closed || !active) return;
    // Resolve the declaration through the binder; no expression carrier is
    // needed to check a source ABI, especially for ordinary user-function calls.
    const target = program.declarationAt(callee);
    if (target?.kind !== K.FunctionDeclaration || target.body) return;
    const rows = declarations.get(callee.name) ?? [];
    // Inspect every active declaration, not whichever prototype the binder
    // happened to retain as valueDeclaration.
    if (!rows.length || !rows.some(row => row.node === target) || rows.some(({node}) =>
      node.kind !== K.FunctionDeclaration || node.body || node.parameters.some(p => p.isReference) ||
      node.modifiers?.some(m => m.kind !== K.NativeKeyword))) return;
    const signature = abi(target);
    if (signature.parameters.length !== call.arguments.length || rows.some(row => !same(abi(row.node), signature))) return;
    const explicit = rows.every(({node}) => node.modifiers?.length === 1 && node.modifiers[0].kind === K.NativeKeyword);
    let contract;
    if (!explicit) {
      if (!nativeLibraryId || !libraries.has(nativeLibraryId)) return;
      if (!catalogs.has(nativeLibraryId)) catalogs.set(nativeLibraryId, stockGuiNativeContracts(libraries, {nativeLibraryId}));
      contract = catalogs.get(nativeLibraryId).contracts.get(callee.name);
      if (!contract || contract.library !== nativeLibraryId || !same(signature, contract)) return;
    }
    const where = program.location(call), bound = program.location(target);
    if (!bound?.contentSha256 || program.verifiedInputIdentity(bound.sourceFile)?.contentSha256 !== bound.contentSha256) return;
    if (!where?.contentSha256 || program.verifiedInputIdentity(where.sourceFile)?.contentSha256 !== where.contentSha256) return;
    const proof = {kind: explicit ? 'BOUND_EXPLICIT_NATIVE_ABI' : 'BOUND_EXISTING_SDK_NATIVE_ABI',
      symbol: callee.name, declarationId: JSON.stringify([bound.sourceFile, bound.contentSha256, bound.start, bound.end]), boundDeclaration: bound, source: where, signature,
      declarations: rows.map(({node, ...source}) => ({...source, start: node.pos, end: node.end})),
      ...(contract ? {gui: contract} : {}), effectProved: false, engineAvailabilityProved: false,
      guiBindingAuthorized: false, sourceChanged: false, newNative: 0, newRuntimeFunction: 0};
    const key = JSON.stringify([proof.kind, proof.declarationId, nativeLibraryId]);
    const record = records.get(key) ?? {...proof, source: undefined, queries: 0, sites: []};
    record.queries++;
    if (record.sites.length < 8 && !record.sites.some(site => site.sourceFile === where.sourceFile && site.start === where.start)) record.sites.push(where);
    records.set(key, record);
    return {declaration: target, proof};
  }
  return Object.freeze({declaration, dispose() {active = false;declarations.clear();catalogs.clear();records.clear();},
    report: () => ({kind: 'SOURCE_BOUND_NATIVE_API_FACTS', records: [...records.values()],
      active, sourceChanged: false, newNative: 0, newCustomScript: 0, newRuntimeFunctions: 0, effectInferredFromAbi: false, sitesAreBoundedSamples: true})});
}
