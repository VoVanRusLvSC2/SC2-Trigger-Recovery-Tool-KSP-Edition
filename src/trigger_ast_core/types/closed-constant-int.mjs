import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readCanonicalInt32Literal} from './inclusive-literal-int-comparison.mjs';
const range=v=>v>=-2147483648n&&v<=2147483647n;
// Array extents may use actual const declarations. No runtime globals,
// guessed defaults, calls or integer-overflow normalizations are evaluated.
export function createClosedConstantIntResolver(asts) {
  const declarations=new Map();
  for(const ast of asts)for(const node of ast.statements)if(node.name?.name) {
    const rows=declarations.get(node.name.name)??[];rows.push({node,fileName:ast.fileName});declarations.set(node.name.name,rows);
  }
  return expression=>{
    let visits=0;const active=new Set(),dependencies=[];
    const evaluate=(node,depth=0)=>{
      if(!node||++visits>256||depth>32)return;
      const literal=readCanonicalInt32Literal(node);if(literal!==undefined)return literal;
      if(node.kind===K.ParenthesizedExpression)return evaluate(node.expression,depth+1);
      if(node.kind===K.Identifier) {
        const rows=declarations.get(node.name)??[];if(rows.length!==1||active.has(node.name))return;
        const {node:d,fileName}=rows[0];
        if(d.kind!==K.VariableDeclaration||d.type?.kind!==K.IntKeyword||d.modifiers?.length!==1||d.modifiers[0].kind!==K.ConstKeyword||!d.initializer)return;
        active.add(node.name);const value=evaluate(d.initializer,depth+1);active.delete(node.name);
        if(value!==undefined)dependencies.push({name:node.name,fileName,start:d.pos,end:d.end,value:String(value)});
        return value;
      }
      if(node.kind===K.PrefixUnaryExpression) {
        const a=evaluate(node.operand,depth+1);if(a===undefined)return;
        const result=node.operator.kind===K.PlusToken?a:node.operator.kind===K.MinusToken?-a:undefined;
        return result!==undefined&&range(result)?result:undefined;
      }
      if(node.kind!==K.BinaryExpression)return;
      const a=evaluate(node.left,depth+1),b=evaluate(node.right,depth+1);if(a===undefined||b===undefined)return;
      let value;
      switch(node.operatorToken.kind) {
        case K.PlusToken:value=a+b;break;
        case K.MinusToken:value=a-b;break;
        case K.AsteriskToken:value=a*b;break;
        case K.SlashToken:if(b!==0n)value=a/b;break;
        case K.PercentToken:if(b!==0n&&!(a===-2147483648n&&b===-1n))value=a%b;break;
      }
      return value!==undefined&&range(value)?value:undefined;
    };
    const value=evaluate(expression);
    return value===undefined?undefined:{value,proof:{kind:'CLOSED_CONST_INT32_EXPRESSION',dependencies,everyIntermediateInSignedInt32:true,runtimeInputsEvaluated:false}};
  };
}
