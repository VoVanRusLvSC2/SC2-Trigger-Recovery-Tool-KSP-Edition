import { declaredLegacyLoopNativeNames } from './legacy-loop-native-names.js';
import { Parser, SyntaxKind } from '../../sdk/array-values/modules/galaxy/language-core/index.js';
import {
  globalVariableSpellings,
  globalVariables,
  libraryPrefix,
  refKey,
  sanitizeIdentifier,
} from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
function orderedCallableDefinitions(library) {
  const result = [];
  const seen = new Set();
  const visit = (candidate) => {
    if (!candidate.type) return;
    const element = library.elementsByType?.[candidate.type]?.[candidate.id] ?? candidate;
    const key = `${element.type}:${element.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (element.type === 'FunctionDef') {
      const definition = element;
      // Disabled definitions are not emitted. SubFunctions and operators are
      // expanded inside their parent and do not receive standalone functions
      // in the generated Galaxy header.
      if (
        !definition.disabled &&
        !definition.flags?.some(
          (flag) => flag === 'SubFunctions' || flag === 'Operator' || flag === 'Template',
        )
      )
        result.push(definition);
      return;
    }
    if (element.type === 'Category') for (const child of element.items ?? []) visit(child);
  };
  for (const item of library.items) visit(item);
  return result;
}
function orderedGlobalVariables(library) {
  const globals = new Set(
    globalVariables(library)
      .filter((variable) => !variable.disabled)
      .map((variable) => variable.id),
  );
  const result = [];
  const seen = new Set();
  const visit = (candidate) => {
    if (!candidate.type) return;
    const element = library.elementsByType?.[candidate.type]?.[candidate.id] ?? candidate;
    const key = `${element.type}:${element.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    if (element.type === 'Variable' && globals.has(element.id)) result.push(element);
    else if (element.type === 'Category') for (const child of element.items ?? []) visit(child);
  };
  for (const item of library.items) visit(item);
  for (const variable of globalVariables(library)) visit(variable);
  return result;
}
const galaxySemanticKeys = [
  'statements',
  'initializer',
  'expression',
  'arguments',
  'left',
  'right',
  'operand',
  'thenStatement',
  'elseStatement',
  'statement',
  'condition',
  'incrementor',
  'body',
  'properties',
  'members',
  'argumentExpression',
  'size',
];
function galaxyVariableUses(node, prefix) {
  const uses = new Map();
  const visit = (value) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (
      value.kind === SyntaxKind.Identifier &&
      typeof value.name === 'string' &&
      value.name.startsWith(prefix)
    ) {
      uses.set(value.name, (uses.get(value.name) ?? 0) + 1);
    }
    for (const key of galaxySemanticKeys) visit(value[key]);
  };
  visit(node);
  return uses;
}
function triggerVariableUses(library, definition, globals) {
  const uses = new Map();
  const active = new Set();
  const visit = (value, property, expanded = false) => {
    if (!value || typeof value !== 'object') return;
    if (Array.isArray(value)) {
      value.forEach((child) => visit(child, property));
      return;
    }
    if (typeof value.type === 'string' && typeof value.id === 'string') {
      if ((value.library ?? library.id) !== library.id) return;
      if (value.type === 'Variable') {
        if (globals.has(value.id)) uses.set(value.id, (uses.get(value.id) ?? 0) + 1);
        return;
      }
      // Declaration/type links describe the call signature, not runtime use.
      if (
        property === 'functionDef' ||
        property === 'parameterDef' ||
        property === 'subFunctionType' ||
        value.type === 'FunctionDef' ||
        value.type === 'ParamDef' ||
        value.type === 'SubFuncType'
      )
        return;
      if (!expanded) {
        const key = `${value.type}:${value.id}`;
        if (active.has(key)) return;
        const resolved =
          library.elementsByType?.[value.type]?.[value.id] ??
          library.elements?.[key] ??
          library.elements?.[value.id];
        if (resolved && resolved !== value) {
          active.add(key);
          visit(resolved, property, true);
          active.delete(key);
          return;
        }
      }
    }
    for (const [key, child] of Object.entries(value)) {
      if (
        key === 'id' ||
        key === 'type' ||
        key === 'library' ||
        key === 'name' ||
        key === 'identifier' ||
        key === 'flags'
      )
        continue;
      visit(child, key);
    }
  };
  visit(definition.actions ?? []);
  return uses;
}
function usageFingerprint(uses) {
  return JSON.stringify([...uses].sort(([left], [right]) => left.localeCompare(right)));
}
/**
 * Pair generated Galaxy header declarations with the FunctionDefs that own
 * them. Shipped SC2 libraries can omit XML identifiers while retaining the
 * generated symbols in `*_h.galaxy`. The editor writes both sequences in tree
 * order, excluding inline SubFunctions definitions.
 *
 * Positional pairing is accepted only for a complete declaration sequence:
 * counts and arity must agree and every XML definition that does have a name
 * must be an exact anchor at the same position. Event declarations include an
 * implicit leading trigger parameter that is not a ParamDef. At least one
 * anchor is required, and multiple complete sources must agree exactly.
 */
export function matchDependencyFunctionDeclarations(sources, libraries) {
  const result = new Map();
  const conflicts = new Set();
  const offer = (name, definition) => {
    if (conflicts.has(name)) return;
    const previous = result.get(name);
    if (previous && refKey(previous, previous.library) !== refKey(definition, definition.library)) {
      result.delete(name);
      conflicts.add(name);
    } else result.set(name, definition);
  };
  for (const library of libraries) {
    const definitions = orderedCallableDefinitions(library);
    if (!definitions.length) continue;
    const prefix = `${libraryPrefix(library.id)}gf_`;
    const candidates = sources.flatMap((source) => {
      if (source.parseDiagnostics?.length) return [];
      const declarations = [...source.statements].filter(
        (statement) =>
          statement.kind === SyntaxKind.FunctionDeclaration &&
          statement.name?.name?.startsWith(prefix),
      );
      if (declarations.length !== definitions.length) return [];
      let anchors = 0;
      for (let position = 0; position < definitions.length; position++) {
        const definition = definitions[position];
        const declaration = declarations[position];
        const name = declaration.name?.name;
        const implicitEventParameter = definition.flags?.includes('Event') ? 1 : 0;
        if (
          !name ||
          (declaration.parameters?.length ?? 0) !==
            definition.parameters.length + implicitEventParameter
        )
          return [];
        if (definition.name) {
          anchors++;
          if (name !== `${prefix}${sanitizeIdentifier(definition.name)}`) return [];
        }
      }
      return anchors > 0 ? [declarations] : [];
    });
    if (candidates.length) {
      const names = candidates[0].map((declaration) => declaration.name.name);
      if (
        !candidates.some((declarations) =>
          declarations.some((declaration, position) => declaration.name.name !== names[position]),
        )
      ) {
        for (let position = 0; position < definitions.length; position++)
          offer(names[position], definitions[position]);
      }
    }
    // Version-skewed headers can add declarations while preserving the order
    // of an older TriggerLib. Match an unnamed interval only when exact named
    // anchors bound it and every declaration in that whole interval has the
    // expected arity. This is local sequence evidence, not a name guess.
    for (const source of sources) {
      if (source.parseDiagnostics?.length) continue;
      const declarations = [...source.statements].filter(
        (statement) =>
          statement.kind === SyntaxKind.FunctionDeclaration &&
          statement.name?.name?.startsWith(prefix),
      );
      if (!declarations.length) continue;
      const declarationPositions = new Map();
      declarations.forEach((declaration, index) => {
        const name = declaration.name?.name;
        if (typeof name !== 'string') return;
        const positions = declarationPositions.get(name) ?? [];
        positions.push(index);
        declarationPositions.set(name, positions);
      });
      const anchors = [];
      definitions.forEach((definition, index) => {
        if (!definition.name) return;
        const positions = declarationPositions.get(
          `${prefix}${sanitizeIdentifier(definition.name)}`,
        );
        if (positions?.length === 1) anchors.push([index, positions[0]]);
      });
      if (!anchors.length) continue;
      const boundaries = [[-1, -1], ...anchors, [definitions.length, declarations.length]];
      for (let boundary = 0; boundary + 1 < boundaries.length; boundary++) {
        const [definitionBefore, declarationBefore] = boundaries[boundary];
        const [definitionAfter, declarationAfter] = boundaries[boundary + 1];
        const definitionCount = definitionAfter - definitionBefore - 1;
        if (definitionCount <= 0 || definitionCount !== declarationAfter - declarationBefore - 1)
          continue;
        const pairs = Array.from({ length: definitionCount }, (_, offset) => ({
          definition: definitions[definitionBefore + offset + 1],
          declaration: declarations[declarationBefore + offset + 1],
        }));
        if (
          pairs.some(
            ({ definition, declaration }) =>
              (declaration.parameters?.length ?? 0) !==
                definition.parameters.length + (definition.flags?.includes('Event') ? 1 : 0) ||
              (definition.name &&
                declaration.name?.name !== `${prefix}${sanitizeIdentifier(definition.name)}`),
          )
        )
          continue;
        for (const { definition, declaration } of pairs) offer(declaration.name.name, definition);
      }
    }
  }
  return result;
}
/**
 * Pair dependency globals with their generated-header ABI names. Some shipped
 * TriggerLibs intentionally omit localized/internal variable names from XML,
 * while their headers retain the only callable spelling. As with functions,
 * positional recovery is accepted only for a complete sequence with at least
 * one exact named anchor, and every candidate header must agree.
 */
export function matchDependencyVariableDeclarations(sources, libraries) {
  const result = new Map();
  const conflicts = new Set();
  const offer = (name, variable) => {
    // A declared XML name/Identifier is authoritative. Fingerprint and local-
    // sequence recovery exist only for stripped, unnamed dependency elements;
    // letting them rebind a named variable can silently select another global
    // of the same type and produce valid-looking but incorrect Galaxy.
    if (
      (variable.name || variable.identifier) &&
      !globalVariableSpellings(variable.library ?? '', variable).includes(name)
    )
      return;
    if (conflicts.has(name)) return;
    const previous = result.get(name);
    if (previous && refKey(previous, previous.library) !== refKey(variable, variable.library)) {
      result.delete(name);
      conflicts.add(name);
    } else result.set(name, variable);
  };
  for (const library of libraries) {
    const variables = orderedGlobalVariables(library);
    if (!variables.length) continue;
    const prefix = `${libraryPrefix(library.id)}gv_`;
    const candidates = sources.flatMap((source) => {
      if (source.parseDiagnostics?.length) return [];
      const declarations = [...source.statements].filter(
        (statement) =>
          statement.kind === SyntaxKind.VariableDeclaration &&
          statement.name?.name?.startsWith(prefix),
      );
      if (declarations.length !== variables.length) return [];
      let anchors = 0;
      for (let position = 0; position < variables.length; position++) {
        const variable = variables[position];
        const name = declarations[position].name?.name;
        if (!name) return [];
        if (variable.name || variable.identifier) {
          anchors++;
          if (!globalVariableSpellings(library.id, variable).includes(name)) return [];
        }
      }
      return anchors > 0 ? [declarations] : [];
    });
    if (candidates.length) {
      const names = candidates[0].map((declaration) => declaration.name.name);
      if (
        !candidates.some((declarations) =>
          declarations.some((declaration, position) => declaration.name.name !== names[position]),
        )
      ) {
        for (let position = 0; position < variables.length; position++)
          offer(names[position], variables[position]);
      }
    }
    // A few old TriggerLibs reorder globals between XML and the generated
    // header. Recover only names proven by an identical, unique function-use
    // fingerprint in the XML graph and the shipped implementation source.
    const globals = new Set(variables.map((variable) => variable.id));
    const xmlUses = new Map();
    const galaxyUses = new Map();
    const sourceFunctions = new Map();
    for (const source of sources)
      for (const statement of source.statements) {
        if (
          statement.kind === SyntaxKind.FunctionDeclaration &&
          statement.body &&
          typeof statement.name?.name === 'string'
        ) {
          sourceFunctions.set(statement.name.name, statement);
        }
      }
    const functions = matchDependencyFunctionDeclarations(sources, [library]);
    // A newer generated header can contain additional declarations, making a
    // complete positional match impossible. Named XML definitions remain safe
    // anchors individually and still provide evidence for unnamed globals.
    for (const definition of orderedCallableDefinitions(library)) {
      if (!definition.name) continue;
      const name = `${libraryPrefix(library.id)}gf_${sanitizeIdentifier(definition.name)}`;
      if (sourceFunctions.has(name)) functions.set(name, definition);
    }
    for (const [functionName, definition] of functions) {
      const sourceFunction = sourceFunctions.get(functionName);
      if (!sourceFunction) continue;
      for (const [id, count] of triggerVariableUses(library, definition, globals)) {
        let uses = xmlUses.get(id);
        if (!uses) xmlUses.set(id, (uses = new Map()));
        // ScriptCode templates may repeat one XML operand, so occurrence
        // counts are not invariant. Function membership is.
        if (count > 0) uses.set(functionName, 1);
      }
      for (const [name, count] of galaxyVariableUses(sourceFunction.body, prefix)) {
        let uses = galaxyUses.get(name);
        if (!uses) galaxyUses.set(name, (uses = new Map()));
        if (count > 0) uses.set(functionName, 1);
      }
    }
    const xmlByFingerprint = new Map();
    for (const variable of variables) {
      const uses = xmlUses.get(variable.id);
      if (!uses?.size) continue;
      const fingerprint = usageFingerprint(uses);
      const group = xmlByFingerprint.get(fingerprint) ?? [];
      group.push(variable);
      xmlByFingerprint.set(fingerprint, group);
    }
    const galaxyByFingerprint = new Map();
    for (const [name, uses] of galaxyUses) {
      if (!uses.size) continue;
      const fingerprint = usageFingerprint(uses);
      const group = galaxyByFingerprint.get(fingerprint) ?? [];
      group.push(name);
      galaxyByFingerprint.set(fingerprint, group);
    }
    for (const [fingerprint, xmlGroup] of xmlByFingerprint) {
      const galaxyGroup = galaxyByFingerprint.get(fingerprint);
      if (xmlGroup.length === 1 && galaxyGroup?.length === 1) offer(galaxyGroup[0], xmlGroup[0]);
    }
    // Generated implementations sometimes inline an XML getter, so the ABI
    // global appears in more Galaxy functions than it does directly in the
    // TriggerData graph. A unique proper superset still proves the mapping:
    // every directly matched XML use must be present, and the XML variable
    // must have exactly one possible ABI partner. `offer` rejects the name if
    // another equally unique XML variable later claims that same partner.
    const subsetCandidates = new Map();
    for (const variable of variables) {
      const uses = xmlUses.get(variable.id);
      if (!uses?.size) continue;
      const candidates = [...galaxyUses]
        .filter(([, generatedUses]) =>
          [...uses.keys()].every((functionName) => generatedUses.has(functionName)),
        )
        .map(([name]) => name);
      subsetCandidates.set(variable, candidates);
    }
    for (const [variable, candidates] of subsetCandidates) {
      if (candidates.length !== 1) continue;
      offer(candidates[0], variable);
    }
    // Older XML and newer headers may differ globally while preserving a
    // local variable sequence. For an unnamed variable, accept that position
    // only between exact named anchors, with matching array shape, and when
    // every direct XML function-use is also observed for the proposed Galaxy
    // symbol. This combines independent order, type-shape and use evidence.
    const arrayShapeMatches = (variable, declaration) => {
      const expected = [...(variable.arraySizes ?? [])].sort((left, right) => left.dim - right.dim);
      const actual = [];
      let type = declaration.type;
      while (type?.kind === SyntaxKind.ArrayType) {
        actual.push(typeof type.size?.value === 'number' ? type.size.value : undefined);
        type = type.elementType;
      }
      if (actual.length !== expected.length) return false;
      return expected.every(
        (size, index) =>
          size.value === undefined ||
          !/^\d+$/u.test(size.value) ||
          actual[index] === Number(size.value) + 1,
      );
    };
    for (const source of sources) {
      if (source.parseDiagnostics?.length) continue;
      const declarations = [...source.statements].filter(
        (statement) =>
          statement.kind === SyntaxKind.VariableDeclaration &&
          statement.name?.name?.startsWith(prefix),
      );
      if (!declarations.length) continue;
      const declarationPositions = new Map();
      declarations.forEach((declaration, index) => {
        const name = declaration.name?.name;
        if (typeof name !== 'string') return;
        const positions = declarationPositions.get(name) ?? [];
        positions.push(index);
        declarationPositions.set(name, positions);
      });
      const anchors = [];
      variables.forEach((variable, index) => {
        if (!variable.name && !variable.identifier) return;
        const positions = globalVariableSpellings(library.id, variable)
          .map((spelling) => declarationPositions.get(spelling))
          .find((found) => found?.length === 1);
        if (positions) anchors.push([index, positions[0]]);
      });
      if (!anchors.length) continue;
      const boundaries = [[-1, -1], ...anchors, [variables.length, declarations.length]];
      for (let boundary = 0; boundary + 1 < boundaries.length; boundary++) {
        const [variableBefore, declarationBefore] = boundaries[boundary];
        const [variableAfter, declarationAfter] = boundaries[boundary + 1];
        const count = variableAfter - variableBefore - 1;
        if (count <= 0 || count !== declarationAfter - declarationBefore - 1) continue;
        for (let offset = 0; offset < count; offset++) {
          const variable = variables[variableBefore + offset + 1];
          const declaration = declarations[declarationBefore + offset + 1];
          const name = declaration.name?.name;
          if (!name || !arrayShapeMatches(variable, declaration)) continue;
          if (variable.name || variable.identifier) {
            if (globalVariableSpellings(library.id, variable).includes(name)) offer(name, variable);
            continue;
          }
          const triggerUses = xmlUses.get(variable.id);
          const generatedUses = galaxyUses.get(name);
          if (
            !triggerUses?.size ||
            !generatedUses?.size ||
            [...triggerUses.keys()].some((functionName) => !generatedUses.has(functionName))
          )
            continue;
          offer(name, variable);
        }
      }
    }
  }
  return result;
}
export function dependencyFunctionNames(declarations, libraries) {
  if (!declarations?.length) return new Map();
  const sources = declarations.map((declaration, index) =>
    new Parser().parseFile(declaration.fileName ?? `dependency-${index}.galaxy`, declaration.text),
  );
  const loadedLibraries = [...libraries];
  const result = new Map(
    [...matchDependencyFunctionDeclarations(sources, loadedLibraries)].map(([name, definition]) => [
      refKey(definition, definition.library),
      name,
    ]),
  );
  for (const [key, name] of declaredLegacyLoopNativeNames(sources, loadedLibraries)) {
    const existing = result.get(key);
    if (existing === undefined || existing === name) result.set(key, name);
  }
  return result;
}
export function dependencyVariableNames(declarations, libraries) {
  if (!declarations?.length) return new Map();
  const sources = declarations.map((declaration, index) =>
    new Parser().parseFile(declaration.fileName ?? `dependency-${index}.galaxy`, declaration.text),
  );
  return new Map(
    [...matchDependencyVariableDeclarations(sources, libraries)].map(([name, variable]) => [
      refKey(variable, variable.library),
      name,
    ]),
  );
}
