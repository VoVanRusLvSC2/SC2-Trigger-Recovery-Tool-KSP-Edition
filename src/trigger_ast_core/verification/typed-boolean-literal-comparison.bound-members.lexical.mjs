import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const unwrap = node => { while (node?.kind === K.ParenthesizedExpression) node = node.expression;return node; };
const literal = node => [K.TrueKeyword, K.FalseKeyword].includes(unwrap(node)?.kind);
const comparison = new Set([K.EqualsEqualsToken, K.ExclamationEqualsToken]);
const booleanOperators = new Set([...comparison, K.LessThanToken, K.LessThanEqualsToken,
  K.GreaterThanToken, K.GreaterThanEqualsToken, K.AmpersandAmpersandToken, K.BarBarToken]);

// Boolean results, never numeric truthiness. Removing comparison with a literal
// evaluates the original operand once and keeps its entire short-circuit tree.
export function canonicalTypedBooleanLiteralComparisons(text) {
  const input = {fileName: 'typed-boolean.galaxy', sourceId: 'typed-boolean', text, owned: true, contentSha256: sha(text)};
  const program = new GalaxyProgramContext([input], {files: [input], dependencies: []}, sha, {checks: 'binding'});
  try {
    const ast = program.documents.get(input.fileName);program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length, 0);
    const render = new WeakMap(), edits = [], refused = [], stack = [{node: ast, done: false}];
    const owners = new Map();for (const declaration of ast.statements) if (declaration.name?.name) {const rows=owners.get(declaration.name.name)??[];rows.push(declaration);owners.set(declaration.name.name,rows);}
    function booleanType(node) {
      if (literal(node)) return {kind: 'BOOLEAN_LITERAL'};
      if (node.kind === K.BinaryExpression && booleanOperators.has(node.operatorToken?.kind)) return {kind: 'BUILTIN_BOOLEAN_OPERATOR', operator: node.operatorToken.kind};
      if (node.kind === K.PrefixUnaryExpression && node.operator?.kind === K.ExclamationToken) return {kind: 'BUILTIN_BOOLEAN_NEGATION'};
      if (node.kind === K.PropertyAccessExpression) {
        const binding=program.getBinding(node), declaration=program.declarationAt(node), owner=declaration?.parent;
        const rows=owners.get(owner?.name?.name)??[], location=declaration&&program.location(declaration);
        const receiver=program.carrierAt(node.expression);
        if(binding.status==='BOUND'&&declaration?.kind===K.PropertyDeclaration&&declaration.type?.kind===K.BoolKeyword&&
          owner?.kind===K.StructDeclaration&&owner.members.includes(declaration)&&rows.length===1&&rows[0].kind===K.StructDeclaration&&
          rows[0].pos===owner.pos&&rows[0].end===owner.end&&
          (receiver===owner.name.name||receiver===`structref<${owner.name.name}>`)&&
          location?.contentSha256===input.contentSha256&&program.verifiedInputIdentity(location.sourceFile)?.contentSha256===input.contentSha256)
          return {kind:'BOUND_BOOLEAN_STRUCTURE_MEMBER',symbolId:binding.symbolId,source:location,
            owner:{name:owner.name.name,start:owner.pos,end:owner.end},receiverCarrier:receiver};
        return;
      }
      if (node.kind !== K.Identifier) return;
      const binding = program.getBinding(node), declaration = program.declarationAt(node);
      if (binding.status === 'BOUND' && declaration && [K.VariableDeclaration, K.ParameterDeclaration].includes(declaration.kind) && declaration.type?.kind === K.BoolKeyword)
        return {kind: 'BOUND_SCALAR_BOOLEAN', symbolId: binding.symbolId, declarationPosition: declaration.pos};
    }
    while (stack.length) {
      const {node, done} = stack.pop(), children = [];forEachChild(node, child => {children.push(child);});
      if (!done) { stack.push({node, done: true});for (const child of children) stack.push({node: child, done: false});continue; }
      const changed = children.filter(child => render.has(child)).sort((a, b) => a.pos - b.pos);
      let value = text.slice(node.pos, node.end);
      for (let i = 1; i < changed.length; i++) assert(changed[i - 1].end <= changed[i].pos, 'BOOLEAN_CHILD_OVERLAP');
      for (const child of changed.toReversed()) value = value.slice(0, child.pos - node.pos) + render.get(child) + value.slice(child.end - node.pos);
      if (node.kind === K.BinaryExpression && comparison.has(node.operatorToken?.kind)) {
        const constant = literal(node.right) ? unwrap(node.right) : literal(node.left) ? unwrap(node.left) : undefined;
        const operand = constant && unwrap(literal(node.right) ? node.left : node.right), type = operand && booleanType(operand);
        if (constant && type) {
          const spelling = render.get(operand) ?? text.slice(operand.pos, operand.end);
          const positive = (constant.kind === K.TrueKeyword) === (node.operatorToken.kind === K.EqualsEqualsToken);
          value = positive ? `(${spelling})` : `(!(${spelling}))`;
          edits.push({start: node.pos, end: node.end, type, positive, operandEvaluations: 1, operandOrderAndShortCircuitUnchanged: true});
        } else if (constant) refused.push({start: node.pos, reason: 'BOOLEAN_RESULT_NOT_PROVED'});
      }
      if (value !== text.slice(node.pos, node.end)) render.set(node, value);
    }
    const result = render.get(ast) ?? text;assert.equal(parse(result, 'typed-boolean-result').parseDiagnostics.length, 0);
    return {text: result, proof: {kind: 'BOUND_TYPED_BOOLEAN_RESULTS_AND_STRUCTURE_MEMBERS', sourceSha256: sha(text), proofInputSha256: sha(result), edits, refused,
      standaloneCallsExcluded: true, onlyBoundBooleanStructureMembersAllowed: true, numericTruthinessAllowed: false, operandEvaluationCountUnchanged: true,
      sourceOrExportChanged: false, rawOracleReplaced: false, wholeMapAccepted: false}};
  } finally { program.dispose(); }
}
