import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
const unwrap=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
const negation=node=>node?.kind===K.PrefixUnaryExpression&&node.operator?.kind===K.ExclamationToken;
const booleanOperators=new Set([K.EqualsEqualsToken,K.ExclamationEqualsToken,K.LessThanToken,K.LessThanEqualsToken,
  K.GreaterThanToken,K.GreaterThanEqualsToken,K.AmpersandAmpersandToken,K.BarBarToken]);

// !!x equals x only when x already has Boolean type. In particular, !!integer
// is a conversion, and an unknown call cannot supply evidence of its return type.
export function canonicalTypedBooleanDoubleNegation(source) {
  const input={fileName:'double-negation.galaxy',text:source,contentSha256:sha(source),owned:true};
  const program=new GalaxyProgramContext([input],{files:[input],dependencies:[]},sha);
  try {
    const ast=program.documents.get(input.fileName);program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length,0);
    const render=new WeakMap(),edits=[],refused=[],stack=[{node:ast,done:false}];
    function booleanType(node) {
      if([K.TrueKeyword,K.FalseKeyword].includes(node.kind)||negation(node))return {kind:'BUILTIN_BOOLEAN'};
      if(node.kind===K.BinaryExpression&&booleanOperators.has(node.operatorToken?.kind))return {kind:'BOOLEAN_OPERATOR',operator:node.operatorToken.kind};
      if(node.kind!==K.Identifier)return;
      const binding=program.getBinding(node),declaration=program.declarationAt(node);
      if(binding.status==='BOUND'&&[K.VariableDeclaration,K.ParameterDeclaration].includes(declaration?.kind)&&declaration.type?.kind===K.BoolKeyword)
        return {kind:'BOUND_SCALAR_BOOLEAN',symbolId:binding.symbolId,declarationPosition:declaration.pos};
    }
    while(stack.length) {
      const {node,done}=stack.pop(),children=[];forEachChild(node,child=>{children.push(child);});
      if(!done){stack.push({node,done:true});for(const child of children)stack.push({node:child,done:false});continue;}
      let value=source.slice(node.pos,node.end);
      for(const child of children.filter(child=>render.has(child)).sort((a,b)=>b.pos-a.pos))
        value=value.slice(0,child.pos-node.pos)+render.get(child)+value.slice(child.end-node.pos);
      const inner=negation(node)&&unwrap(node.operand),operand=negation(inner)&&unwrap(inner.operand);
      if(operand) {
        const type=booleanType(operand);
        if(type) {
          value='('+(render.get(operand)??source.slice(operand.pos,operand.end))+')';
          edits.push({start:node.pos,end:node.end,before:source.slice(node.pos,node.end),replacement:value,type,
            operandEvaluations:1,operandOrderAndShortCircuitUnchanged:true});
        } else refused.push({start:node.pos,end:node.end,reason:'BOOLEAN_OPERAND_NOT_PROVED'});
      }
      if(value!==source.slice(node.pos,node.end))render.set(node,value);
    }
    const text=render.get(ast)??source,patches=[];
    for(const edit of [...edits].sort((a,b)=>a.start-b.start||b.end-a.end)) {
      if(patches.at(-1)?.end>edit.start){assert(patches.at(-1).end>=edit.end);continue;}
      patches.push(edit);
    }
    let replay=source,delta=0;const inverse=[];
    for(const edit of [...patches].reverse())replay=replay.slice(0,edit.start)+edit.replacement+replay.slice(edit.end);
    assert.equal(replay,text);
    for(const edit of patches){const start=edit.start+delta;inverse.push({start,end:start+edit.replacement.length,text:edit.before});delta+=edit.replacement.length-edit.before.length;}
    for(const edit of inverse.reverse())replay=replay.slice(0,edit.start)+edit.text+replay.slice(edit.end);
    assert.equal(replay,source,'DOUBLE_NEGATION_BYTE_INVERSE');
    return {text,proof:{kind:'TYPED_BOOLEAN_DOUBLE_NEGATION',sourceSha256:sha(source),proofInputSha256:sha(text),edits,refused,
      byteInverseVerified:true,numericTruthinessAllowed:false,standaloneCallsExcluded:true,sourceOrExportChanged:false,wholeMapAccepted:false}};
  } finally {program.dispose();}
}
