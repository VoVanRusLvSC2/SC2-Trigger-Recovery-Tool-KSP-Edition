/** A conversion-owned view of existing GUI definitions. This catalog never
 * invents a FunctionDef, target parameter, carrier or script implementation. */
export function createGuiCapabilityCatalog(entries) {
  const libraries=new Map(),elements=new Map(),byOwner=new Map(),issues=[];
  const key=(owner,type,id)=>JSON.stringify([owner,type,id]);
  for(const [owner,library] of entries) {
    if(libraries.has(owner)) {
      if(libraries.get(owner)!==library)issues.push({kind:'AMBIGUOUS_LIBRARY_OWNER',owner});
      continue;
    }
    libraries.set(owner,library);
    const seen=new Set();
    for(const element of [...Object.values(library.elements??{}),...Object.values(library.elementsByType??{}).flatMap(Object.values)]) {
      if(seen.has(element))continue;seen.add(element);
      const k=key(owner,element.type,element.id),rows=elements.get(k)??[];
      rows.push(element);elements.set(k,rows);
      if(rows.length>1)issues.push({kind:'AMBIGUOUS_TYPED_GUI_ELEMENT',owner,type:element.type,id:element.id});
      if(element.library!==undefined&&element.library!==owner)issues.push({kind:'GUI_OWNER_MISMATCH',owner,type:element.type,id:element.id});
    }
    byOwner.set(owner,[...seen]);
  }
  const invalidOwners=new Set(issues.filter(i=>i.kind==='AMBIGUOUS_LIBRARY_OWNER').map(i=>i.owner));
  function resolve(ref,owner,expectedType=ref?.type) {
    if(!ref||!expectedType||ref.type!==undefined&&ref.type!==expectedType)return undefined;
    const library=ref.library??owner;if(invalidOwners.has(library))return undefined;
    const rows=elements.get(key(library,expectedType,ref.id));
    return rows?.length===1&&(rows[0].library===undefined||rows[0].library===library)?rows[0]:undefined;
  }
  const eventContainers=[],structureFormals=[];
  for(const [owner,owned]of byOwner)for(const e of owned) {
    if(resolve({type:e.type,id:e.id,library:owner},owner)!==e)continue;
    if(e.type==='ParamDef'&&e.paramType?.type==='struct') {
      const structure=resolve(e.paramType.typeElement,owner,'Structure');
      structureFormals.push({owner,formal:e,structure,status:structure?'RESOLVED':'UNRESOLVED_STRUCTURE_OWNER'});
    }
    if(e.type!=='FunctionDef'||!e.flags?.includes('Action')||!e.flags.includes('SubFunctions')||e.flags.includes('Native')||e.disabled||e.returnType&&e.returnType.type!=='void')continue;
    const roles=(e.subFunctionTypes??[]).map(ref=>resolve(ref,owner,'SubFuncType'));
    if(!roles.length||roles.some(r=>!r?.isEvent))continue;
    const parameters=(e.parameters??[]).map(ref=>resolve(ref,owner,'ParamDef'));
    eventContainers.push({owner,definition:e,roles,parameters,
      implicitTarget:parameters.length===0,
      bodiless:!e.scriptCode&&!e.expressionCode&&!e.actions?.length&&!e.localVariables?.length,
      allParametersResolved:parameters.every(Boolean),
      explicitTargetProved:false});
  }
  return Object.freeze({issues:Object.freeze(issues),resolve,
    eventContainers:Object.freeze(eventContainers),structureFormals:Object.freeze(structureFormals),
    implicitEventContainer(owner) {
      if(invalidOwners.has(owner))return {status:'AMBIGUOUS'};
      const matches=eventContainers.filter(e=>e.owner===owner&&e.implicitTarget&&e.bodiless&&e.roles.length===1);
      return matches.length===1?{status:'RESOLVED',...matches[0]}:{status:matches.length?'AMBIGUOUS':'UNRESOLVED'};
    },
    evidence(){return {kind:'EXISTING_TYPED_GUI_CAPABILITIES',issues,
      eventContainers:eventContainers.map(e=>({owner:e.owner,id:e.definition.id,identifier:e.definition.identifier,
        parameterCount:e.parameters.length,implicitTarget:e.implicitTarget,bodiless:e.bodiless,explicitTargetProved:false})),
      structureFormals:structureFormals.map(e=>({owner:e.owner,id:e.formal.id,status:e.status,structure:e.formal.paramType.typeElement})),
      newDefinitions:0,newNative:0,newCustomScript:0,persistentCache:false};}
  });
}
