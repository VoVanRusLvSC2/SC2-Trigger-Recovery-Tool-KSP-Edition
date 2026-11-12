import {createXmlEnvironment} from '../model/document-environment.mjs';

// Provenance only. This does not make disabled source metadata valid or change
// a benchmark verdict. Every incoming reference path must end at an unchanged
// explicitly disabled Trigger; callable functions and unknown owners refuse.
export function proveOriginalDisabledOwnership({before, after, targets, xmlTree}) {
 const issues=[], records=[];
 const observe=xml=>{
  const env=createXmlEnvironment(xmlTree(xml));
  const key=n=>env.key({type:n.attributes.Type,id:n.attributes.Id},n.scope??'');
  const nodes=new Map(env.nodes.map(n=>[key(n),n])), incoming=new Map(), outgoing=new Map();
  issues.push(...env.issues);
  for(const owner of env.nodes){
   const own=key(owner), refs=new Set();
   const visit=n=>{for(const child of n.children??[]){
    if(child.attributes.Type&&child.attributes.Id){
     const target=env.resolveNode(child,owner);
     if(target){const id=key(target);refs.add(id);if(!incoming.has(id))incoming.set(id,new Set());incoming.get(id).add(own);}
    }
    visit(child);
   }};
   visit(owner);outgoing.set(own,refs);
  }
  return {env,nodes,incoming,outgoing,key,bytes:n=>xml.slice(n.start,n.end)};
 };
 const a=observe(before),b=observe(after);
 for(const ref of targets){
  const id=a.env.key(ref,ref.library??''), failures=[],terminals=new Set(), visited=new Set();
  if(ref.type!=='FunctionCall'){issues.push({kind:'EXPECTED_FUNCTION_CALL',target:id});continue;}
  for(const [side,graph] of [['original',a],['candidate',b]]){
   const seen=new Set(),active=new Set();
   const walk=current=>{
    if(active.has(current)){failures.push({side,kind:'CYCLIC_OWNERSHIP',id:current});return;}
    if(seen.has(current))return;
    seen.add(current);visited.add(current);
    const n=graph.nodes.get(current);
    if(!n){failures.push({side,kind:'MISSING_OWNER',id:current});return;}
    if(n.attributes.Type==='Trigger'){
     if(!n.children.some(c=>c.tag==='Disabled'))failures.push({side,kind:'ENABLED_TRIGGER_OWNER',id:current});
     else terminals.add(current);
     return;
    }
    if(n.attributes.Type==='FunctionDef'||n.attributes.Type==='Variable'){
     failures.push({side,kind:'CALLABLE_OR_INITIALIZER_OWNER',id:current});return;
    }
    const parents=graph.incoming.get(current);
    if(!parents?.size){failures.push({side,kind:'UNOWNED_CALL_PATH',id:current});return;}
    active.add(current);for(const parent of parents)walk(parent);active.delete(current);
   };
   walk(id);
  }
  // Check the complete referenced graph of those owners too, including Param,
  // Variable and FunctionDef dependencies, without following external SDK data.
  const closure=new Set(),pending=[...visited];
  while(pending.length){
   const current=pending.pop();if(closure.has(current))continue;closure.add(current);
   const x=a.nodes.get(current),y=b.nodes.get(current);
   if(!x||!y||a.bytes(x)!==b.bytes(y))failures.push({kind:'ORIGINAL_NODE_CHANGED',id:current});
   const left=a.outgoing.get(current)??new Set(),right=b.outgoing.get(current)??new Set();
   if(JSON.stringify([...left].sort())!==JSON.stringify([...right].sort()))failures.push({kind:'REFERENCE_GRAPH_CHANGED',id:current});
   pending.push(...left,...right);
  }
  if(!terminals.size)failures.push({kind:'NO_DISABLED_TRIGGER_OWNER'});
  records.push({target:id,passed:failures.length===0,disabledTriggers:[...terminals].sort(),unchangedDependencyNodes:closure.size,issues:failures});
  issues.push(...failures.map(f=>({target:id,...f})));
 }
 return {kind:'RETAINED_ORIGINAL_DISABLED_TRIGGER_OWNERSHIP',passed:targets.length>0&&issues.length===0,
  records,issues,semanticEquivalenceProved:false,sourceMetadataValidityProved:false,benchmarkVerdictChanged:false};
}
