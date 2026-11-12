// GUI emits local initializers in the local-variable list's declaration order.
// An original read of a not-yet-initialized local is preserved when that whole
// order already agrees. It is a dependency barrier only if emission reorders it.
export function hasExactLocalInitializerOrder(declarations,initializers){
 const declared=declarations.map(d=>d.name?.name),source=initializers.map(v=>v.name);
 if(declared.some(n=>!n)||source.some(n=>!n)||new Set(declared).size!==declared.length||new Set(source).size!==source.length)return false;
 const selected=new Set(source),emitted=declared.filter(n=>selected.has(n));
 return emitted.length===source.length&&emitted.every((name,index)=>name===source[index]);
}
