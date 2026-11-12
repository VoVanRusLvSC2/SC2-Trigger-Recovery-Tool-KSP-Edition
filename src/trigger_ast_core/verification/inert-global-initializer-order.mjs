// Proof view only. Commute closed literal global stores through definitions,
// never through an include, type declaration, aggregate or observable initializer.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {assertExactAstShape} from './exact-ast-shape.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = s => createHash('sha256').update(s).digest('hex');
const ignored = new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode','id','comments','__sourceText','hasReturn']);
const intrinsic = n => n.type?.kind >= K.BoolKeyword && n.type.kind <= K.WavetargetKeyword && n.type.kind !== K.VoidKeyword;
function literal(n) {
  if (!n) return true;
  if ([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n.kind)) return true;
  if (n.kind === K.ParenthesizedExpression) return literal(n.expression);
  return n.kind === K.PrefixUnaryExpression && [K.PlusToken,K.MinusToken].includes(n.operator?.kind) && n.operand?.kind === K.NumericLiteral;
}
export function canonicalInertGlobalInitializerOrder(text) {
  const ast = parseImmutableGalaxySyntax(text,'global-order-input.galaxy');assert.equal(ast.parseDiagnostics.length,0);
  const globals = ast.statements.filter(n => n.kind === K.VariableDeclaration), names = globals.map(n => n.name.name);
  assert.equal(new Set(names).size,names.length,'GLOBAL_ORDER_DUPLICATE_STORAGE');
  assert(!ast.statements.some(n => n.kind !== K.VariableDeclaration && n.name && names.includes(n.name.name)),'GLOBAL_ORDER_SYMBOL_COLLISION');
  const edits = [], records = [];let segment = [];
  function flush() {
    if (segment.length > 1) {
      const sorted = [...segment].sort((a,b) => a.node.name.name.localeCompare(b.node.name.name));
      if (sorted.some((r,i) => r !== segment[i])) {
        for (let i=0;i<segment.length;i++) edits.push({start:segment[i].node.pos,end:segment[i].node.end,
          before:text.slice(segment[i].node.pos,segment[i].node.end),replacement:text.slice(sorted[i].node.pos,sorted[i].node.end)});
        records.push({positions:segment.map(r=>r.index),original:segment.map(r=>r.node.name.name),canonical:sorted.map(r=>r.node.name.name),
          closedLiteralStoresOnly:true,definitionsHaveNoInitializationEffect:true,includesAndUnknownEffectsAreBarriers:true});
      }
    }
    segment=[];
  }
  for (const [index,node] of ast.statements.entries()) {
    if ([K.FunctionDeclaration,K.EmptyStatement].includes(node.kind)) continue;
    if (node.kind === K.VariableDeclaration && intrinsic(node) && (node.modifiers??[]).every(m=>m.kind===K.ConstKeyword) && literal(node.initializer)) {
      if (node.initializer) segment.push({node,index});continue;
    }
    flush();
  }
  flush();edits.sort((a,b)=>a.start-b.start);
  for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start);
  let result=text;for(const edit of [...edits].reverse()) {
    assert.equal(result.slice(edit.start,edit.end),edit.before);result=result.slice(0,edit.start)+edit.replacement+result.slice(edit.end);
  }
  const after=parseImmutableGalaxySyntax(result,'global-order-output.galaxy');assert.equal(after.parseDiagnostics.length,0);
  const restored=[...after.statements];
  for(const record of records) {
    const actual=record.positions.map(i=>after.statements[i]);assert.deepEqual(actual.map(n=>n.name.name),record.canonical);
    const byName=new Map(actual.map(n=>[n.name.name,n]));
    for(let i=0;i<record.positions.length;i++)restored[record.positions[i]]=byName.get(record.original[i]);
  }
  const inverse=assertExactAstShape(restored,ast.statements,{ignoredFields:ignored,label:'GLOBAL_ORDER_OTHER_AST_CHANGED'});
  return{text:result,proof:{kind:'INERT_INTRINSIC_LITERAL_GLOBAL_INITIALIZER_PERMUTATION',sourceSha256:sha(text),proofInputSha256:sha(result),records,edits,inverse,
    declarationsRemoved:0,initializersRemoved:0,initializationEffectsReordered:false,sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false}};
}
