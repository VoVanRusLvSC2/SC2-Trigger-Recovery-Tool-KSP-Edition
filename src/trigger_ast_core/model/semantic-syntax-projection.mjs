// Type resolution is allowed to annotate a semantic view, never the shared
// immutable source syntax. Preserve parent links, source spans, source text,
// arrays and shared subnodes without printing or reparsing Galaxy.
function cloneSyntaxGraph(root) {
  const copies = new Map(), pending = [];
  const copy = value => {
    if (!value || typeof value !== 'object') return value;
    if (copies.has(value)) return copies.get(value);
    const result = Array.isArray(value) ? [] : Object.create(Object.getPrototypeOf(value));
    copies.set(value, result);pending.push([value,result]);return result;
  };
  const result = copy(root);
  while (pending.length) {
    const [source,target] = pending.pop();
    for (const key of Reflect.ownKeys(source)) {
      const descriptor = Object.getOwnPropertyDescriptor(source,key);
      if (!('value' in descriptor)) throw Error('UNSUPPORTED_SYNTAX_ACCESSOR');
      if (Array.isArray(target)&&key==='length') { target.length=descriptor.value;continue; }
      Object.defineProperty(target,key,{value:copy(descriptor.value),writable:true,enumerable:descriptor.enumerable,configurable:true});
    }
  }
  return result;
}
export function projectSemanticGalaxySources(sources) {
  // Each logical source retains its own semantic identity, even if two sources
  // happen to share one identical immutable syntax view.
  return sources.map(source=>Object.isFrozen(source)?cloneSyntaxGraph(source):source);
}
