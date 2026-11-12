// Converter preprocessing: split closed, repeatedly reused local loop captures.
// Keep original declarations/initialization and every effect in source order.
// New locals only replace group/index bindings of one proven native loop triple.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,Printer,SyntaxKind as K,forEachChild} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer(),sha=b=>createHash('sha256').update(b).digest('hex');
const walk=(n,f)=>{if(n){f(n);forEachChild(n,c=>walk(c,f));}};
const skip=new Set(['parent','pos','end','line','char','symbol','locals','flowNode','syntaxTokens']);
const shape=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(shape):Object.fromEntries(Object.entries(n).filter(([k])=>!skip.has(k)).map(([k,v])=>[k,shape(v)]));
const parse=s=>{const a=new Parser().parseFile('closed-unit-lifetimes',s);assert.equal(a.parseDiagnostics.length,0,'CLOSED_UNIT_LIFETIME_PARSE');return a;};
const assignment=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.BinaryExpression&&s.expression.operatorToken?.kind===K.EqualsToken?s.expression:undefined;
const id=(n,name)=>n?.kind===K.Identifier&&(name===undefined||n.name===name);
function triple(nodes,i){
 const a=assignment(nodes[i]),b=assignment(nodes[i+1]),loop=nodes[i+2];
 if(!a||!b||!id(a.left)||!id(b.left)||a.left.name===b.left.name||loop?.kind!==K.ForStatement||loop.initializer||loop.condition||loop.statement?.kind!==K.Block)return;
 const group=a.left.name,counter=b.left.name,count=b.right,inc=loop.incrementor,body=loop.statement.statements;
 if(count?.kind!==K.CallExpression||!id(count.expression,'UnitGroupCount')||count.arguments.length!==2||!id(count.arguments[0],group)||!id(count.arguments[1],'c_unitCountAll'))return;
 if(inc?.kind!==K.BinaryExpression||inc.operatorToken?.kind!==K.MinusEqualsToken||!id(inc.left,counter)||inc.right?.kind!==K.NumericLiteral||inc.right.text!=='1')return;
 const picked=assignment(body[0]),call=picked?.right,guard=body[1];
 if(!picked||call?.kind!==K.CallExpression||!id(call.expression,'UnitGroupUnitFromEnd')||call.arguments.length!==2||!id(call.arguments[0],group)||!id(call.arguments[1],counter))return;
 const condition=guard?.expression;
 if(guard?.kind!==K.IfStatement||guard.elseStatement||condition?.kind!==K.BinaryExpression||condition.operatorToken?.kind!==K.EqualsEqualsToken||printer.printNode(condition.left)!==printer.printNode(picked.left)||condition.right?.kind!==K.NullKeyword||guard.thenStatement?.kind!==K.Block||guard.thenStatement.statements.length!==1||guard.thenStatement.statements[0].kind!==K.BreakStatement)return;
 return {a,b,loop,inc,picked,group,counter};
}
export function splitClosedUnitLoopLifetimes(source){
 const ast=parse(source),allNames=new Set(),records=[],refused=[],edits=[],allReplacements=new Map(),additions=new Map();
 walk(ast,n=>{if(n.kind===K.Identifier)allNames.add(n.name);});
 for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  const declarations=new Map(),candidates=[];
  walk(fn.body,n=>{if(n.kind===K.VariableDeclaration){const name=n.name.name;declarations.set(name,[...(declarations.get(name)??[]),n]);}if(n.kind===K.Block)for(let i=0;i<n.statements.length-2;i++){const t=triple(n.statements,i);if(t)candidates.push(t);}});
  const families=new Map();
  for(const t of candidates){const key=t.group+'\0'+t.counter;if(!families.has(key))families.set(key,[]);families.get(key).push(t);}
  const entry=new Set();for(const s of fn.body.statements){if(s.kind!==K.VariableDeclaration)break;entry.add(s);}
  const replacements=new Map(),added=[];
  for(const members of families.values()){
   const {group,counter}=members[0],names=new Set([group,counter]);
   // A compiler spelling does not imply a unique lifetime: generated source
   // can reuse the same pair in several distinct blocks. Keep only single-use
   // compiler families on the existing SDK path.
   if(members.length===1&&/^auto[0-9a-f]{8}_g$/iu.test(group)&&/^auto[0-9a-f]{8}_u$/iu.test(counter))continue;
   const lifetimes=[...members].sort((a,b)=>a.a.pos-b.a.pos);
   if(lifetimes.some((t,i)=>i&&t.a.pos<lifetimes[i-1].loop.end)){refused.push({function:fn.name.name,group,counter,reason:'OVERLAPPING_CAPTURE_LIFETIMES'});continue;}
   const ds=[declarations.get(group),declarations.get(counter)];
   if(ds.some(v=>v?.length!==1)||!ds.every(v=>entry.has(v[0]))||printer.printNode(ds[0][0].type)!=='unitgroup'||printer.printNode(ds[1][0].type)!=='int'||ds.some(v=>v[0].modifiers?.length))continue;
   const permitted=new Set(),initialStores=[];
   for(const t of members)for(const n of [t.a.left,t.b,t.inc,t.picked.right])walk(n,v=>{if(v.kind===K.Identifier&&names.has(v.name))permitted.add(v);});
   // Initial stores are preserved verbatim; their resulting values are dead
   // before any native loop captures the next group/count. No effect is erased.
   const earliest=Math.min(...members.map(t=>t.a.pos));
   for(const s of fn.body.statements){const a=assignment(s);if(!a||a.pos>=earliest||!id(a.left)||!names.has(a.left.name))continue;let selfRead=false;walk(a.right,v=>{if(v.kind===K.Identifier&&names.has(v.name))selfRead=true;});if(!selfRead){permitted.add(a.left);initialStores.push(a);}}
   const declarationNames=new Set(ds.map(v=>v[0].name));let escaping=false;
   walk(fn.body,n=>{if(n.kind===K.Identifier&&names.has(n.name)&&!declarationNames.has(n)&&!permitted.has(n))escaping=true;});
   if(escaping){refused.push({function:fn.name.name,group,counter,reason:'GROUP_OR_COUNTER_REFERENCE_OUTSIDE_CLOSED_LOOP_CAPTURES'});continue;}
   // A candidate's group expression must observe the original pre-state.
   // In particular g=g and expressions reading another lifetime are not folded.
   if(members.some(t=>{let read=false;walk(t.a.right,n=>{if(n.kind===K.Identifier&&names.has(n.name))read=true;});return read;}))continue;
   for(const t of members){
    let salt=0,prefix;
    do{prefix='auto'+sha(fn.name.name+':'+t.a.pos+':'+salt++).slice(0,8).toUpperCase();}while(allNames.has(prefix+'_g')||allNames.has(prefix+'_u'));
    const mapping=new Map([[group,prefix+'_g'],[counter,prefix+'_u']]);for(const name of mapping.values())allNames.add(name);
    for(const n of [t.a.left,t.b,t.inc,t.picked.right])walk(n,v=>{if(v.kind===K.Identifier&&mapping.has(v.name))replacements.set(v,mapping.get(v.name));});
    added.push('unitgroup '+prefix+'_g;','int '+prefix+'_u;');
    records.push({function:fn.name.name,sourcePosition:t.a.pos,group,counter,newGroup:prefix+'_g',newCounter:prefix+'_u',allGroupCounterUsesClosed:true,originalInitialStoresPreserved:initialStores.length,bodyAndLoopTimingUnchanged:true});
   }
  }
  for(const [n,name]of replacements){allReplacements.set(n,name);edits.push({start:n.pos,end:n.pos+n.name.length,text:name});}
  if(added.length){additions.set(fn,parse('void Example () { '+added.join('\n')+' }').statements[0].body.statements);edits.push({start:fn.body.pos+1,end:fn.body.pos+1,text:'\n'+added.join('\n')+'\n'});}
 }
 edits.sort((a,b)=>a.start-b.start||a.end-b.end);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'CLOSED_UNIT_LIFETIME_OVERLAP');
 let text=source;for(const e of [...edits].reverse())text=text.slice(0,e.start)+e.text+text.slice(e.end);
 function expected(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(expected);const out=Object.fromEntries(Object.entries(n).filter(([k])=>!skip.has(k)).map(([k,v])=>[k,expected(v)]));if(allReplacements.has(n))out.name=allReplacements.get(n);if(additions.has(n))out.body.statements=[...shape(additions.get(n)),...out.body.statements];return out;}
 assert.deepEqual(shape(parse(text).statements),expected(ast.statements),'CLOSED_UNIT_LIFETIME_OTHER_AST_CHANGED');
 return {text,proof:{kind:'CLOSED_TYPED_UNIT_LOOP_CAPTURE_LIFETIMES',sourceSha256:sha(source),outputSha256:sha(text),changed:edits.length>0,records,refused,effectStatementsRemoved:0,sourceOrArchiveChanged:false,wholeMapAccepted:false,persistentCache:false}};
}
