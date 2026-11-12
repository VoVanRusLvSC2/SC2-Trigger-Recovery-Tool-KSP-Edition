import {createFiniteFunctionReferenceTargets} from './finite-function-reference-targets.mjs';
import {SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';

// Conservative dispatch closure, not a code-removal pass. All owned functions
// are roots. External bodies enter through identifiers or literal callback names;
// ambiguous definitions enter together, so ambiguity cannot hide an observer.
export function closedSourceFunctionReachability(files, guiNativeContracts = new Map()) {
  const definitions = new Map(), native = new Set(), initializers = [], reachable = new Set(), pending = [], issues = [], globalStorage = new Set();
  for (const file of files) for (const node of file.ast.statements) if (node.kind === K.VariableDeclaration) globalStorage.add(node.name.name);
  for (const file of files) for (const node of file.ast.statements) if (node.kind === K.FunctionDeclaration && !node.body && node.modifiers?.length === 1 && node.modifiers[0].kind === K.NativeKeyword) native.add(node.name.name);
  for (const file of files) for (const node of file.ast.statements) if (node.kind === K.FunctionDeclaration && node.body) {
    const list = definitions.get(node.name.name) ?? [];list.push(node);definitions.set(node.name.name, list);
    if (file.owned) pending.push(node);
  }
  const enter = name => {for (const node of definitions.get(name) ?? []) if (!reachable.has(node)) pending.push(node);};
  let references,referenceContextFailure;
  const referenceCall=node=>{
    try{
      references??=createFiniteFunctionReferenceTargets(files.map(f=>({...f,fileName:f.fileName??f.ast.fileName,text:f.text??f.ast.text})));
      return references.resolve(node);
    }catch(error){referenceContextFailure=error.message;return {status:'UNPROVEN',reason:'FUNCTION_REFERENCE_CONTEXT_REFUSED'};}
  };
  const issueSites=[];
  const scan = (root, owner) => {
    const locals = new Set(owner?.parameters?.map(node => node.name.name) ?? []), nodes = [root];
    // A callable local/formal could hide a function reference. Refuse that
    // dispatch instead of assuming a global body with the same spelling.
    if (owner) {
      const declarations = [root];
      while (declarations.length) {const node = declarations.pop();if (node.kind === K.VariableDeclaration) locals.add(node.name.name);forEachChild(node, child => {declarations.push(child);});}
    }
    while (nodes.length) {
      const node = nodes.pop();
      if (node.kind === K.Identifier) enter(node.name);
      if (node.kind === K.StringLiteral) {
        const value = readStringLiteralValue(node.text);
        if (!value) issues.push('UNREADABLE_CALLBACK_LITERAL');else enter(value.value);
      }
      if (node.kind === K.CallExpression && (node.expression.kind !== K.Identifier || locals.has(node.expression.name) || globalStorage.has(node.expression.name) || !definitions.has(node.expression.name) && !native.has(node.expression.name) && guiNativeContracts.get(node.expression.name)?.parameters.length !== node.arguments.length)) {
        const reference=referenceCall(node);
        if(reference.status==='CLOSED_FINITE_REFERENCE')for(const target of reference.targets)enter(target.name);
        else {issues.push('INDIRECT_OR_SHADOWED_CALL_TARGET');issueSites.push({owner:owner?.name?.name,start:node.pos,end:node.end,target:node.expression?.name,reason:reference.reason});}
      }
      forEachChild(node, child => {nodes.push(child);});
    }
  };
  // Initializers in every loaded unit can execute without an ordinary caller.
  for (const file of files) for (const node of file.ast.statements) if (node.kind !== K.FunctionDeclaration) {initializers.push(node);scan(node);}
  while (pending.length) {
    const node = pending.pop();if (reachable.has(node)) continue;
    reachable.add(node);scan(node.body, node);
  }
  const functionReferences=references?.report();references?.dispose();
  return {reachable, initializers, issues: [...new Set(issues)],issueSites,functionReferences,referenceContextFailure,ambiguousBodiesOverapproximated: true, sourceChanged: false};
}
