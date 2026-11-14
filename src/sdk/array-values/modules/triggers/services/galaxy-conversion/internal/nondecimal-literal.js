/** Preserve exact hex/octal literal spelling rather than JS Number conversion. */
export function nondecimalLiteralParam(node){
 let literal=node,sign='';
 if(node?.kind===122&&node.operator?.kind===21){literal=node.operand;sign='-';}
 if(literal?.kind!==2)return undefined;
 const raw=String(literal.text??literal.value??'');
 if(!/^(?:0[xX][0-9A-Fa-f]+|0[0-7]+)$/u.test(raw))return undefined;
 return {scriptCode:sign+raw,valueType:{type:'int'}};
}
