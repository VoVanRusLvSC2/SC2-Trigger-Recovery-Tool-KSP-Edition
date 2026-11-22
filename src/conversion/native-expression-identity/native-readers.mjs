// A pure zero-argument native call must link to its genuine loaded GUI getter.

// Keep its exact symbol (including Deprecated); never substitute a modern

// AUTOVAR getter, invent a function, or change native iterator semantics.

import { generateId } from './g2t-core.generated-call-provenance.mjs';

export function bindZeroArgumentNativeReaders(
  elements,
  libId,
  nativeLibrary,
  dependencies,
  funcNames,
) {
  const readers = [];
  for (const parameter of Object.values(elements)) {
    if (
      parameter.type !== 'Param' ||
      !parameter.scriptCode ||
      parameter.functionCall ||
      parameter.variable ||
      parameter.preset ||
      parameter.valueElement ||
      parameter.expressionCode
    )
      continue;
    const match = /^([A-Za-z][A-Za-z0-9_]*)\s*\(\s*\)$/u.exec(parameter.scriptCode.trim());
    if (!match) continue;
    const name = match[1];
    const own = funcNames?.get(name);
    if (own && (own.library ?? libId) === libId && !own.unresolvedGuiBinding) continue;
    readers.push({ parameter, name });
  }
  if (!readers.length) return [];
  const wanted = new Set(readers.map(({ name }) => name));
  const libraries = new Map(dependencies ?? []);
  if (nativeLibrary) libraries.set(nativeLibrary.id, nativeLibrary);

  const index = new Map();

  for (const l of libraries.values())
    if (l.id !== libId)
      for (const f of Object.values(l.elements ?? {}))
        if (
          f.type === 'FunctionDef' &&
          f.flags?.includes('Native') &&
          f.flags.includes('Call') &&
          f.isFuncCall &&
          !f.disabled &&
          !f.scriptCode &&
          !(f.parameters ?? []).length &&
          f.returnType?.type
        ) {
          const name = f.identifier ?? f.name;
          if (!wanted.has(name)) continue;

          const list = index.get(name) ?? [];
          list.push({ f, l });
          index.set(name, list);
        }

  const changes = [];

  for (const { parameter: p, name } of readers) {
    const matches = (index.get(name) ?? []).filter(
      ({ f }) => f.returnType.type === p.valueType?.type,
    );
    if (matches.length !== 1) continue;

    const { f, l } = matches[0],
      id = generateId();

    elements[id] = {
      type: 'FunctionCall',
      library: libId,
      id,
      functionDef: { type: 'FunctionDef', library: l.id, id: f.id },
    };

    p.functionCall = { type: 'FunctionCall', library: libId, id };
    delete p.scriptCode;

    changes.push({
      parameter: p.id,
      name,
      loadedLibrary: l.id,
      loadedDefinition: f.id,
      returnType: f.returnType.type,
      exactSymbolPreserved: true,
    });
  }

  return changes;
}
