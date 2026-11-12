import {cloneGalaxySyntax} from "./semantic-forms.mjs";
/** Comparison-only lifetime proof for reusable, function-local int loop counters.
 * Every use must be inside a for loop which assigns the counter before reading
 * it. No scope, bound, body expression, call or execution order is altered.
 */
export function normalizeLoopCounterBindings(source,K,forEachChild){
 const copy={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[];
 const visit=(n,cb,parent)=>{if(!n)return;cb(n,parent);forEachChild(n,c=>visit(c,cb,n));};
 const bindingRef=(n,p)=>n.kind===K.Identifier&&p?.name!==n;
 for(const f of copy.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  const entries=[],counts=new Map(),loops=[],names=new Set();
  visit(f,n=>{if(n.kind===K.Identifier)names.add(n.name);});
  if([...names].some(n=>n.startsWith('__modkit_cmp_loop_i_')))continue;
  visit(f.body,(n,p)=>{entries.push({n,p});if(n.kind===K.VariableDeclaration)counts.set(n.name.name,(counts.get(n.name.name)??0)+1);if(n.kind===K.ForStatement)loops.push(n);});
  const prefix=[];for(const s of f.body.statements){if(s.kind!==K.VariableDeclaration)break;prefix.push(s);}
  const decls=prefix.filter(d=>d.type?.kind===K.IntKeyword&&!d.initializer&&!(d.modifiers??[]).length&&counts.get(d.name.name)===1&&!(f.parameters??[]).some(p=>p.name.name===d.name.name));
  const changes=new Map(),remove=new Set(),newDecls=[];
  for(const d of decls){
   const name=d.name.name,refs=entries.filter(e=>bindingRef(e.n,e.p)&&e.n.name===name).map(e=>e.n);
   if(!refs.length)continue;
   const owners=[];
   for(const [ordinal,loop] of loops.entries()){
    const init=loop.initializer;
    if(init?.kind!==K.BinaryExpression||init.operatorToken?.kind!==K.EqualsToken||init.left?.kind!==K.Identifier||init.left.name!==name)continue;
    let selfRead=false;visit(init.right,(n,p)=>{if(bindingRef(n,p)&&n.name===name)selfRead=true;});
    if(selfRead)continue;
    const nodes=new Set();visit(loop,n=>nodes.add(n));
    owners.push({loop,ordinal,nodes,refs:refs.filter(n=>nodes.has(n))});
   }
   // A read after a loop, read in the initializer, or nested reuse of the same
   // counter invalidates the lifetime proof. An initialized value never escapes.
   if(!owners.length||!refs.every(n=>owners.filter(o=>o.nodes.has(n)).length===1))continue;
   remove.add(d);
   for(const o of owners){const replacement=`__modkit_cmp_loop_i_${o.ordinal}`;newDecls.push({...cloneGalaxySyntax(d),name:{...d.name,name:replacement}});for(const n of o.refs)changes.set(n,replacement);}
   notes.push({function:f.name.name,rule:'NONESCAPING_REINITIALIZED_LOCAL_INT_LOOP_COUNTER',name,loops:owners.map(o=>o.ordinal)});
  }
  for(const [n,name] of changes)n.name=name;
  if(remove.size){const remaining=f.body.statements.filter(n=>!remove.has(n));let i=0;while(remaining[i]?.kind===K.VariableDeclaration)i++;newDecls.sort((a,b)=>Number(a.name.name.split('_').at(-1))-Number(b.name.name.split('_').at(-1)));f.body.statements=[...remaining.slice(0,i),...newDecls,...remaining.slice(i)];}
 }
 return {source:copy,notes};
}
