// Proof-only values. Original initializer ASTs and runtime expressions survive.
// References require the real include order; unchecked arithmetic stays raw.
import {SyntaxKind as K,forEachChild,isAssignmentOperator} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {initializersAfterMovedHeader} from './initialization-order.include-once.mjs';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
const inRange=v=>v>=-2147483648n&&v<=2147483647n;
function integerLiteral(node){
 let n=unwrap(node),negative=false;
 if(n?.kind===K.PrefixUnaryExpression&&n.operator.kind===K.MinusToken){negative=true;n=unwrap(n.operand);}
 const token=n?.text;
 if(n?.kind!==K.NumericLiteral||typeof token!=='string'||token.length>64||!/^(?:0[xX][0-9a-fA-F]+|0[0-7]*|[1-9][0-9]*)$/u.test(token))return;
 let value=BigInt(/^0[0-7]+$/u.test(token)?'0o'+token.slice(1):token);
 if(negative)value=-value;return inRange(value)?value:undefined;
}
export function unchangedFixedLiteral(node){
 let n=unwrap(node),sign='';
 if(n?.kind===K.PrefixUnaryExpression&&[K.MinusToken,K.PlusToken].includes(n.operator.kind)){
  sign=n.operator.kind===K.MinusToken?'-':'+';n=unwrap(n.operand);
 }
 const token=n?.text;
 if(n?.kind!==K.NumericLiteral||typeof token!=='string'||token.length>128||!/^\d+\.\d*$/u.test(token))return;
 return {kind:'UNCHANGED_FIXED_LITERAL',token:sign+token,numericValueNotEvaluated:true};
}
export function createHeaderIntegerResolver({source,externalSources,order,asts,candidates}){
 const facts=new Map(),positions=new Map();let available=false,refusal;
 const candidateByName=new Map(candidates.map(n=>[n.name.name,n]));
 try{
  // Validates the WeakMap brand and exact source/external stamps before the
  // public frozen order records may be used for a value dependency.
  initializersAfterMovedHeader(order,source,externalSources,new Set(candidates.map(n=>n.name.name)));
  for(const r of order.initializers){const list=positions.get(r.name)??[];list.push(r.index);positions.set(r.name,list);}
  available=true;
 }catch(e){refusal=String(e.message);}
 const declarations=new Map();
 for(const ast of asts)for(const n of ast.statements)if(n.name?.name){const group=declarations.get(n.name.name)??[];group.push(n);declarations.set(n.name.name,group);}
 for(const [name,ds]of declarations){
  if(ds.length!==1)continue;
  const n=ds[0],value=integerLiteral(n.initializer);
  if(n.kind===K.VariableDeclaration&&n.type?.kind===K.IntKeyword&&n.modifiers?.length===1&&n.modifiers[0].kind===K.ConstKeyword&&value!==undefined)
   facts.set(name,{node:n,value});
 }
 const unsafe=new Set();
 const scan=n=>{
  if(!n)return;
  if(n.name?.name&&facts.has(n.name.name)&&n!==facts.get(n.name.name).node&&
   [K.VariableDeclaration,K.ParameterDeclaration,K.FunctionDeclaration,K.PropertyDeclaration].includes(n.kind))unsafe.add(n.name.name);
  if(n.kind===K.BinaryExpression&&isAssignmentOperator(n.operatorToken.kind)){
   const left=unwrap(n.left);if(left?.kind===K.Identifier&&facts.has(left.name))unsafe.add(left.name);
  }
  if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind)){
   const operand=unwrap(n.operand);if(operand?.kind===K.Identifier&&facts.has(operand.name))unsafe.add(operand.name);
  }
  forEachChild(n,scan);
 };asts.forEach(a=>scan(a));for(const name of unsafe)facts.delete(name);
 const position=name=>positions.get(name)?.length===1?positions.get(name)[0]:undefined;
 const evaluate=(node,current,earlierValues)=>{
  if(!available)return;
  const at=position(current);if(at===undefined)return;
  const reads=[];let visits=0;
  const evalNode=node=>{
   if(!node||++visits>128)return;
   const n=unwrap(node),literal=integerLiteral(n);if(literal!==undefined)return literal;
   if(n.kind===K.Identifier){
    const from=position(n.name);if(from===undefined||from>=at)return;
    const value=earlierValues.get(n.name);
    const candidate=candidateByName.get(n.name);
    if(candidate?.type?.kind===K.IntKeyword&&!candidate.modifiers?.length&&Number.isSafeInteger(value)&&inRange(BigInt(value))){reads.push({name:n.name,kind:'EARLIER_MOVED_VALUE',index:from});return BigInt(value);}
    const fact=facts.get(n.name);if(!fact)return;
    reads.push({name:n.name,kind:'PRIOR_READONLY_CONST_INT',index:from,value:fact.value.toString()});return fact.value;
   }
   if(n.kind===K.PrefixUnaryExpression){
    const a=evalNode(n.operand);if(a===undefined)return;let v;
    if(n.operator.kind===K.PlusToken)v=a;
    else if(n.operator.kind===K.MinusToken)v=-a;
    else if(n.operator.kind===K.TildeToken)v=~a;
    return v!==undefined&&inRange(v)?v:undefined;
   }
   if(n.kind===K.BinaryExpression){
    const a=evalNode(n.left),b=evalNode(n.right);if(a===undefined||b===undefined)return;let v;
    switch(n.operatorToken.kind){
     case K.PlusToken:v=a+b;break;case K.MinusToken:v=a-b;break;case K.AsteriskToken:v=a*b;break;
     case K.CaretToken:v=a^b;break;case K.AmpersandToken:v=a&b;break;case K.BarToken:v=a|b;break;
    }
    return v!==undefined&&inRange(v)?v:undefined;
   }
  };
  const value=evalNode(node);if(value===undefined)return;
  return {value:Number(value),proof:{kind:'ORDERED_INT32_HEADER_VALUE',current,index:at,reads,
   everyIntermediateInSignedInt32:true,originalExpressionUnchanged:true,sourceOrCandidateChanged:false}};
 };
 return {evaluate,evidence:{orderAvailable:available,orderRefusal:refusal,
  readonlyLiteralConstants:facts.size,rejectedWrittenOrShadowedConstants:[...unsafe],
  unsupportedCallsDivisionRemainderAndShiftsRefuse:true,sourceOrCandidateChanged:false}};
}
