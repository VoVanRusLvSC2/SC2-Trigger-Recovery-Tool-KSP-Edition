// Literal global stores may commute through declarations which execute no
// source code. Includes, computed initializers and type-bound reads are barriers.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {assertExactAstShape} from './exact-ast-shape.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=text=>createHash('sha256').update(text).digest('hex');
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode','id','comments','__sourceText','hasReturn']);
const intrinsic=node=>node.type?.kind>=K.BoolKeyword&&node.type.kind<=K.WavetargetKeyword&&node.type.kind!==K.VoidKeyword;
function literal(node){
  if(!node)return true;
  if([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(node.kind))return true;
  if(node.kind===K.ParenthesizedExpression)return literal(node.expression);
  return node.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(node.operator?.kind)&&node.operand?.kind===K.NumericLiteral;
}
function passiveType(node,names){
  let passive=true;const pending=[node];
  while(pending.length){const child=pending.pop();
    if(child.kind===K.CallExpression||child.kind===K.Identifier&&names.has(child.name))passive=false;
    if(child.kind===K.ArrayType){let size=child.size;while(size?.kind===K.ParenthesizedExpression)size=size.expression;
      if(size?.kind!==K.NumericLiteral||!/^[0-9]+$/u.test(size.text??''))passive=false;}
    forEachChild(child,value=>{pending.push(value);});
  }return passive;
}
export function canonicalPassiveGlobalInitializerLayout(source){
  const ast=parse(source,'passive-global-layout');assert.equal(ast.parseDiagnostics.length,0);
  const globals=ast.statements.filter(node=>node.kind===K.VariableDeclaration),names=new Set(globals.map(node=>node.name.name));
  assert.equal(names.size,globals.length);assert(!ast.statements.some(node=>node.kind!==K.VariableDeclaration&&node.name&&names.has(node.name.name)));
  const edits=[],records=[];let group=[];
  function flush(){
    const ordered=[...group].sort((a,b)=>a.node.name.name.localeCompare(b.node.name.name));
    if(ordered.some((entry,i)=>entry!==group[i])){
      for(let i=0;i<group.length;i++)edits.push({start:group[i].node.pos,end:group[i].node.end,before:source.slice(group[i].node.pos,group[i].node.end),replacement:source.slice(ordered[i].node.pos,ordered[i].node.end)});
      records.push({positions:group.map(entry=>entry.index),original:group.map(entry=>entry.node.name.name),canonical:ordered.map(entry=>entry.node.name.name),
        literalPrimitiveInitializersOnly:true,noSourceConstructorCrossed:true});
    }group=[];
  }
  for(const [index,node]of ast.statements.entries()){
    if(node.kind===K.EmptyStatement)continue;
    if(node.kind===K.FunctionDeclaration){
      if([node.type,...node.parameters.map(parameter=>parameter.type)].every(type=>passiveType(type,names)))continue;
      flush();continue;
    }
    if(node.kind===K.VariableDeclaration&&(node.modifiers??[]).every(modifier=>modifier.kind===K.ConstKeyword)){
      if(intrinsic(node)&&literal(node.initializer)){if(node.initializer)group.push({node,index});continue;}
      // Galaxy aggregate/reference storage has no user constructor. An explicit
      // initializer still remains a barrier, regardless of its apparent purity.
      if(!node.initializer&&passiveType(node.type,names))continue;
    }
    if([K.StructDeclaration,K.TypedefDeclaration].includes(node.kind)){
      let dependent=false;const pending=[node];
      while(pending.length){const child=pending.pop();if(child.kind===K.Identifier&&names.has(child.name)||child.initializer)dependent=true;forEachChild(child,value=>{pending.push(value);});}
      if(!dependent&&passiveType(node,names))continue;
    }
    flush();
  }
  flush();edits.sort((a,b)=>a.start-b.start);let text=source;
  for(const edit of edits.toReversed()){assert.equal(text.slice(edit.start,edit.end),edit.before);text=text.slice(0,edit.start)+edit.replacement+text.slice(edit.end);}
  const after=parse(text,'passive-global-view');assert.equal(after.parseDiagnostics.length,0);const restored=[...after.statements];
  for(const record of records){const nodes=record.positions.map(index=>after.statements[index]);assert.deepEqual(nodes.map(node=>node.name.name),record.canonical);const byName=new Map(nodes.map(node=>[node.name.name,node]));for(let i=0;i<record.positions.length;i++)restored[record.positions[i]]=byName.get(record.original[i]);}
  const inverse=assertExactAstShape(restored,ast.statements,{ignoredFields:ignored,label:'PASSIVE_GLOBAL_LAYOUT_OTHER_AST_CHANGED'});
  return {text,proof:{kind:'PASSIVE_GLOBAL_LITERAL_INITIALIZER_LAYOUT',edits,records,inverse,sourceSha256:sha(source),viewSha256:sha(text),
    includesAndComputedInitializersAreBarriers:true,declarationsAndValuesRetained:true,sourceOrExportChanged:false,wholeMapAccepted:false,
    boundary:'Galaxy storage has no user-defined aggregate constructor; VM allocation budgets and debugger declaration order are not an engine-acceptance claim.'}};
}
