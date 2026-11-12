// Exact standalone concatenation lowering; retain input archive and source.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from "./index-alternate-3.js";
const hash=t=>createHash('sha256').update(t).digest('hex');
const parse=t=>{const a=new Parser().parseFile('concat.galaxy',t);assert.equal(a.parseDiagnostics.length,0);return a;};
function walk(n,fn){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(x=>walk(x,fn));return;}fn(n);for(const[k,v]of Object.entries(n))if(k!=='parent')walk(v,fn);}
export function lowerStringArrayConcatAssignments(source,document){
 const ast=document?document.input(source):parse(source),edits=[],records=[];
 for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  const all=[...(fn.parameters??[])];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)all.push(n);});
  const binding=name=>{const xs=all.filter(n=>n.name?.name===name);return xs.length===1?xs[0]:undefined;};
  const mutable=n=>n&&!(n.modifiers??[]).some(m=>m.kind===K.ConstKeyword);
  walk(fn.body,stmt=>{
   const e=stmt.kind===K.ExpressionStatement?stmt.expression:null,l=e?.left;
   if(e?.kind!==K.BinaryExpression||e.operatorToken?.kind!==K.PlusEqualsToken||l?.kind!==K.ElementAccessExpression||l.expression?.kind!==K.Identifier)return;
   const arr=binding(l.expression.name);
   if(!mutable(arr)||arr.type?.kind!==K.ArrayType||arr.type.elementType?.kind!==K.StringKeyword||!fn.body.statements.includes(arr)||arr.pos>=e.pos)return;
   const index=l.argumentExpression;
   if(index?.kind===K.Identifier){const b=binding(index.name);if(!b||b.type?.kind!==K.IntKeyword)return;}
   else if(index?.kind!==K.NumericLiteral||!/^\d+$/u.test(index.text??''))return;
   if(e.right?.kind===K.Identifier){const b=binding(e.right.name);if(!b||b.type?.kind!==K.StringKeyword)return;}
   else if(e.right?.kind!==K.StringLiteral)return;
   const left=source.slice(l.pos,l.end),right=source.slice(e.right.pos,e.right.end),replacement=`${left} = (${left} + ${right})`;
   edits.push({start:e.pos,end:e.end,text:replacement});records.push({function:fn.name.name,target:left,original:source.slice(e.pos,e.end),replacement,arrayType:'string[]',indexIsLiteralOrUniqueScalarInt:true,rhsIsLiteralOrUniqueScalarString:true,noCallOrSideEffect:true,originalBindingTypesRetained:true});
  });
 }
 edits.sort((a,b)=>b.start-a.start);let text=source;for(let i=0;i<edits.length;i++){if(i)assert(edits[i].end<=edits[i-1].start);const e=edits[i];text=text.slice(0,e.start)+e.text+text.slice(e.end);}(document?document.output(text):parse(text));
 return{text,proof:{originalSha256:hash(source),loweredSha256:hash(text),records,originalFilesChanged:false}};
}
