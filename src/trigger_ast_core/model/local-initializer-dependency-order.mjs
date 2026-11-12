import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const literal=n=>{
 while(n?.kind===K.ParenthesizedExpression)n=n.expression;
 return [K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(n?.kind)||
  n?.kind===K.PrefixUnaryExpression&&n.operator?.kind===K.MinusToken&&n.operand?.kind===K.NumericLiteral;
};

// Compare the source assignment schedule with the actual GUI emission schedule.
// A read of a later local remains a default-value read only if it stays later;
// an earlier initialized value must remain earlier. Independent literal stores
// can commute, while two potentially observable expressions cannot be swapped.
export function localInitializerDependencyOrder(declarations,initializers){
 const names=declarations.map(d=>d.name?.name),source=initializers.map(v=>v.name),selected=new Set(source);
 if(names.some(n=>!n)||source.some(n=>!n)||new Set(names).size!==names.length||selected.size!==source.length)return undefined;
 const emitted=names.filter(n=>selected.has(n));if(emitted.length!==source.length)return undefined;
 const positions=new Map(emitted.map((name,index)=>[name,index])),sourcePositions=new Map(source.map((name,index)=>[name,index]));
 for(let i=0;i<source.length;i++)for(let j=i+1;j<source.length;j++){
  if(positions.get(source[i])<positions.get(source[j]))continue;
  if(!literal(initializers[i].expression)&&!literal(initializers[j].expression))return undefined;
 }
 return Object.freeze({sameOrder:source.every((name,index)=>name===emitted[index]),preservesRead(index,name){
  const other=sourcePositions.get(name);if(other===undefined||other===index)return true;
  return Math.sign(other-index)===Math.sign(positions.get(name)-positions.get(source[index]));
 }});
}
