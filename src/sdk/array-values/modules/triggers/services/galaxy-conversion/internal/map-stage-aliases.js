/** Recognize a renamed two- or three-stage map startup using the existing exact validator.
 * Only the validator sees aliases. Source bodies and converter references remain
 * original; the returned removed-function set is restored to source names.
 */
const skip=new Set(['parent','symbol','locals','flowNode']);
function walk(n,fn,parent,key){
 if(!n||typeof n!=='object')return;fn(n,parent,key);
 for(const [k,v]of Object.entries(n)){if(skip.has(k))continue;
  if(Array.isArray(v))v.forEach(x=>walk(x,fn,n,k));else if(v&&typeof v==='object')walk(v,fn,n,k);
 }
}
export function recognizeMapStageAliases(nodes,libraryId,validate,typeName){
 if(libraryId!=='Map')return undefined;
 const definitions=nodes.filter(n=>n.kind===142&&n.body),byName=new Map(definitions.map(n=>[n.name.name,n]));
 if(byName.size!==definitions.length)return undefined;
 const root=byName.get('InitMap');
 const callable=n=>n&&typeName(n.type)==='void'&&n.parameters.length===0&&n.body;
 if(!callable(root)||![2,3,4].includes(root.body.statements.length))return undefined;
 const calls=root.body.statements.map(n=>n.kind===138?n.expression:undefined);
 if(!calls.every(n=>n?.kind===121&&n.expression.kind===113&&n.arguments.length===0))return undefined;
 const extraCall=calls.length===4?calls[2]:undefined;
 const startupCalls=extraCall?calls.filter((_,i)=>i!==2):calls;
 const extraName=extraCall?.expression.name;
 const names=startupCalls.map(n=>n.expression.name),targets=startupCalls.length===2?['InitLibs','InitTriggers']:['InitLibs','InitGlobals','InitTriggers'];
 if(extraName&&(extraName==='InitMap'||names.includes(extraName)||!callable(byName.get(extraName))))return undefined;
 if(new Set(names).size!==startupCalls.length||names.some(n=>n==='InitMap'||!callable(byName.get(n))))return undefined;
 const aliases=new Map(names.map((n,i)=>[n,targets[i]]).filter(([a,b])=>a!==b));
 if(!aliases.size&&!extraName)return undefined;
 for(const [from,to]of aliases){
  if(nodes.some(n=>n.name?.name===to))return undefined;
  // Reject names embedded in strings, local/type namespaces or other calls.
  let safe=true;
  walk(nodes,(n,p,k)=>{
   if(n.kind===3&&new RegExp('(?:^|[^A-Za-z0-9_])'+from+'(?:$|[^A-Za-z0-9_])','u').test(String(n.value??n.text)))safe=false;
   if(n.kind===113&&n.name===from){
    if(p?.kind===142&&k==='name'&&p.parameters.length===0&&typeName(p.type)==='void')return;
    if(p?.kind===121&&k==='expression'&&calls.includes(p))return;
    safe=false;
   }
  });
  if(!safe)return undefined;
 }
 function clone(n){
  if(Array.isArray(n))return n.map(clone);if(!n||typeof n!=='object')return n;
  const out=Object.fromEntries(Object.entries(n).filter(([k])=>!skip.has(k)).map(([k,v])=>[k,clone(v)]));
  if(n.kind===113&&aliases.has(n.name))out.name=aliases.get(n.name);
  return out;
 }
 const projected=clone(nodes);
 if(extraName)projected.find(n=>n.kind===142&&n.body&&n.name.name==='InitMap').body.statements.splice(2,1);
 const result=validate(projected);
 if(!result)return undefined;
 const reverse=new Map([...aliases].map(([a,b])=>[b,a]));
 return {...result,...(extraName?{customScriptInitializers:[...(result.customScriptInitializers??[]),extraName],retainedExtraStage:{name:extraName,after:'globals',before:'triggers'}}:{}),functions:new Set([...result.functions].map(n=>reverse.get(n)??n)),stageAliases:[...aliases].map(([from,to])=>({from,to}))};
}
