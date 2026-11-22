import { readSdkDeclaration } from '../exact-function-signatures/sdk-declaration-source.shared-ast.mjs';
export {
  readSdkDeclaration,
  withSdkDeclarationSyntax,
} from '../exact-function-signatures/sdk-declaration-source.shared-ast.mjs';
// SDK naming rules are retained verbatim below; only the declaration reader changes.
// The state remains owned by the original SDK, shared with all existing emitters.
import { namingIndexes } from './ttg-core.js';
import { mapParameterTypeToGalaxy } from './types-alternate.mjs';
import { buildDependencyStructureBindings } from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/dependency-structure-bindings.js';
import {
  lookupElementIn,
  refKey,
  libraryPrefix,
} from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {
  matchDependencyFunctionDeclarations,
  matchDependencyVariableDeclarations,
} from '../exact-native-source-identity/dependency-functions.js';
import { declaredLegacyLoopNativeNames } from '../exact-native-source-identity/legacy-loop-native-names.js';
const declarationSources = (declarations) =>
  (declarations ?? []).map((d, i) =>
    readSdkDeclaration(d.text, d.fileName ?? `dependency-${i}.galaxy`),
  );
export function indexDependencyFunctionNames(declarations, libraries) {
  const target = namingIndexes().dependencyFunctionNames;
  target.clear();
  if (!declarations?.length) return;
  const sources = declarationSources(declarations),
    loaded = [...libraries];
  for (const [name, definition] of matchDependencyFunctionDeclarations(sources, loaded))
    target.set(refKey(definition, definition.library), name);
  for (const [key, name] of declaredLegacyLoopNativeNames(sources, loaded)) {
    const existing = target.get(key);
    if (existing === undefined || existing === name) target.set(key, name);
  }
}
export function indexDependencyVariableNames(declarations, libraries) {
  const target = namingIndexes().dependencyVariableNames;
  target.clear();
  if (!declarations?.length) return;
  for (const [name, variable] of matchDependencyVariableDeclarations(
    declarationSources(declarations),
    libraries,
  ))
    target.set(refKey(variable, variable.library), name);
}
export function indexDeclaredGalaxySymbols(declarations, libraryInput = []) {
  // Read twice below (filter flags, then presets): the forward converter passes `Map.values()`, and a
  // second pass over a spent iterator saw no library, so every dependency preset constant came out as
  // its number in Triggers -> Galaxy (AerialEvacuation: 76 of 82 libCOMI_ge_* constants).
  const libraries = [...libraryInput];
  const indexes = namingIndexes();
  const target = indexes.declaredSymbols;
  target.clear();
  indexes.presetValueNames.clear();
  indexes.unitFilterFlags.clear();
  const initialized = [];
  const structureSources = [];
  for (const file of declarations ?? []) {
    const source = readSdkDeclaration(file.text, file.fileName ?? 'declarations.galaxy');
    structureSources.push(source);
    if (source.parseDiagnostics.length) continue;
    for (const declaration of source.statements) {
      const name = declaration.name?.name;
      if (typeof name !== 'string' || !name) continue;
      target.add(name);
      if (declaration.initializer) initialized.push(declaration);
    }
  }
  indexes.dependencyStructures = buildDependencyStructureBindings(
    structureSources,
    new Map(libraries.map((l) => [l.id, l])),
    (type, owner, all) => mapParameterTypeToGalaxy(type, owner, undefined, all),
  );

  // A unit filter is written by the editor as four bit masks over the
  // `c_targetFilter*` constants, so the flag names a document stores need both
  // the constant and its position. The position comes from the loaded headers,
  // never from a table of our own.
  const constantValues = new Map();
  for (const node of initialized) {
    const name = node.name?.name;
    if (!name.startsWith('c_targetFilter')) continue;
    const text = String(node.initializer?.text ?? node.initializer?.value ?? '');
    if (/^\d+$/u.test(text)) constantValues.set(name, Number(text));
  }
  // Both current canonical engine names and legacy preset display aliases
  // resolve to the same proven constant/bit; no guessed numerical table.
  const engineNames = new Map();
  for (const node of initialized) {
    const name = node.name?.name;
    const value = node.initializer?.kind === 3 ? node.initializer.value : undefined;
    if (
      typeof name !== 'string' ||
      !/^c_targetFilter[A-Za-z0-9_]+Name$/.test(name) ||
      typeof value !== 'string' ||
      !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)
    )
      continue;
    const constant = name.slice(0, -4);
    const prior = engineNames.get(constant);
    engineNames.set(constant, prior === undefined || prior === value ? value : null);
  }
  for (const [constant, flag] of engineNames) {
    const bit = constantValues.get(constant);
    if (flag && Number.isInteger(bit) && bit >= 0 && bit < 64)
      indexes.unitFilterFlags.set(flag, { constant, bit });
  }
  for (const library of libraries) {
    for (const element of Object.values(library.elements ?? {})) {
      if (element.type !== 'PresetValue') continue;
      const constant = element.value;
      const identifier = element.identifier ?? element.name;
      if (!constant || !identifier || !constantValues.has(constant)) continue;
      if (!indexes.unitFilterFlags.has(identifier)) {
        indexes.unitFilterFlags.set(identifier, { constant, bit: constantValues.get(constant) });
      }
    }
  }
  // Some packages retain native filter constants but omit their PresetValue
  // declarations. The constant name still supplies the editor's flag name.
  for (const [constant, bit] of constantValues) {
    const flag = constant.slice('c_targetFilter'.length);
    if (
      flag &&
      Number.isInteger(bit) &&
      bit >= 0 &&
      bit < 64 &&
      !indexes.unitFilterFlags.has(flag)
    ) {
      indexes.unitFilterFlags.set(flag, { constant, bit });
    }
  }
  // A stripped dependency can lose every localized preset/value name and may
  // even omit PresetGenConstVar although its shipped header still declares the
  // generated constants. The header remains authoritative.
  // PresetInteger always emits 0..N-1 in XML order. Some editor documents
  // retain stale per-value scalars (including booleans); they do not override
  // the ordinal integer contract.
  // Align those complete groups only when the ordered match is unambiguous.
  for (const library of libraries) {
    const prefix = `${libraryPrefix(library.id)}ge_`;
    const constants = [];
    for (const node of initialized) {
      const name = node.name?.name;
      if (!name.startsWith(prefix)) continue;
      const raw = node.initializer?.text ?? node.initializer?.value;
      const text = String(raw ?? '');
      if (/^(?:\d+|0x[\da-f]+)$/iu.test(text))
        constants.push({ name, value: Number(text), hex: /^0x/iu.test(text) });
    }
    const sequentialGroups = (hex, first, next) => {
      const groups = [];
      let current;
      for (const constant of constants) {
        if (constant.hex !== hex) {
          current = undefined;
          continue;
        }
        if (!current || constant.value !== next(current.length)) {
          current = constant.value === first ? [constant] : undefined;
          if (current) groups.push(current);
        } else current.push(constant);
      }
      return groups;
    };
    const matchGroups = (presets, completeGroups) => {
      // Match equal lengths in order. Index a pair only when every optimal
      // alignment uses that same preset and group together.
      const n = presets.length,
        m = completeGroups.length;
      if (!n || !m) return;
      const presetLengths = presets.map(({ values }) => values.length);
      const groupLengths = completeGroups.map(({ length }) => length);
      const forward = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
      for (let i = 0; i < n; i++)
        for (let j = 0; j < m; j++) {
          forward[i + 1][j + 1] = Math.max(
            forward[i][j + 1],
            forward[i + 1][j],
            presetLengths[i] === groupLengths[j] ? forward[i][j] + 1 : 0,
          );
        }
      const backward = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1));
      for (let i = n - 1; i >= 0; i--)
        for (let j = m - 1; j >= 0; j--) {
          backward[i][j] = Math.max(
            backward[i + 1][j],
            backward[i][j + 1],
            presetLengths[i] === groupLengths[j] ? backward[i + 1][j + 1] + 1 : 0,
          );
        }
      const optimum = forward[n][m];
      if (!optimum) return;
      presets: for (let i = 0; i < n; i++) {
        let candidate = -1;
        for (let j = 0; j < m; j++) {
          // An alignment that skips this preset splits the groups at some j.
          // The best scores on either side are already in the two tables.
          if (forward[i][j] + backward[i + 1][j] === optimum) continue presets;
          if (
            presetLengths[i] === groupLengths[j] &&
            forward[i][j] + 1 + backward[i + 1][j + 1] === optimum
          ) {
            if (candidate !== -1) continue presets;
            candidate = j;
          }
        }
        if (candidate === -1 || forward[i][m] === optimum) continue;
        const group = completeGroups[candidate];
        for (let valueIndex = 0; valueIndex < presets[i].values.length; valueIndex++) {
          const value = lookupElementIn(library, presets[i].values[valueIndex]);
          if (value)
            indexes.presetValueNames.set(refKey(value, library.id), group[valueIndex].name);
        }
      }
    };
    const presets = Object.values(library.elements).filter(
      (element) =>
        element.type === 'Preset' &&
        !element.disabled &&
        element.values.every((ref) => lookupElementIn(library, ref)?.type === 'PresetValue'),
    );
    matchGroups(
      presets.filter((preset) => !!preset.integer),
      sequentialGroups(false, 0, (length) => length),
    );
    // PresetAsBits constants are emitted as a contiguous hexadecimal
    // 0x1,0x2,0x4... group. Requiring the hex spelling prevents an unrelated
    // decimal integer preset from being mistaken for a bit preset.
    matchGroups(
      presets.filter((preset) => !!preset.asBits),
      sequentialGroups(true, 1, (length) => 2 ** length),
    );
  }
}
