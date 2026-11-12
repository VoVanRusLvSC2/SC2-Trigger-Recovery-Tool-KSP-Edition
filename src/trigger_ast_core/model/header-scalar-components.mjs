// Select independent, already value-proved header components. This is only a
// plan: the caller must still prove entry timing, effects and the full root.
import assert from 'node:assert/strict';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

export function selectClosedHeaderComponents(asts,candidates,closedNames){
 assert(Array.isArray(asts)&&Array.isArray(candidates)&&closedNames instanceof Set);
 const byName=new Map(candidates.map(n=>[n.name.name,n]));
 assert.equal(byName.size,candidates.length,'HEADER_COMPONENT_DUPLICATE_CANDIDATE');
 assert([...closedNames].every(n=>byName.has(n)),'HEADER_COMPONENT_UNKNOWN_CLOSED_NAME');
 const globals=asts.flatMap(a=>a.statements.filter(n=>n.kind===K.VariableDeclaration));
 for(const name of byName.keys())assert.equal(globals.filter(n=>n.name.name===name).length,1,'HEADER_COMPONENT_GLOBAL_COLLISION');
 const graph=new Map([...byName.keys()].map(n=>[n,new Set()])),blocked=new Map();
 const refs=node=>{
  const found=new Set(),seen=new WeakSet();let visits=0;
  const visit=n=>{if(!n||seen.has(n))return;seen.add(n);assert(++visits<250000,'HEADER_COMPONENT_SCAN_BOUND');
   if(n.kind===K.Identifier&&byName.has(n.name))found.add(n.name);
   forEachChild(n,visit);
  };visit(node);return found;
 };
 for(const [name,n]of byName)for(const dependency of refs(n.initializer)){
  graph.get(name).add(dependency);graph.get(dependency).add(name);
 }
 for(const n of globals){
  if(!n.initializer||byName.has(n.name.name))continue;
  for(const name of refs(n.initializer)){
   const observers=blocked.get(name)??[];observers.push(n.name.name);blocked.set(name,observers);
  }
 }
 const seen=new Set(),components=[],selected=new Set();
 for(const start of byName.keys()){
  if(seen.has(start))continue;
  const pending=[start],names=[];
  while(pending.length){const name=pending.pop();if(seen.has(name))continue;seen.add(name);names.push(name);pending.push(...graph.get(name));}
  const unproved=names.filter(name=>!closedNames.has(name));
  const outsideObservers=names.flatMap(name=>(blocked.get(name)??[]).map(observer=>({name,observer})));
  const accepted=unproved.length===0&&outsideObservers.length===0;
  if(accepted)names.forEach(name=>selected.add(name));
  components.push({names,unproved,outsideObservers,selected:accepted});
 }
 return {selected:candidates.filter(n=>selected.has(n.name.name)),proof:{
  kind:'INDEPENDENT_VALUE_PROVED_HEADER_COMPONENTS',components,
  originalDeclarationOrderPreserved:true,initializerExpressionsUnchanged:true,
  timingOrEffectsProved:false,wholeProgramEquivalenceProved:false,sourceOrCandidateChanged:false}};
}
