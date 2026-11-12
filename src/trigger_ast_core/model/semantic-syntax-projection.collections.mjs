// A private semantic graph can resolve types while source syntax stays intact.
// Preserve parent cycles, identity within one source, comment Maps and Sets.
function cloneSyntaxGraph(root) {
  const copies=new Map(),pending=[];
  const copy=value=>{
    if(!value||typeof value!=='object')return value;
    if(copies.has(value))return copies.get(value);
    const result=Array.isArray(value)?[]:value instanceof Map?new Map():value instanceof Set?new Set():Object.create(Object.getPrototypeOf(value));
    copies.set(value,result);pending.push([value,result]);return result;
  };
  const result=copy(root);
  while(pending.length){
    const [source,target]=pending.pop();
    if(source instanceof Map)for(const [key,value]of source)target.set(copy(key),copy(value));
    else if(source instanceof Set)for(const value of source)target.add(copy(value));
    for(const key of Reflect.ownKeys(source)){
      const descriptor=Object.getOwnPropertyDescriptor(source,key);
      if(!('value'in descriptor))throw Error('UNSUPPORTED_SYNTAX_ACCESSOR');
      if(Array.isArray(target)&&key==='length'){target.length=descriptor.value;continue;}
      Object.defineProperty(target,key,{value:copy(descriptor.value),writable:true,enumerable:descriptor.enumerable,configurable:true});
    }
  }
  return result;
}
export function projectSemanticGalaxySources(sources) {
  return sources.map(source=>Object.isFrozen(source)?cloneSyntaxGraph(source):source);
}
