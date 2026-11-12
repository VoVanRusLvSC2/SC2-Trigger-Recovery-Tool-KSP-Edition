// SDK naming rules are retained verbatim below; only the declaration reader changes.
// The state remains owned by the original SDK, shared with all existing emitters.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createConversionSyntaxProgram,parseConversionGalaxySyntax} from '../model/conversion-syntax-program.collections.mjs';
import {namingIndexes,mapParameterTypeToGalaxy} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {buildDependencyStructureBindings} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/dependency-structure-bindings.js';
import {lookupElementIn,refKey,libraryPrefix} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {matchDependencyFunctionDeclarations,matchDependencyVariableDeclarations} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/dependency-functions.js';
import {declaredLegacyLoopNativeNames} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/legacy-loop-native-names.js';
const localSyntax = new AsyncLocalStorage();
// Forward conversion also has a bounded, disposable syntax owner. A reverse
// conversion's existing syntax owner takes precedence, preserving node identity.
export function withSdkDeclarationSyntax(operation, report) {
  if(localSyntax.getStore()) return operation();
  const program=createConversionSyntaxProgram();
  try {return localSyntax.run(program,operation);}
  finally {const evidence=program.evidence();program.dispose();report?.(evidence);}
}
export function readSdkDeclaration(text,fileName='declarations.galaxy') {
  return parseConversionGalaxySyntax(text,fileName,()=>withSdkDeclarationSyntax(()=>localSyntax.getStore().parse(text,fileName)));
}
const declarationSources=declarations=>(declarations??[]).map((d,i)=>readSdkDeclaration(d.text,d.fileName??`dependency-${i}.galaxy`));
export function indexDependencyFunctionNames(declarations,libraries) {
  const target=namingIndexes().dependencyFunctionNames;target.clear();
  if(!declarations?.length)return;
  const sources=declarationSources(declarations),loaded=[...libraries];
  for(const [name,definition] of matchDependencyFunctionDeclarations(sources,loaded))target.set(refKey(definition,definition.library),name);
  for(const [key,name] of declaredLegacyLoopNativeNames(sources,loaded)){
    const existing=target.get(key);if(existing===undefined||existing===name)target.set(key,name);
  }
}
export function indexDependencyVariableNames(declarations,libraries) {
  const target=namingIndexes().dependencyVariableNames;target.clear();
  if(!declarations?.length)return;
  for(const [name,variable] of matchDependencyVariableDeclarations(declarationSources(declarations),libraries))target.set(refKey(variable,variable.library),name);
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
    const statements = [];
    const structureSources = [];
    for (const file of declarations ?? []) {
        const source = readSdkDeclaration(file.text, file.fileName ?? 'declarations.galaxy');
    structureSources.push(source);
        if (source.parseDiagnostics.length)
            continue;
        for (const declaration of source.statements) {
            statements.push(declaration);
            const name = declaration.name?.name;
            if (typeof name === 'string' && name)
                target.add(name);
        }
    }
    indexes.dependencyStructures = buildDependencyStructureBindings(structureSources,new Map(libraries.map(l=>[l.id,l])),(type,owner,all)=>mapParameterTypeToGalaxy(type,owner,undefined,all));

  // A unit filter is written by the editor as four bit masks over the
    // `c_targetFilter*` constants, so the flag names a document stores need both
    // the constant and its position. The position comes from the loaded headers,
    // never from a table of our own.
    const constantValues = new Map();
    for (const declaration of statements) {
        const node = declaration;
        const name = node.name?.name;
        const text = String(node.initializer?.text ?? node.initializer?.value ?? '');
        if (typeof name === 'string' && /^c_targetFilter/u.test(name) && /^\d+$/u.test(text))
            constantValues.set(name, Number(text));
    }
    // Both current canonical engine names and legacy preset display aliases
    // resolve to the same proven constant/bit; no guessed numerical table.
    const engineNames = new Map();
    for (const node of statements) {
        const name = node.name?.name;
        const value = node.initializer?.kind === 3 ? node.initializer.value : undefined;
        if (typeof name !== 'string' || !/^c_targetFilter[A-Za-z0-9_]+Name$/.test(name) ||
            typeof value !== 'string' || !/^[A-Za-z][A-Za-z0-9_]*$/.test(value)) continue;
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
            if (element.type !== 'PresetValue')
                continue;
            const constant = element.value;
            const identifier = element.identifier ?? element.name;
            if (!constant || !identifier || !constantValues.has(constant))
                continue;
            if (!indexes.unitFilterFlags.has(identifier)) {
                indexes.unitFilterFlags.set(identifier, { constant, bit: constantValues.get(constant) });
            }
        }
    }
    // Some packages retain native filter constants but omit their PresetValue
    // declarations. The constant name still supplies the editor's flag name.
    for (const [constant, bit] of constantValues) {
        const flag = constant.slice('c_targetFilter'.length);
        if (flag && Number.isInteger(bit) && bit >= 0 && bit < 64 && !indexes.unitFilterFlags.has(flag)) {
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
        const constants = statements.flatMap(statement => {
            const node = statement;
            const name = node.name?.name;
            const raw = node.initializer?.text ?? node.initializer?.value;
            const text = String(raw ?? '');
            if (typeof name !== 'string' || !name.startsWith(prefix) || !/^(?:\d+|0x[\da-f]+)$/iu.test(text))
                return [];
            return [{ name, value: Number(text), hex: /^0x/iu.test(text) }];
        });
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
                    if (current)
                        groups.push(current);
                }
                else
                    current.push(constant);
            }
            return groups;
        };
        const matchGroups = (presets, completeGroups) => {
            // Order-preserving maximum matching by group length. A value is indexed
            // only if its preset/group pair can occur in exactly one optimal alignment.
            const n = presets.length, m = completeGroups.length;
            const forward = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
            for (let i = 0; i < n; i++)
                for (let j = 0; j < m; j++) {
                    forward[i + 1][j + 1] = Math.max(forward[i][j + 1], forward[i + 1][j], forward[i][j] + (presets[i].values.length === completeGroups[j].length ? 1 : -n - m));
                }
            const backward = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
            for (let i = n - 1; i >= 0; i--)
                for (let j = m - 1; j >= 0; j--) {
                    backward[i][j] = Math.max(backward[i + 1][j], backward[i][j + 1], backward[i + 1][j + 1] + (presets[i].values.length === completeGroups[j].length ? 1 : -n - m));
                }
            const optimum = forward[n][m];
            const optimumWithoutPreset = (excluded) => {
                const score = Array.from({ length: n + 1 }, () => Array(m + 1).fill(0));
                for (let pi = 0; pi < n; pi++)
                    for (let gj = 0; gj < m; gj++) {
                        const matched = pi === excluded || presets[pi].values.length !== completeGroups[gj].length
                            ? -n - m
                            : score[pi][gj] + 1;
                        score[pi + 1][gj + 1] = Math.max(score[pi][gj + 1], score[pi + 1][gj], matched);
                    }
                return score[n][m];
            };
            for (let i = 0; i < n; i++) {
                const candidates = [];
                for (let j = 0; j < m; j++) {
                    if (presets[i].values.length === completeGroups[j].length &&
                        forward[i][j] + 1 + backward[i + 1][j + 1] === optimum)
                        candidates.push(j);
                }
                if (candidates.length !== 1 || optimumWithoutPreset(i) === optimum)
                    continue;
                const group = completeGroups[candidates[0]];
                for (let valueIndex = 0; valueIndex < presets[i].values.length; valueIndex++) {
                    const value = lookupElementIn(library, presets[i].values[valueIndex]);
                    if (value)
                        indexes.presetValueNames.set(refKey(value, library.id), group[valueIndex].name);
                }
            }
        };
        const presets = Object.values(library.elements).filter((element) => element.type === 'Preset' && !element.disabled &&
            element.values.every(ref => lookupElementIn(library, ref)?.type === 'PresetValue'));
        matchGroups(presets.filter(preset => !!preset.integer), sequentialGroups(false, 0, length => length));
        // PresetAsBits constants are emitted as a contiguous hexadecimal
        // 0x1,0x2,0x4... group. Requiring the hex spelling prevents an unrelated
        // decimal integer preset from being mistaken for a bit preset.
        matchGroups(presets.filter(preset => !!preset.asBits), sequentialGroups(true, 1, length => 2 ** length));
    }
}
