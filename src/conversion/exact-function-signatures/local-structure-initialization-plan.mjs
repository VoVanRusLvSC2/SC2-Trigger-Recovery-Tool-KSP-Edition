// A source prologue and GUI member defaults describe one initialization, not
// two runtime stores. Consume only a complete, ordered and passive match.
import {createHash} from 'node:crypto';
import {immutableGlobalConstantReads} from "./immutable-constant-reads.mjs";
import {expressionGroupingShape} from "./expression-grouping-proof.typedef-terminators.mjs";
import {SyntaxKind as K} from "./index-alternate-3.js";
const sha = value => createHash('sha256').update(value).digest('hex');
const shape = node => JSON.stringify(expressionGroupingShape(node));
const un = node => {while (node?.kind === K.ParenthesizedExpression) node = node.expression;return node;};
const scalar = node => node?.kind >= K.BoolKeyword && node.kind <= K.WavetargetKeyword && node.kind !== K.VoidKeyword;
const literal = node => [K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(un(node)?.kind);
function path(node) {
  node = un(node);
  if (node?.kind === K.Identifier) return [node.name];
  if (node?.kind === K.PropertyAccessExpression) {const prefix = path(node.expression);return prefix && [...prefix,node.name.name];}
}

export function createLocalStructureInitializationPlan({elements, libraryId, structuresByName,
  memberByKey, memberKey, defaults, topLevelStatements, typeName}) {
  const records = [], refused = [], declarations = new Map();
  for (const node of topLevelStatements) if (node.name?.name) {
    const rows = declarations.get(node.name.name) ?? [];rows.push(node);declarations.set(node.name.name, rows);
  }
  const constants = immutableGlobalConstantReads({statements:topLevelStatements});
  function fields(name, prefix, shadowed, active = new Set()) {
    const rows = declarations.get(name), declaration = rows?.length === 1 && rows[0], ref = structuresByName.get(name);
    if (declaration?.kind !== K.StructDeclaration || !ref || (ref.library ?? libraryId) !== libraryId || active.has(ref.id)) return;
    const structure = elements[ref.id];if (structure?.type !== 'Structure') return;
    const next = new Set(active);next.add(ref.id);const result = [], memberOrder = [];
    for (const field of declaration.members) {
      const memberRef = memberByKey.get(memberKey(ref.id, field.name.name, libraryId)) ?? memberByKey.get(memberKey(ref.id, field.name.name));
      if (!memberRef || (memberRef.library ?? libraryId) !== libraryId) return;
      memberOrder.push(memberRef.id);
      const member = elements[memberRef.id];if (member?.type !== 'Variable' || member.isArray || field.type.kind === K.ArrayType) return;
      if (member.initialValue) {
        const value = defaults.get(memberRef.id);
        if (!value || !constants.isIndependent(value, shadowed)) return;
        result.push({path:[...prefix,field.name.name], member:{library:libraryId,type:'Variable',id:memberRef.id}, value, valueShape:shape(value)});
      }
      if (member.variableType?.type === 'struct') {
        const nested = fields(typeName(field.type), [...prefix,field.name.name], shadowed, next);
        if (!nested) return;result.push(...nested);
      }
    }
    if (JSON.stringify(memberOrder) !== JSON.stringify((structure.variables ?? []).map(member => member.id))) return;
    return result;
  }
  function project(fn) {
    if (!fn.body || !defaults.size) return fn;
    const statements = Array.from(fn.body.statements), locals = [];
    for (const node of statements) {if (node.kind !== K.VariableDeclaration) break;locals.push(node);}
    const names = [...locals, ...fn.parameters].map(node => node.name.name), shadowed = new Set(names);
    if (shadowed.size !== names.length) return fn;
    const primitive = new Set([...locals, ...fn.parameters].filter(node => scalar(node.type)).map(node => node.name.name));
    const writable = new Set(locals.filter(node => scalar(node.type) && !node.modifiers?.length).map(node => node.name.name));
    const passive = node => {
      node = un(node);
      return literal(node) || node?.kind === K.Identifier && primitive.has(node.name) || constants.isIndependent(node,shadowed);
    };
    // No initializer with effects may cross the GUI's automatic field stores.
    if (locals.some(node => node.modifiers?.some(modifier => modifier.kind !== K.ConstKeyword) || node.initializer && !passive(node.initializer))) return fn;
    const expected = [];
    for (const node of locals) {
      if (!structuresByName.has(typeName(node.type))) continue;
      const values = fields(typeName(node.type), [node.name.name], shadowed);
      if (!values) return fn;expected.push(...values);
    }
    if (!expected.length) return fn;
    let cursor = 0;const consumed = new Set(), commutingCopies = [];
    for (const statement of statements.slice(locals.length)) {
      const assignment = statement.kind === K.ExpressionStatement && un(statement.expression);
      if (assignment?.kind !== K.BinaryExpression || assignment.operatorToken.kind !== K.EqualsToken) break;
      const target = path(assignment.left), next = expected[cursor];
      if (target && JSON.stringify(target) === JSON.stringify(next.path) && shape(assignment.right) === next.valueShape) {
        consumed.add(statement);cursor++;
        if (cursor === expected.length) break;
      } else if (un(assignment.left)?.kind === K.Identifier && writable.has(un(assignment.left).name) && passive(assignment.right)) {
        commutingCopies.push({start:statement.pos,end:statement.end,shapeSha256:sha(shape(statement))});
      } else break;
    }
    if (cursor !== expected.length) {
      refused.push({function:fn.name.name,reason:'INCOMPLETE_OR_DIFFERENT_ORDERED_MEMBER_PROLOGUE',matched:cursor,expected:expected.length});return fn;
    }
    records.push({function:fn.name.name, sourceFunctionShapeSha256:sha(shape(fn)),
      sourceStores:[...consumed].map(node => ({start:node.pos,end:node.end,shapeSha256:sha(shape(node))})),
      guiMemberDefaults:expected.map(({value,valueShape,...item}) => ({...item,valueShapeSha256:sha(valueShape)})),
      commutingCopies, allExpectedDefaultsMatchedInOrder:true, onlyPassiveCopiesCrossed:true,
      laterResetActionsRetained:true,newNative:0,newCustomScript:0,newRuntimeFunctions:0});
    return {...fn,body:{...fn.body,statements:statements.filter(node => !consumed.has(node))}};
  }
  return {project, records, refused};
}
