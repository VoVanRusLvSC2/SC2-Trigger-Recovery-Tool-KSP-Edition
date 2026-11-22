// SDK type rules retained verbatim; helpers come from the owning SDK ABI.
import { readSdkDeclaration } from './sdk-declaration-source.shared-ast.mjs';
export function createSdkTypeEvidence(dependencies) {
  const {
    isKeywordTypeKind,
    tokenToString,
    stringToToken,
    libraryPrefix,
    sanitizeName,
    lookupElement,
    mapTriggerTypeToGalaxy,
    structureTypeName,
    resolveRefFull,
    lowerInitial,
    sanitizeIdentifier,
  } = dependencies;
  const nativeTypeEvidence = new WeakMap();
  /** Galaxy return type per declared function name, from the same declarations. */
  const declaredResults = new WeakMap();
  const GALAXY_PRIMITIVE_TYPES = new Set([
    'void',
    'bool',
    'byte',
    'int',
    'fixed',
    'string',
    'text',
  ]);
  /** The declared Galaxy return type of a function the caller supplied a
   *  declaration for. Used where a trigger model alone cannot say what an
   *  expression evaluates to. */
  function declaredReturnType(nativeLibrary, name) {
    return nativeLibrary && name ? declaredResults.get(nativeLibrary)?.get(name) : undefined;
  }
  function declaredTypeName(node) {
    const typeNode = node;
    if (!typeNode) return undefined;
    if (typeof typeNode.name === 'string' && typeNode.name.length > 0) return typeNode.name;
    const named = typeNode.name;
    if (typeof named?.name === 'string' && named.name.length > 0) return named.name;
    if (typeNode.kind !== undefined && isKeywordTypeKind(typeNode.kind))
      return tokenToString(typeNode.kind) ?? undefined;
    return undefined;
  }
  /**
   * Editor-only trigger types such as the dialog-control type have no Galaxy
   * keyword, and naming them here would be a guess dressed as a contract. Read the
   * pairing out of the loaded data instead: a FunctionDef flagged Native names a
   * Galaxy function, and its ParamDefs line up positionally with that function's
   * declared parameters, so every such definition observes an editor type against
   * a declared Galaxy type. Only a type whose observations all agree is used — a
   * polymorphic one disagrees with itself and is left to its own handling.
   */
  function deriveNativeTypeMapping(nativeLibrary, declarations, verifiedDocument) {
    if (!nativeLibrary || !declarations?.length || nativeTypeEvidence.has(nativeLibrary)) return;
    const signatures = new Map();
    // The service prepends declarations synthesized from TriggerData and keeps
    // caller-supplied Galaxy declarations after them.  Walk backwards so an
    // authoritative native/header signature wins over the editor-type spelling
    // inferred for the same symbol by modelDeclarations().
    for (const declaration of [...declarations].reverse()) {
      const parsed =
        verifiedDocument?.(declaration) ??
        readSdkDeclaration(declaration.text, declaration.fileName ?? 'declarations.galaxy');
      for (const statement of parsed.statements) {
        const name = statement?.name?.name;
        if (
          statement?.kind !== 142 /* SyntaxKind.FunctionDeclaration */ ||
          typeof name !== 'string' ||
          signatures.has(name)
        )
          continue;
        signatures.set(name, {
          result: declaredTypeName(statement.type),
          parameters: (statement.parameters ?? []).map((parameter) =>
            declaredTypeName(parameter.type),
          ),
        });
      }
    }
    const votes = new Map();
    const vote = (triggerType, galaxyType) => {
      if (!triggerType || !galaxyType) return;
      const normalized = triggerType.toLowerCase();
      const kind = stringToToken(normalized);
      // Loaded declarations may use editor aliases in their own signatures, but
      // can never redefine a primitive Galaxy keyword such as int or bool.
      if (GALAXY_PRIMITIVE_TYPES.has(normalized) || (kind !== undefined && isKeywordTypeKind(kind)))
        return;
      const counts = votes.get(normalized) ?? new Map();
      counts.set(galaxyType, (counts.get(galaxyType) ?? 0) + 1);
      votes.set(normalized, counts);
    };
    for (const definition of Object.values(nativeLibrary.elementsByType?.FunctionDef ?? {})) {
      if (!definition.name) continue;
      const declaredName = definition.flags?.includes('Native')
        ? definition.name
        : `${libraryPrefix(definition.library ?? nativeLibrary.id)}gf_${sanitizeName(definition.name)}`;
      const signature = signatures.get(declaredName);
      if (!signature) continue;
      vote(definition.returnType?.type, signature.result);
      const formals = (definition.parameters ?? []).map((ref) =>
        lookupElement([nativeLibrary], ref, nativeLibrary.id),
      );
      if (formals.length !== signature.parameters.length) continue;
      for (const [index, formal] of formals.entries())
        vote(formal?.paramType?.type, signature.parameters[index]);
    }
    // TriggerData also declares explicit unary conversion operators. A concrete
    // operator return type is authoritative evidence for its editor-only input
    // type even when that helper has no standalone Galaxy declaration.
    for (const definition of Object.values(nativeLibrary.elementsByType?.FunctionDef ?? {})) {
      if (!definition.flags?.includes('Operator') || !definition.returnType?.type) continue;
      const formals = (definition.parameters ?? []).map((ref) =>
        lookupElement([nativeLibrary], ref, nativeLibrary.id),
      );
      if (formals.length !== 1) continue;
      const input = formals[0]?.paramType?.type;
      const output = definition.returnType.type;
      if (!input || /^(?:any|sameas)/iu.test(input) || /^(?:any|sameas)/iu.test(output)) continue;
      // A positional pairing with an actual Galaxy declaration is stronger than
      // a conversion operator (one editor type may expose several conversions).
      if (votes.has(input.toLowerCase())) continue;
      const mappedOutput = mapTriggerTypeToGalaxy(output);
      if (!GALAXY_PRIMITIVE_TYPES.has(mappedOutput)) continue;
      const inputKind = stringToToken(input.toLowerCase());
      if (inputKind !== undefined && isKeywordTypeKind(inputKind)) continue;
      vote(input, mappedOutput);
    }
    const mapping = new Map();
    for (const [triggerType, counts] of votes) {
      if (counts.size !== 1) continue;
      const [galaxyType] = [...counts.keys()];
      if (galaxyType !== triggerType) mapping.set(triggerType, galaxyType);
    }
    nativeTypeEvidence.set(nativeLibrary, mapping);
    declaredResults.set(
      nativeLibrary,
      new Map(
        [...signatures]
          .filter(([, signature]) => signature.result !== undefined)
          .map(([name, signature]) => [name, signature.result]),
      ),
    );
  }
  /**
   * Whether the loaded data says what Galaxy type an editor type is. A type the
   * language declares, the table maps, or the native declarations pair up is
   * resolved; anything else is an editor name we have no evidence about.
   */
  function isResolvedGalaxyType(triggerType, nativeLibrary, allLibraries) {
    if (!triggerType) return false;
    const normalized = triggerType.toLowerCase();
    const kind = stringToToken(normalized);
    if (kind !== undefined && isKeywordTypeKind(kind)) return true;
    if (mapTriggerTypeToGalaxy(normalized) !== normalized) return true;
    for (const candidate of [nativeLibrary, ...(allLibraries?.values() ?? [])]) {
      if (candidate && nativeTypeEvidence.get(candidate)?.has(normalized)) return true;
    }
    return false;
  }
  function mapParameterTypeToGalaxy(paramType, library, nativeLibrary, allLibraries) {
    const triggerType = paramType?.type ?? 'int';
    if (
      /^(any|sameas)/u.test(triggerType) &&
      paramType?.variableType &&
      !/^(any|sameas)/u.test(paramType.variableType)
    ) {
      return mapTriggerTypeToGalaxy(paramType.variableType);
    }
    if (triggerType.toLowerCase() === 'struct') {
      return (
        structureTypeName(paramType?.typeElement, library, nativeLibrary, allLibraries) ?? 'struct'
      );
    }
    if (triggerType.toLowerCase() === 'preset' && paramType?.typeElement) {
      const preset = resolveRefFull(paramType.typeElement, library, nativeLibrary, allLibraries);
      if (preset?.type === 'Preset' && preset.baseType)
        return mapTriggerTypeToGalaxy(preset.baseType);
    }
    const mapped = mapTriggerTypeToGalaxy(triggerType);
    // Only fill a gap: a type the table already resolves is left exactly as it was.
    if (mapped !== triggerType.toLowerCase()) return mapped;
    // The derivation is keyed by the library it was read from. A caller that does
    // not single the native library out still passes it among the loaded ones.
    for (const candidate of [nativeLibrary, ...(allLibraries?.values() ?? [])]) {
      const derived = candidate && nativeTypeEvidence.get(candidate)?.get(mapped);
      if (derived) return derived;
    }
    return isResolvedGalaxyType(triggerType, nativeLibrary, allLibraries) ? mapped : triggerType;
  }
  /** Unary operators whose concrete editor and Galaxy types collapse to the same
   * declared type are compile-time adapters, not runtime functions. */
  function isIdentityConversionOperator(definition, library, nativeLibrary, allLibraries) {
    if (!definition.flags?.includes('Operator') || definition.flags.includes('Native'))
      return false;
    if ((definition.parameters ?? []).length !== 1 || !definition.returnType) return false;
    const formal = resolveRefFull(definition.parameters[0], library, nativeLibrary, allLibraries);
    if (!formal) return false;
    const input = formal.paramType.type;
    const output = definition.returnType.type;
    if (!input || !output) return false;
    if (
      mapParameterTypeToGalaxy(definition.returnType, library, nativeLibrary, allLibraries) !==
      mapParameterTypeToGalaxy(formal.paramType, library, nativeLibrary, allLibraries)
    )
      return false;
    const actions = definition.actions ?? [];
    if (actions.length === 0 && !definition.scriptCode?.trim()) return true;
    // FlagInternal conversion operators are editor type-system adapters. Their
    // XML implementation may call a native representation helper, while the SC2
    // generator erases the operator once both loaded types use one Galaxy type.
    if (definition.flags.includes('Internal')) return true;
    // A non-internal authored operator is removable only when its complete body
    // is structurally a return of its sole formal parameter.
    if (actions.length !== 1 || definition.scriptCode?.trim()) return false;
    const action = resolveRefFull(actions[0], library, nativeLibrary, allLibraries);
    const actionDefinition = action?.functionDef
      ? resolveRefFull(action.functionDef, library, nativeLibrary, allLibraries)
      : undefined;
    if (
      !action ||
      !actionDefinition?.scriptCode ||
      !/^\s*return\s+#PARAM\([^)]+\)\s*;?\s*$/u.test(actionDefinition.scriptCode)
    )
      return false;
    if ((action.parameters ?? []).length !== 1) return false;
    const argument = resolveRefFull(action.parameters[0], library, nativeLibrary, allLibraries);
    if (!argument) return false;
    if (
      argument.paramRef?.id === formal.id &&
      (argument.paramRef.library ?? definition.library) === (formal.library ?? definition.library)
    )
      return true;
    const expectedName = `lp_${lowerInitial(sanitizeIdentifier(formal.name ?? formal.id))}`;
    return argument.scriptCode?.trim() === expectedName;
  }

  return Object.freeze({
    deriveNativeTypeMapping,
    declaredReturnType,
    isResolvedGalaxyType,
    mapParameterTypeToGalaxy,
    isIdentityConversionOperator,
  });
}
