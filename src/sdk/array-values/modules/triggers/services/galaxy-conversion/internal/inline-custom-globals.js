/** Retain authored inline global initialization in an existing CustomScript stage, or inert const-null header.
 * GUI Variables initialize at InitVariables time. Moving a raw source initializer
 * there can change what called functions observe (e.g. Starcode's alphabet).
 * References are converted to supported typed ScriptCode parameters, then the
 * exact declarations are carried by a normal CustomScript element. Unknown
 * references, arrays, structures, foreign ownership and duplicate names refuse.
 */
export function retainInlineCustomGlobals({statements,elements,globalVars,libId,initialization,printNode,getTypeName,idFromKey}){
 const existingStage=Boolean(initialization?.customScriptInitializers);
 const counts=new Map();for(const n of statements)if(n.kind===141)counts.set(n.name.name,(counts.get(n.name.name)??0)+1);
 const accepted=[];
 const scalarTypes=new Set(['bool','byte','int','fixed','string','text','color','point','region','unit','unitgroup','playergroup','timer','bank','dialog','control','trigger','sound','actor','marker','order','abilcmd','wave','wavetarget','camerainfo']);
 for(const n of statements){
  if(n.kind!==141||!n.initializer||counts.get(n.name.name)!==1)continue;
  const name=n.name.name,ref=globalVars.get(name),v=ref&&elements[ref.id];
  if(!ref||ref.library!==libId||v?.type!=='Variable'||v.isArray||v.variableType?.typeElement||!scalarTypes.has(getTypeName(n.type)))continue;
  const constant=(n.modifiers??[]).some(m=>m.kind===53);
  // Without an existing stage, only exact const null declarations are inert.
  // Runtime initializers still refuse: never move their side effects.
  if(!existingStage&&!(constant&&n.initializer.kind===69))continue;
  // Primitive constants already have correct header semantics. Handle const
  // declarations are raw Galaxy; preserve their exact initializer/const ABI too.
  if(constant&&['bool','byte','int','fixed','string'].includes(getTypeName(n.type)))continue;
  const parameters=[];let safe=true;
  const walk=(o,parent,key)=>{if(!o||typeof o!=='object')return;if(Array.isArray(o)){for(const x of o)walk(x,o);return;}
   if(o.type==='Variable'&&o.id===ref.id&&(o.library??libId)===libId){
    if(parent?.type!=='Param'||key!=='variable'||parent.indices?.length||parent.structMember||parent.array){safe=false;return;}
    parameters.push(parent);return;
   }
   for(const [k,x] of Object.entries(o))walk(x,o,k);
  };
  for(const e of Object.values(elements))if(e!==v)walk(e);
  if(!safe)continue;
  accepted.push({n,name,ref,v,parameters});
 }
 if(!accepted.length)return [];
 const id=idFromKey(`${libId}|custom-script|authored-inline-globals`);
 if(elements[id])throw Error('Inline global CustomScript identity collision');
 for(const {name,ref,v,parameters} of accepted){
  for(const p of parameters){delete p.variable;p.scriptCode=name;p.valueType??=v.variableType;}
  delete elements[ref.id];globalVars.delete(name);
 }
 elements[id]={type:'CustomScript',id,library:libId,name:'Authored Inline Global Declarations',scriptCode:accepted.map(a=>printNode(a.n)).join('\n')};
 return accepted.map(a=>({name:a.name,rule:existingStage?'SOURCE_INLINE_GLOBAL_IN_EXISTING_CUSTOM_SCRIPT_STAGE':'SOURCE_CONST_NULL_HEADER'}));
}
