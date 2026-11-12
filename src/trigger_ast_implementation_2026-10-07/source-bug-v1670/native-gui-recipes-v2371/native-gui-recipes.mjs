import {Parser} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
/** v2370. Source-proved lowering to shipped GUI definitions, never a new native.
 * Facts exist only during one synchronous conversion (including nested calls).
 * Unknown writes, aliases, producers, external callees and templates fail closed.
 * Engine evidence: user_maps_2026-10-10/native_semantics_v2369, pinned Editor EXE.
 */
import {syntaxChildren} from './balanced-script-template.mjs';
const id=n=>n?.kind===113?n.name:undefined;
const callee=n=>n?.kind===121?id(n.expression):undefined;
const key=n=>`${n.pos}:${n.end}`;
const children=n=>syntaxChildren(n).flat().filter(x=>x&&typeof x.kind==='number');
function walk(n,visit,parent){if(!n)return;visit(n,parent);for(const c of children(n))walk(c,visit,n);}
const list=n=>n?.kind===128?[...n.statements]:n?[n]:[];
const assignment=n=>{const e=n?.kind===138?n.expression:n;return e?.kind===124&&e.operatorToken?.kind===39?e:undefined;};
const intersect=(a,b)=>new Set([...a].filter(x=>b.has(x)));
let active;
export function withNativeGuiFacts(sources,run,externalSources=[]){const previous=active;active=analyzeNativeGuiFacts(sources,externalSources);try{return run();}finally{active=previous;}}
// Exposed for regression tests and the auditable source census.
export function analyzeNativeGuiFacts(sources,externalSources=[]){
 const functions=new Map(),all=[],parents=new Map(),functionOf=new Map(),globalNames=new Set(),duplicate=new Set();
 for(const s of sources){
  for(const n of s.statements??[]){if(n.kind===141)globalNames.add(id(n.name));if(n.kind===142&&n.body){const name=id(n.name);if(functions.has(name))duplicate.add(name);else functions.set(name,n);}}
  walk(s,(n,p)=>{all.push(n);parents.set(n,p);});
 }
 for(const f of functions.values())walk(f.body,n=>functionOf.set(n,f));
 const calls=all.filter(n=>n.kind===121),units=new Set(),players=new Set(),boards=new Map(),reasons=[];
 const producers=new Set(['UnitGroup','UnitGroupEmpty','UnitGroupSelected','UnitGroupSearch']);
 const groupConsumers=new Set(['UnitGroupCount','UnitGroupUnit','UnitGroupUnitFromEnd','UnitGroupAdd','UnitGroupRemove','UnitGroupClear','UnitGroupHasUnit']);
 for(const f of functions.values()){
  const locals=new Set();walk(f.body,n=>{if(n.kind===141&&n.type?.kind===104)locals.add(id(n.name));});
  // A group passed to an unknown function could be rebound through a reference.
  const escaped=new Set();walk(f.body,n=>{const a=assignment(n);if(a&&locals.has(id(a.left))&&!producers.has(callee(a.right)))escaped.add(id(a.left));if(n.kind===121&&!groupConsumers.has(callee(n)))for(const a of n.arguments??[])if(locals.has(id(a)))escaped.add(id(a));});
  function expr(n,valid){walk(n,c=>{if(callee(c)!=='UnitGroupUnitFromEnd'||c.arguments.length!==2)return;const [g,i]=c.arguments;if(id(g)&&valid.has(id(g))&&!escaped.has(id(g))&&(id(i)||i.kind===2))units.add(c);});}
  function statement(n,valid){
   if(!n)return valid;
   if(n.kind===128){for(const s of n.statements)valid=statement(s,valid);return valid;}
   if(n.kind===129){expr(n.expression,valid);return intersect(statement(n.thenStatement,new Set(valid)),statement(n.elseStatement,new Set(valid)));}
   if([130,131,132].includes(n.kind)){
    // Only invariant valid handles enter loop proofs. A later invalidation must
    // also invalidate earlier calls on the next iteration.
    const safe=new Set(valid);walk(n.statement,x=>{const a=assignment(x);if(a&&locals.has(id(a.left))&&!producers.has(callee(a.right)))safe.delete(id(a.left));});
    expr(n.initializer,safe);expr(n.expression??n.condition,safe);statement(n.statement,new Set(safe));expr(n.incrementor,safe);return intersect(valid,safe);
   }
   expr(n,valid);
   if(n.kind===141&&locals.has(id(n.name))){valid.delete(id(n.name));if(producers.has(callee(n.initializer)))valid.add(id(n.name));}
   const a=assignment(n);if(a&&locals.has(id(a.left))){valid.delete(id(a.left));if(producers.has(callee(a.right)))valid.add(id(a.left));}
   return valid;
  }
  statement(f.body,new Set());
 }
 // These native operations do not yield, invoke callbacks or rebind playergroup
 // variables. Recursive/custom/unknown effects are rejected, not guessed.
 const noYield=new Set(['PlayerGroupNextPlayer','PlayerGroupSingle','UIDisplayMessage','PlayerStatus','StringToText','IntToString']);
 function stable(n,group,seen=new Set()){
  let ok=true;walk(n,(x,p)=>{
   if(!ok)return;
   if(id(x)===group){const a=assignment(p);if(a&&a.left===x||p?.kind===143||p?.kind===141&&p.name===x)ok=false;}
   if(x.kind===121){const name=callee(x);if(noYield.has(name))return;const target=functions.get(name);if(!target||duplicate.has(name)||seen.has(name)){ok=false;return;}const nested=new Set(seen);nested.add(name);if(!stable(target.body,group,nested))ok=false;}
  });return ok;
 }
 for(const f of functions.values())walk(f.body,n=>{
  if(n.kind!==131)return;const step=assignment(list(n.statement)[0]),c=step?.right,g=callee(c)==='PlayerGroupNextPlayer'?id(c.arguments?.[0]):undefined;
  if(!g||!globalNames.has(g))return;
  // No local/parameter may shadow the global proof.
  let shadow=false;walk(f,n=>{if([141,143].includes(n.kind)&&id(n.name)===g)shadow=true;});
  if(!shadow&&stable(n,g,new Set([id(f.name)])))players.add(n);
 });
 const boardSafe=new Set(['BoardTitleSetText','BoardItemSetText','BoardItemSetFontSize','BoardItemSetTextColor','BoardSetAnchor']);
 // Reject other title-colour setters anywhere in the owned program, even when
 // their target is an integer expression instead of the named board handle.
 let dependencyBoardEffect=false;
 // Real mounted Galaxy dependency bodies also participate in the colour proof.
 // Prototypes alone are harmless. Any external setter/LastCreated reader or
 // unparseable relevant body disables the title recipe for the whole document.
 for(const file of externalSources){
  if(!/\b(?:BoardSetName|BoardTitleSetColor|BoardLastCreated)\b/u.test(file.text??''))continue;
  const tree=new Parser().parseFile(file.fileName??'dependency.galaxy',file.text);
  if(tree.parseDiagnostics.length){dependencyBoardEffect=true;break;}
  walk(tree,n=>{if(['BoardSetName','BoardTitleSetColor','BoardLastCreated'].includes(callee(n)))dependencyBoardEffect=true;});
 }
 const colorWriter=dependencyBoardEffect||calls.some(c=>['BoardSetName','BoardTitleSetColor'].includes(callee(c)));
 for(const call of calls.filter(c=>callee(c)==='BoardTitleSetText'&&c.arguments.length===2)){
  const g=id(call.arguments[0]);if(!g||!globalNames.has(g)||colorWriter)continue;
  let safe=true,color,creates=0;
  for(const n of all){
   if(id(n)!==g)continue;const p=parents.get(n);
   if(p?.kind===141&&p.name===n&&!p.initializer)continue;
   const a=assignment(p);
   if(a?.left===n){
    if(id(a.right)==='c_boardNone')continue;
    const s=parents.get(a),block=parents.get(s),items=block?.statements,previous=items?.[items.indexOf(s)-1]?.expression;
    const col=previous?.arguments?.[3];
    if(callee(a.right)==='BoardLastCreated'&&a.right.arguments.length===0&&callee(previous)==='BoardCreate'&&previous.arguments.length===4&&callee(col)==='Color'&&col.arguments.length===3&&col.arguments.every(x=>x.kind===2)){
     const value=col.arguments.map(x=>Number(x.value??x.text));if(value.some(v=>!Number.isFinite(v)||v<0||v>100)||color&&JSON.stringify(color)!==JSON.stringify(value)){safe=false;break;}
     color=value;creates++;continue;
    }safe=false;break;
   }
   if(p?.kind===124&&[17,18].includes(p.operatorToken?.kind)&&[p.left,p.right].some(x=>id(x)==='c_boardNone'))continue;
   if(p?.kind===121&&p.arguments[0]===n&&boardSafe.has(callee(p)))continue;
   safe=false;break;
  }
  // Every LastCreated read must immediately capture its own just-created board;
  // otherwise an undiscovered alias could change the title colour.
  if(safe)for(const c of calls.filter(c=>callee(c)==='BoardLastCreated')){
   const a=parents.get(c),s=parents.get(a),b=parents.get(s),ss=b?.statements,prev=ss?.[ss.indexOf(s)-1]?.expression;
   if(!assignment(a)||a.right!==c||callee(prev)!=='BoardCreate'){safe=false;break;}
  }
  if(safe&&creates&&color)boards.set(call,color);else reasons.push({kind:'board',name:g,position:call.pos,reason:'colour/handle invariant not proved'});
 }
 return {units,players,boards,reasons,counts:{unitReads:units.size,globalPlayerLoops:players.size,boardTitles:boards.size}};
}
export function stableGlobalPlayerLoop(loop,group){return active?.players.has(loop)??false;}
const ident=name=>({kind:113,name});const num=value=>({kind:2,text:String(value),value:String(value)});
const call=(name,args)=>({kind:121,expression:ident(name),arguments:args});
const binary=(left,kind,right)=>({kind:124,left,operatorToken:{kind},right});
const shipped=(name,ctx)=>{const d=ctx.funcNameToFuncDef.get(name);return d&&(d.library??ctx.nativeLibrary?.id)===(ctx.nativeLibrary?.id??'Ntve');};
export function nativeGuiRecipe(node,ctx){
 const c=node?.kind===138?node.expression:node;if(c?.kind!==121||!active)return undefined;
 let rewritten;
 if(callee(c)==='UnitGroupUnitFromEnd'&&active.units.has(c)){
  // Native index is int32 N-i; UnitGroupUnit uses int32 j-1. The same live
  // group/count is read at the original call site, not snapshotted at loop entry.
  const [g,i]=c.arguments;
  if(!shipped('UnitGroupUnit',ctx)||!shipped('UnitGroupCount',ctx))return undefined;
  rewritten=call('UnitGroupUnit',[g,binary(binary(call('UnitGroupCount',[g,ident('c_unitCountAll')]),21,i),20,num(1))]);
 }else if(callee(c)==='BoardTitleSetText'&&active.boards.has(c)){
  if(!shipped('BoardSetName',ctx))return undefined;
  rewritten=call('BoardSetName',[...c.arguments,call('Color',active.boards.get(c).map(num))]);
 }
 return rewritten?(node.kind===138?{...node,expression:rewritten}:rewritten):undefined;
}
