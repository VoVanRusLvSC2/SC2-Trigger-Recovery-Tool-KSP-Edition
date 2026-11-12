import {cloneGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/94c0098c9dbc-dd2fe52ec855-3af1c1fe9330da63-semantic_forms.mjs';
/** Comparison-only proof of redundant calls in a closed generated startup graph.
 * A flag has exactly two bound uses (own guard + true assignment), no resets,
 * no foreign mentions, and every stage call occurs in a top-level sequence.
 * All reachable invocation contexts must already have completed the target.
 * First calls, registration order, assignments and effects remain untouched.
 */
export function normalizeGuardedStartupNoops(source,K,forEachChild,{declarations=[]}={}){
 const copy={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[];
 const walk=(n,cb,p)=>{if(!n)return;cb(n,p);forEachChild(n,c=>walk(c,cb,n));};
 const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
 const stageName=n=>/^(?:InitMap|InitLibs|InitGlobals|InitTriggers|InitCustomScript|lib[A-Za-z0-9_]+_Init(?:Lib|Libraries|Variables|Triggers|CustomScript))(?:_\d+)?$/u.test(n);
 const functions=new Map();let valid=true;
 for(const n of copy.statements)if(n.kind===K.FunctionDeclaration&&n.body&&stageName(n.name.name)){if(functions.has(n.name.name))valid=false;functions.set(n.name.name,n);}
 const root=functions.get('InitMap');if(!valid||!root||root.parameters.length||root.type.kind!==K.VoidKeyword)return {source:copy,notes,refused:'No unique zero-argument void InitMap'};
 const globals=new Map(copy.statements.filter(n=>n.kind===K.VariableDeclaration).map(n=>[n.name.name,n]));
 const entries=[];walk(copy,(n,p)=>entries.push({n,p}));
 const guards=new Map();
 for(const [name,f] of functions){
  if(f.parameters.length||f.type.kind!==K.VoidKeyword)return {source:copy,notes,refused:'Unexpected startup signature'};
  const ss=f.body.statements.filter(n=>n.kind!==K.VariableDeclaration),[g,s]=ss;
  let cond=unwrap(g?.expression),flag=cond?.kind===K.Identifier?cond.name:undefined;
  if(cond?.kind===K.BinaryExpression&&cond.operatorToken.kind===K.EqualsEqualsToken){const a=unwrap(cond.left),b=unwrap(cond.right);if(a.kind===K.Identifier&&b.kind===K.TrueKeyword)flag=a.name;else if(b.kind===K.Identifier&&a.kind===K.TrueKeyword)flag=b.name;}
  const branch=g?.thenStatement?.kind===K.Block?g.thenStatement.statements:[g?.thenStatement],set=s?.expression,decl=globals.get(flag);
  if(g?.kind!==K.IfStatement||g.elseStatement||branch.length!==1||branch[0]?.kind!==K.ReturnStatement||branch[0].expression||s?.kind!==K.ExpressionStatement||set?.kind!==K.BinaryExpression||set.operatorToken.kind!==K.EqualsToken||set.left.name!==flag||unwrap(set.right)?.kind!==K.TrueKeyword||decl?.type.kind!==K.BoolKeyword||unwrap(decl.initializer)?.kind!==K.FalseKeyword)continue;
  if(entries.filter(({n})=>n.kind===K.VariableDeclaration&&n.name.name===flag).length!==1)continue;
  const owned=new Set();walk(f,n=>owned.add(n));const uses=entries.filter(({n,p})=>n.kind===K.Identifier&&n.name===flag&&p?.name!==n);
  if(uses.length!==2||!uses.every(e=>owned.has(e.n)))continue;
  const escape=x=>x.replace(/[.*+?^${}()|[\]\\]/gu,'\\$&');
  if(declarations.some(d=>new RegExp('\\b(?:'+escape(name)+'|'+escape(flag)+')\\b','u').test(d.text)))continue;
  guards.set(name,{flag,rest:ss.slice(2)});
 }
 if(!guards.size)return {source:copy,notes,refused:'No closed immutable completion guards'};
 const owner=new Map();for(const f of functions.values())walk(f.body,n=>owner.set(n,f));
 const stageCalls=[];
 for(const {n,p} of entries)if(n.kind===K.Identifier&&functions.has(n.name)&&p?.name!==n){
  const f=owner.get(n),call=p,statement=entries.find(e=>e.n===call)?.p;
  if(!f||call.kind!==K.CallExpression||call.expression!==n||call.arguments.length||statement?.kind!==K.ExpressionStatement||!f.body.statements.includes(statement))return {source:copy,notes,refused:'Stage reference outside a closed top-level startup sequence'};
  stageCalls.push({f,call,statement,target:n.name});
 }
 for(const f of functions.values())if(stageCalls.some(c=>c.f===f)){
  const ss=guards.has(f.name.name)?guards.get(f.name.name).rest:f.body.statements;
  if(ss.some(s=>s.kind!==K.ExpressionStatement&&s.kind!==K.VariableDeclaration))return {source:copy,notes,refused:'Control flow can skip an observed startup call'};
 }
 // All staged helper callers are owned by this graph. Foreign raw code cannot
 // supply an earlier invocation context that is absent from the parsed root.
 for(const name of functions.keys())if(name!=='InitMap'&&declarations.some(d=>new RegExp('\\b'+name+'\\b','u').test(d.text)))return {source:copy,notes,refused:'Foreign startup helper reference'};
 const byStatement=new Map(stageCalls.map(c=>[c.statement,c])),observations=new Map();let steps=0,cycle=false;
 const run=(name,completed,stack)=>{
  if(++steps>10000){cycle=true;return;}
  const f=functions.get(name);if(!f)return;
  const guard=guards.get(name);if(guard&&completed.has(guard.flag))return;
  if(stack.has(name)){cycle=true;return;}
  if(guard)completed.add(guard.flag);
  const ss=guard?guard.rest:f.body.statements;
  for(const s of ss){const call=byStatement.get(s);if(!call)continue;const targetGuard=guards.get(call.target),noop=!!targetGuard&&completed.has(targetGuard.flag);const o=observations.get(s)??{visits:0,alwaysNoop:true};o.visits++;o.alwaysNoop&&=noop;observations.set(s,o);run(call.target,completed,new Set([...stack,name]));}
 };
 run('InitMap',new Set(),new Set());
 if(cycle)return {source:copy,notes,refused:'Unbounded or unguarded startup recursion'};
 const remove=new Set();for(const [s,o] of observations)if(o.visits&&o.alwaysNoop){const c=byStatement.get(s);remove.add(s);notes.push({function:c.f.name.name,target:c.target,flag:guards.get(c.target).flag,rule:'CLOSED_STARTUP_ALREADY_COMPLETED_GUARDED_CALL',contexts:o.visits});}
 for(const f of functions.values())f.body.statements=f.body.statements.filter(s=>!remove.has(s));
 return {source:copy,notes};
}
