import { createHash } from 'node:crypto';

export function normalizeGuiLibrary(library) {
  const elements = library?.elements ?? {};
  const elementForRef = ref => {
    if (ref.library && ref.library !== library?.id) return undefined;
    return elements[`${ref.type}:${ref.id}`] ?? elements[ref.id];
  };
  const makeNormalizer = () => {
    const referenced = new Map();
    let nextReference = 0;
    function normalizeElement(element) {
      return Object.fromEntries(Object.keys(element).sort().flatMap(key => {
        if (key === 'id' || key === 'library' || key === 'elementsByType') return [];
        const value = normalize(element[key]);
        return value === undefined ? [] : [[key, value]];
      }));
    }
    function normalize(value) {
      if (Array.isArray(value)) return value.map(normalize);
      if (!value || typeof value !== 'object') return value;
      if (typeof value.id === 'string' && typeof value.type === 'string'
          && Object.keys(value).every(key => ['id', 'type', 'library'].includes(key))) {
        const target = elementForRef(value);
        if (!target || target.type !== value.type) {
          return { externalType: value.type, externalLibrary: value.library ?? '', externalId: value.id };
        }
        const elementKey = `${value.type}:${value.id}`;
        if (referenced.has(elementKey)) return { ref: referenced.get(elementKey) };
        const ref = nextReference++;
        referenced.set(elementKey, ref);
        return { ref, element: normalizeElement(target) };
      }
      return Object.fromEntries(Object.keys(value).sort().flatMap(key => {
        if (key === 'id' || key === 'library' || key === 'elementsByType') return [];
        const child = normalize(value[key]);
        return child === undefined ? [] : [[key, child]];
      }));
    }
    return { normalize, normalizeElement, referenced };
  };

  const expandCategory = (ref, seen = new Set()) => {
    const element = elementForRef(ref);
    if (element?.type !== 'Category') return [ref];
    const key = `${ref.type}:${ref.id}`;
    if (seen.has(key)) return [];
    const nextSeen = new Set(seen).add(key);
    return (element.items ?? []).flatMap(item => expandCategory(item, nextSeen));
  };
  const rootRefs = Array.isArray(library?.rootRefs)
    ? library.rootRefs
    : (library?.items ?? []).map(({ id, type, library: libraryId }) => ({ id, type, library: libraryId }));
  const roots = rootRefs.flatMap(ref => expandCategory(ref));
  const nonSemanticTypes = new Set(['Category', 'Param', 'ParamDef']);
  const typeCounts = Object.values(elements).reduce((counts, element) => {
    if (!nonSemanticTypes.has(element.type)) counts[element.type] = (counts[element.type] ?? 0) + 1;
    return counts;
  }, {});
  const rootNormalizer = makeNormalizer();
  const normalizedRoots = roots.map(rootNormalizer.normalize);
  const orphanSignatures = Object.values(elements)
    .filter(element => element.type !== 'Category' && !rootNormalizer.referenced.has(`${element.type}:${element.id}`))
    .map(element => JSON.stringify(makeNormalizer().normalizeElement(element)))
    .sort();
  const canonical = {
    implicit: library?.implicit === true,
    roots: normalizedRoots,
    orphanSignatures,
    typeCounts: Object.fromEntries(Object.entries(typeCounts).sort(([left], [right]) => left.localeCompare(right))),
  };
  return canonical;
}

export function guiLibrarySignature(library) {
  return createHash('sha256').update(JSON.stringify(normalizeGuiLibrary(library))).digest('hex');
}
