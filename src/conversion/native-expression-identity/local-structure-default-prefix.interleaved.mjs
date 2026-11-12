// Recognition can defer a source-shaped structure prefix. Emission must prove
// every removed assignment against the actual owned GUI member/preset graph.
import {SyntaxKind as K} from "../exact-function-signatures/index-alternate-3.js";
import {getTypeName,structureMemberKey} from "./g2t-core.generated-call-provenance.mjs";
import {syntaxChildren} from "./script-template.mjs";
import {foldLocalStructureDefaultPrefix as legacyFold} from "./local-structure-default-prefix.shape-first.mjs";
const write=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.BinaryExpression&&s.expression.operatorToken?.kind===K.EqualsToken?s.expression:undefined;
const key=(r,owner)=>JSON.stringify([r.library??owner,r.type,r.id]);

export function deferredLocalStructurePrefix(nodes,length,structureTypes){
 if(!structureTypes?.size)return undefined;
 const declarations=nodes.slice(0,length).filter(n=>n.kind===K.VariableDeclaration);
 const locals=new Map(declarations.map(n=>[n.name.name,n]));
 const candidates=[];const kept=[];
 for(const statement of nodes.slice(0,length)){
  const assignment=write(statement),left=assignment?.left;
  if(left?.kind===K.PropertyAccessExpression&&left.expression?.kind===K.Identifier&&assignment.right?.kind===K.Identifier){
   const declaration=locals.get(left.expression.name);
   if(declaration&&!declaration.initializer&&structureTypes.has(getTypeName(declaration.type))){
    candidates.push(statement);continue;
   }
  }
  kept.push(statement);
 }
 return candidates.length?{nodes:[...kept,...nodes.slice(length)],length:kept.length,candidates}:undefined;
}

export function foldLocalStructureDefaultPrefix(statements,ctx,body){
 const previous=legacyFold(statements,ctx,body);if(previous.folded.length)return previous;
 const unchanged=()=>({statements,folded:[]});
 const start=statements.findIndex(n=>n.kind!==K.VariableDeclaration);if(start<0)return unchanged();
 const declarations=statements.slice(0,start),locals=new Map(declarations.map(n=>[n.name.name,n]));
 if(!declarations.some(n=>ctx.structureByGalaxyTypeName?.has(getTypeName(n.type))))return unchanged();
 const counts=new Map(),pending=[body],seen=new Set();
 while(pending.length){
  const node=pending.pop();if(!node||seen.has(node))continue;seen.add(node);
  if(seen.size>250000)throw Error('Local structure prefix scan bound exceeded');
  if(node.kind===K.VariableDeclaration)counts.set(node.name?.name,(counts.get(node.name?.name)??0)+1);
  pending.push(...syntaxChildren(node));
 }
 let cursor=start;const removed=new Set(),folded=[];
 for(const declaration of declarations){
  const name=declaration.name.name,ref=ctx.structureByGalaxyTypeName?.get(getTypeName(declaration.type));
  if(!ref){
   // Consume, but never move, an ordinary initializer at its declaration slot.
   if(!declaration.initializer&&write(statements[cursor])?.left?.kind===K.Identifier&&write(statements[cursor]).left.name===name)cursor++;
   continue;
  }
  if(declaration.initializer||counts.get(name)!==1||ctx.paramRefByGalaxyName?.has(name)||ctx.globalVarByGalaxyName?.has(name)||(ref.library??ctx.libId)!==ctx.libId)return unchanged();
  const structure=ctx.elements[ref.id];if(structure?.type!=='Structure'||!structure.variables?.length)return unchanged();
  const members=[];
  for(const memberRef of structure.variables){
   if((memberRef.library??ctx.libId)!==ctx.libId)return unchanged();
   const variable=ctx.elements[memberRef.id];
   if(variable?.type!=='Variable'||variable.isArray||variable.variableType?.type==='struct')return unchanged();
   // No Value reference generates no member initializer (original Editor probe).
   if(!variable.initialValue)continue;
   if((variable.initialValue.library??ctx.libId)!==ctx.libId)return unchanged();
   const param=ctx.elements[variable.initialValue.id];
   if(!param?.preset||Object.keys(param).some(k=>!['type','id','library','preset'].includes(k)))return unchanged();
   const statement=statements[cursor],assignment=write(statement),left=assignment?.left,right=assignment?.right;
   if(left?.kind!==K.PropertyAccessExpression||left.expression?.kind!==K.Identifier||left.expression.name!==name||right?.kind!==K.Identifier)return unchanged();
   const member=ctx.structureMemberByKey?.get(structureMemberKey(ref.id,left.name.name));
   const preset=ctx.galaxyConstToPreset?.get(right.name);
   if(counts.has(right.name)||ctx.paramRefByGalaxyName?.has(right.name)||ctx.globalVarByGalaxyName?.has(right.name)||!member||key(member,ctx.libId)!==key(memberRef,ctx.libId)||!preset||key(preset,ctx.libId)!==key(param.preset,ctx.libId))return unchanged();
   removed.add(statement);cursor++;members.push({member:memberRef.id,preset:{...preset},sourceStatement:statement});
  }
  if(members.length)folded.push({local:name,structure:ref.id,members});
 }
 // An unmatched local write before control flow would be re-ordered by GUI
 // initial values. Reject it; do not guess whether its expression has effects.
 const next=write(statements[cursor]);
 if(next&&(next.left?.kind===K.Identifier&&locals.has(next.left.name)||next.left?.kind===K.PropertyAccessExpression&&locals.has(next.left.expression?.name)))return unchanged();
 return removed.size?{statements:statements.filter(s=>!removed.has(s)),folded}:unchanged();
}
