// Comparison view only. Repeated passive address reads can be represented by
// one compound store; no call, arithmetic grouping or runtime source is changed.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {expressionGroupingShape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
const un=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
const same=(a,b)=>JSON.stringify(expressionGroupingShape(a))===JSON.stringify(expressionGroupingShape(b));
function walk(node,operation,parent){operation(node,parent);forEachChild(node,child=>walk(child,operation,node));}
export function canonicalPrivateStringArrayAppend(source){
  const ast=parse(source,'private-array-append');assert.equal(ast.parseDiagnostics.length,0);const edits=[],refused=[];
  for(const fn of ast.statements){
    if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
    const locals=[];for(const node of fn.body.statements){if(node.kind!==K.VariableDeclaration)break;locals.push(node);}
    const declarations=[...locals,...fn.parameters],byName=new Map(declarations.map(node=>[node.name.name,node]));
    if(byName.size!==declarations.length)continue;
    const arrays=new Map();
    for(const declaration of locals)if(declaration.type.kind===K.ArrayType&&declaration.type.elementType.kind===K.StringKeyword&&!declaration.modifiers?.length)
      arrays.set(declaration.name.name,{declaration,escaped:false});
    walk(fn.body,(node,parent)=>{
      if(node.kind!==K.Identifier||!arrays.has(node.name))return;
      const declaration=arrays.get(node.name).declaration;
      if(parent===declaration&&parent.name===node)return;
      if(parent?.kind!==K.ElementAccessExpression||parent.expression!==node)arrays.get(node.name).escaped=true;
    });
    const value=(node,kind)=>{
      node=un(node);if(node?.kind===K.Identifier){const declaration=byName.get(node.name);return declaration?.type.kind===kind&&!declaration.isReference;}
      return kind===K.StringKeyword&&node?.kind===K.StringLiteral||kind===K.IntKeyword&&node?.kind===K.NumericLiteral&&/^(?:0|[1-9][0-9]*)$/u.test(node.text??'');
    };
    walk(fn.body,node=>{
      if(node.kind!==K.BinaryExpression||node.operatorToken.kind!==K.EqualsToken)return;
      const left=un(node.left),right=un(node.right),array=left?.kind===K.ElementAccessExpression&&un(left.expression)?.kind===K.Identifier&&arrays.get(un(left.expression).name);
      if(!array||right?.kind!==K.BinaryExpression||right.operatorToken.kind!==K.PlusToken||!same(left,un(right.left)))return;
      if(array.escaped||!value(left.argumentExpression,K.IntKeyword)||!value(right.right,K.StringKeyword)){
        refused.push({function:fn.name.name,start:node.pos,reason:'ARRAY_ESCAPE_OR_NONPASSIVE_ADDRESS_OR_VALUE'});return;
      }
      const target=source.slice(node.left.pos,node.left.end),suffix=source.slice(right.right.pos,right.right.end);
      edits.push({function:fn.name.name,start:node.pos,end:node.end,before:source.slice(node.pos,node.end),replacement:target+' += '+suffix,
        array:{name:array.declaration.name.name,start:array.declaration.pos,end:array.declaration.end},
        elementType:'string',rhsPassiveStringValue:true,indexPassiveIntegerValue:true,wholeArrayNeverEscapes:true,
        addressRereadsHaveNoCallsOrWrites:true,concatenationCountAndGroupingUnchanged:true});
    });
  }
  edits.sort((a,b)=>a.start-b.start);let delta=0;
  for(let i=0;i<edits.length;i++){const edit=edits[i];if(i)assert(edits[i-1].end<=edit.start);edit.newStart=edit.start+delta;delta+=edit.replacement.length-(edit.end-edit.start);}
  let text=source;for(const edit of edits.toReversed())text=text.slice(0,edit.start)+edit.replacement+text.slice(edit.end);
  let inverse=text;for(const edit of edits.toReversed())inverse=inverse.slice(0,edit.newStart)+edit.before+inverse.slice(edit.newStart+edit.replacement.length);
  assert.equal(inverse,source,'PRIVATE_ARRAY_APPEND_BYTE_INVERSE');assert.equal(parse(text,'private-array-view').parseDiagnostics.length,0);
  return {text,proof:{kind:'PRIVATE_STRING_ARRAY_PASSIVE_APPEND_STORE',edits,refused,sourceSha256:sha(source),viewSha256:sha(text),
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false,
    boundary:'Galaxy business effects; debugger frames, allocation limits and instruction budgets are not an engine-acceptance claim.'}};
}
