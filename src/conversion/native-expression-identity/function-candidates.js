/** Candidate identity is library/type/id, never a display-name last write. */
import { singleCallTemplateAlias } from './single-call-template-alias.js';
import { mapParameterTypeToGalaxy } from './ttg-core.js';
const key = (d, l) => `${d.library ?? l.id}:FunctionDef:${d.id}`;
const sanitize = (s) => s.replace(/[^A-Za-z0-9_]/gu, '').replace(/^[^A-Za-z_]+/u, '');
export class FunctionCandidateIndex {
  bySymbol = new Map();
  libraries = new Map();
  constructor(libraries) {
    for (const l of libraries) {
      const prior = this.libraries.get(l.id);
      if (prior && prior !== l) throw new Error('Conflicting active library identity ' + l.id);
      this.libraries.set(l.id, l);
    }
    const add = (symbol, d, l, origin) => {
      if (!symbol) return;
      const group = this.bySymbol.get(symbol) ?? [];
      const id = key(d, l),
        old = group.find((c) => c.key === id);
      if (old) {
        if (old.origin !== 'emitted' && origin === 'emitted') old.origin = origin;
        return;
      }
      group.push({ definition: d, library: l, symbol, origin, key: id });
      this.bySymbol.set(symbol, group);
    };
    for (const library of this.libraries.values())
      for (const d of Object.values(library.elementsByType?.FunctionDef ?? {})) {
        if (d.disabled) continue;
        if (d.name) {
          if (/^[A-Za-z_]\w*$/u.test(d.name))
            add(
              d.name,
              d,
              library,
              d.flags?.includes('Native') || d.flags?.includes('NoScriptPrefix')
                ? 'emitted'
                : 'identifier',
            );
          const sanitized = sanitize(d.name);
          if (sanitized && sanitized !== d.name) add(sanitized, d, library, 'identifier');
          if (!d.flags?.includes('Native') && !d.flags?.includes('NoScriptPrefix'))
            add(`lib${library.id}_gf_${sanitized}`, d, library, 'emitted');
        }
        if (d.identifier && d.identifier !== d.name) add(d.identifier, d, library, 'identifier');
        if (d.scriptCode) {
          const alias = singleCallTemplateAlias(d, library);
          if (alias) add(alias, d, library, 'template');
        }
      }
  }
  formal(ref, owner) {
    if (!ref || (ref.type && ref.type !== 'ParamDef')) return undefined;
    return this.libraries.get(ref.library ?? owner.id)?.elementsByType?.ParamDef?.[ref.id];
  }
  carrier(type, owner) {
    if (!type || type.type === 'void') return 'void';
    if (!type.type || ['any', 'sameas', 'anycompare', 'anyvariable', 'return'].includes(type.type))
      return undefined;
    try {
      return mapParameterTypeToGalaxy(type, owner, this.libraries.get('Ntve'), this.libraries);
    } catch {
      return undefined;
    }
  }
  resolve(query) {
    let candidates = [...(this.bySymbol.get(query.name) ?? [])];
    const rejected = [];
    const remove = (condition, reason) => {
      candidates = candidates.filter((c) => {
        if (condition(c)) return true;
        rejected.push({ key: c.key, reason });
        return false;
      });
    };
    if (query.libraryId) remove((c) => c.library.id === query.libraryId, 'library-ownership');
    remove(
      (c) => (c.definition.parameters ?? []).every((r) => !!this.formal(r, c.library)),
      'unresolved-ParamDef',
    );
    if (query.declaration)
      remove((c) => {
        const d = c.definition,
          hidden = d.flags?.includes('Event') && d.flags?.includes('Native') ? 1 : 0;
        if (hidden && query.declaration.parameters[0] !== 'trigger') return false;
        if ((d.parameters ?? []).length + hidden !== query.declaration.parameters.length)
          return false;
        const r = this.carrier(d.returnType, c.library);
        if (r && r !== query.declaration.returnType) return false;
        return d.parameters.every((ref, i) => {
          const formal = this.formal(ref, c.library),
            type = this.carrier(formal.paramType, c.library);
          return type === undefined || type === query.declaration.parameters[i + hidden];
        });
      }, 'native-declaration-ABI');
    if (query.expectedGuiType)
      remove(
        (c) => JSON.stringify(c.definition.returnType) === JSON.stringify(query.expectedGuiType),
        'GUI-return-type',
      );
    if (query.ancestor)
      remove((c) => {
        const match = c.definition.scriptCode?.match(
          /^\s*#AUTOVAR\([^,]+,\s*ancestor:([^()]+)\)\s*$/u,
        );
        return !match || query.ancestor.includes(match[1]);
      }, 'GUI-ancestor');
    // A proved emitted native beats a template alias; do not prefer either of
    // two equal native definitions, even if their carrier signature is equal.
    if (candidates.some((c) => c.origin === 'emitted'))
      remove((c) => c.origin === 'emitted', 'not-the-emitted-symbol');
    const keys = candidates.map((c) => c.key).sort();
    return {
      status:
        candidates.length === 1
          ? 'RESOLVED'
          : candidates.length > 1
            ? 'AMBIGUOUS'
            : rejected.length
              ? 'SIGNATURE_MISMATCH'
              : 'UNRESOLVED',
      ...(candidates.length === 1 ? { definition: candidates[0].definition } : {}),
      candidateKeys: keys,
      rejected,
    };
  }
  uniqueMap() {
    const map = new Map();
    for (const name of this.bySymbol.keys()) {
      const r = this.resolve({ name });
      if (r.status === 'RESOLVED') map.set(name, r.definition);
    }
    return map;
  }
}
/** Order GUI values by exact ParamDef links. Hidden Event trigger is separate.
 * Preserve the whole formal metadata object; never turn preset/string domains
 * into the Galaxy carrier or synthesize a replacement typeElement.
 */
export function bindTypedArguments(index, definition, args, options = {}) {
  const owner = index.libraries.get(definition.library ?? 'Ntve');
  if (!owner) throw new Error('Unknown FunctionDef owner');
  const hidden =
    definition.flags?.includes('Native') && definition.flags?.includes('Event') ? 1 : 0;
  if (args.length !== definition.parameters.length + hidden)
    throw new Error('Wrong argument count for typed FunctionDef');
  const seen = new Set();
  const parameters = definition.parameters.map((ref, i) => {
    const formal = index.formal(ref, owner);
    if (!formal) throw new Error('Unresolved formal ParamDef');
    const identity = `${ref.library ?? owner.id}:${ref.id}`;
    if (seen.has(identity)) throw new Error('Duplicate ParamDef in signature');
    seen.add(identity);
    return {
      parameterDef: { ...ref, type: 'ParamDef' },
      formal: structuredClone(formal),
      value: args[i + hidden],
      sourceArgumentIndex: i + hidden,
    };
  });
  return { parameters, hiddenTrigger: hidden ? args[0] : undefined };
}
