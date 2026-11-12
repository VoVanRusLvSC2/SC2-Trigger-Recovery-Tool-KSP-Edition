// Closed GUI expression grammar. Text is never evaluated as arbitrary Galaxy.
const numeric=t=>t==='int'||t==='fixed';
const remainder=Object.freeze({slots:Object.freeze(['left','right']),text:'(~left~ % ~right~)',
 resultType:types=>types.length===2&&types.every(numeric)?types.includes('fixed')?'fixed':'int':undefined});
const negate=Object.freeze({slots:Object.freeze(['operand']),text:'(-~operand~)',
 resultType:types=>types.length===1&&numeric(types[0])?types[0]:undefined});
export function numericExpressionGrammar(text){
 if(typeof text!=='string')return;
 if(/^\s*\(\s*~left~\s*%\s*~right~\s*\)\s*$/u.test(text))return remainder;
 if(/^\s*\(\s*-\s*~operand~\s*\)\s*$/u.test(text))return negate;
}
