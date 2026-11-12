import {triggerConstructorFrame} from "./trigger-constructor-frame.mjs";
// Converter-input lowering. Preserve dynamic bound reads and original source.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from "./index-alternate-3.js";
const sha=t=>createHash('sha256').update(t).digest('hex');
function walk(n,f){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(x=>walk(x,f));return;}f(n);for(const[k,v]of Object.entries(n))if(k!=='parent')walk(v,f);}
export function lowerDynamicForLoops(source,document){
 const ast=(document?document.input(source):new Parser().parseFile('for.galaxy',source));assert.equal(ast.parseDiagnostics.length,0);const edits=[],records=[],statementSlots=new Set();
 walk(ast,n=>{if(n.kind===K.Block)for(const s of n.statements)statementSlots.add(s);});
 for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  if(triggerConstructorFrame(fn))continue; // Specific event reconstruction must see the original For shape.
  const bindings=[...(fn.parameters??[])];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)bindings.push(n);});
  walk(fn.body,n=>{
   if(n.kind!==K.ForStatement||n.statement?.kind!==K.Block||!statementSlots.has(n))return;
   const cond=n.condition,inc=n.incrementor;
   const dynamicAscending=cond?.kind===K.BinaryExpression&&cond.operatorToken?.kind===K.LessThanToken&&cond.right?.kind===K.Identifier;
   const descendingToZero=cond?.kind===K.BinaryExpression&&cond.operatorToken?.kind===K.GreaterThanEqualsToken&&cond.right?.kind===K.NumericLiteral&&cond.right.text==='0'&&inc?.operatorToken?.kind===K.MinusEqualsToken;
   if(!dynamicAscending&&!descendingToZero)return;
   if(inc?.kind!==K.BinaryExpression||![K.PlusEqualsToken,K.MinusEqualsToken].includes(inc.operatorToken?.kind)||inc.left?.kind!==K.Identifier||inc.right?.kind!==K.NumericLiteral||!/^\d+$/u.test(inc.right.text??''))return;
   const name=inc.left.name,bs=bindings.filter(b=>b.name?.name===name);if(bs.length!==1||bs[0].type?.kind!==K.IntKeyword||(bs[0].modifiers??[]).some(m=>m.kind===K.ConstKeyword))return;
   if(cond.left?.kind!==K.Identifier||cond.left.name!==name)return;
   if(n.initializer&&(n.initializer.kind!==K.BinaryExpression||n.initializer.operatorToken?.kind!==K.EqualsToken||n.initializer.left?.kind!==K.Identifier||n.initializer.left.name!==name))return;
   let blocked=false;walk(n.statement,x=>{if([K.ContinueStatement,K.ForStatement].includes(x.kind))blocked=true;});if(blocked)return;
   const slice=x=>source.slice(x.pos,x.end),body=source.slice(n.statement.pos+1,n.statement.end-1);
   assert(source[n.statement.pos]==='{'&&source[n.statement.end-1]==='}');
   const replacement=`${n.initializer?slice(n.initializer)+';\n':''}while (${slice(cond)}) {${body}\n${slice(inc)};\n}`;
   edits.push({start:n.pos,end:n.end,text:replacement});records.push({function:fn.name.name,variable:name,condition:slice(cond),initializer:n.initializer?slice(n.initializer):null,increment:slice(inc),boundReadEveryIteration:true,noContinueOrNestedFor:true,initializerExecutedOnce:true,incrementAfterBodyOnly:true,breakReturnBehaviorUnchanged:true});
  });
 }
 edits.sort((a,b)=>b.start-a.start);let text=source;for(let i=0;i<edits.length;i++){if(i)assert(edits[i].end<=edits[i-1].start);const e=edits[i];text=text.slice(0,e.start)+e.text+text.slice(e.end);}assert.equal((document?document.output(text):new Parser().parseFile('while.galaxy',text)).parseDiagnostics.length,0);
 return{text,proof:{originalSha256:sha(source),loweredSha256:sha(text),records,originalFilesChanged:false}};
}
