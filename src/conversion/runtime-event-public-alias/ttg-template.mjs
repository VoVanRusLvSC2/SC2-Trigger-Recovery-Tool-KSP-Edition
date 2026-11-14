import {
  isLocalLiteralConstantAutoArgument,
  isKnownLocalTemplateArgument,
} from '../exact-function-signatures/local-constant-auto.mjs';

import {
  conversionError,
  refKey,
  globalVariables,
  globalVariableNames,
} from '../../ast/explicit-numeric-global-model.mjs';

import {
  templateMacros,
  templateParameters,
  autoVariableTypeSource,
  replaceTemplateMacros,
  templateRoles,
  compileTemplate,
  resolveTemplateDefinition,
  syntaxChildren,
  parseTemplateFragment,
  printNode,
  printTemplateExpression,
} from '../native-expression-identity/balanced-script-template-alternate.mjs';

import {
  localVarName,
  resolveRefFull,
  mapParameterTypeToGalaxy,
  toGalaxyFunctionName,
  declaredReturnType,
  presetIdentifierFunctionName,
  namingIndexes,
} from './ttg-core.verified-getter.mjs';

import { convertParamExpr, actualParameterType } from './ttg-params.mjs';

import { convertFunctionCallExpr } from './ttg-convert.mjs';

import {
  convertAction,
  registerRawScriptReplacement,
  RAW_SCRIPT_PLACEHOLDER,
} from './ttg-actions.mjs';

import { createVariableDeclaration } from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/ast-factory.js';

export function isInlineTemplate(definition) {
  const hasStructuredBody = !!definition.actions?.length || !!definition.localVariables?.length;

  const implicitOperator =
    !!definition.flags?.includes('Operator') &&
    !definition.flags.includes('Native') &&
    (!hasStructuredBody || !!definition.scriptCode);

  const macros = templateMacros(definition.scriptCode ?? '').length > 0;

  // A CustomScript body is verbatim Galaxy and keeps its function boundary —

  // unless it carries template macros, which are not Galaxy at all and mean

  // something only once substituted.

  if (definition.flags?.includes('CustomScript')) return macros;

  // Inline on an action-body function does not supply a ScriptCode fragment.

  // Preserve that function boundary; only an actual script can be expanded here.

  return (
    !!definition.flags?.includes('Template') ||
    (!!definition.scriptCode && !!definition.flags?.includes('Inline')) ||
    implicitOperator ||
    (macros && (!hasStructuredBody || !!definition.flags?.includes('SubFunctions')))
  );
}

export function emitScriptTemplate(call, definition, ctx, expression) {
  const unroled = [];

  const expanded = renderScriptTemplate(call, definition, ctx, unroled);

  const nodes = parseTemplateFragment(expanded, expression);

  if (!nodes || !nodes.every(Boolean))
    conversionError('TEMPLATE_SYNTAX', 'Expanded ScriptCode is not valid Galaxy', {
      call: refKey(call),
      definition: refKey(definition),
      source: expanded.slice(0, 4096),
    });

  if (expression) {
    if (unroled.length)
      conversionError(
        'COMMENT_ROLE_AMBIGUOUS',
        'Comment cannot be assigned to a unique parent role',
        {
          call: refKey(call),
          comment: refKey(unroled[0]),
          roles: [
            ...templateRoles(definition, [
              ctx.library,
              ...(ctx.nativeLibrary ? [ctx.nativeLibrary] : []),
              ...(ctx.allLibraries?.values() ?? []),
            ]).values(),
          ].map((role) => refKey(role, definition.library)),
        },
      );

    return nodes[0];
  }

  // A comment child that names no role belongs to the call, not to one of its

  // branches. Emit it ahead of the expanded template rather than choosing a

  // branch for it; the child order among such comments is preserved.

  const leading = unroled.flatMap((comment) => {
    const statement = convertAction(comment, ctx);

    return statement === undefined ? [] : Array.isArray(statement) ? statement : [statement];
  });

  // Preserve comments after the complete syntax has been validated. A marker

  // statement between an if and its else would itself break that syntax.

  if (/\/[/\*]/u.test(expanded))
    return [...leading, registerRawScriptReplacement(layoutTemplateText(expanded), ctx)];

  return [...leading, ...nodes];
}

/**































 * Lays out expanded ScriptCode kept as text the way the editor writes it: four spaces per open brace, no blank































 * lines. The expansion itself carries the template's tabs and a line break around every comment, so without this































 * a comment inside If Then Else broke the indentation of the whole statement (traynor01, 28.09).































 */

function layoutTemplateText(text) {
  const lines = [];

  let depth = 0;

  let inBlockComment = false;

  for (const raw of text.split(/\r?\n/u)) {
    const line = raw.trim();

    if (line === '') continue;

    let opens = 0;

    let leadingCloses = 0;

    let code = true;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (inBlockComment) {
        if (char === '*' && line[i + 1] === '/') {
          inBlockComment = false;

          i++;
        }

        continue;
      }

      if (char === '/' && line[i + 1] === '/') break;

      if (char === '/' && line[i + 1] === '*') {
        inBlockComment = true;

        i++;

        continue;
      }

      if (char === '"') {
        for (i++; i < line.length && line[i] !== '"'; i++) if (line[i] === '\\') i++;

        code = false;

        continue;
      }

      if (char === '{') {
        opens++;

        code = false;
      } else if (char === '}') {
        if (code) leadingCloses++;
        else opens--;
      } else code = false;
    }

    lines.push('    '.repeat(Math.max(0, depth - leadingCloses)) + line);

    depth = Math.max(0, depth - leadingCloses + opens);
  }

  return lines.join('\n');
}

/** Galaxy defaults used by NativeLib's #DEFRETURN macro. Keep this deliberately































 * narrow: a return type not covered by the language/editor contract remains a































 * diagnostic instead of silently becoming null. */

function defaultReturnSource(returnType) {
  switch (returnType?.toLowerCase()) {
    case 'void':
      return '';

    case 'bool':
      return 'true';

    case 'int':
      return '0';

    case 'fixed':
      return '0.0';

    case 'string':

    case 'text':
      return 'null';

    default:
      return undefined;
  }
}

/** Child fragments can start with else; parse after their parent has assembled the chain. */

function renderScriptTemplate(call, definition, ctx, unroled = []) {
  const caller = ctx;

  const libraryMap = new Map(ctx.allLibraries);

  libraryMap.set(ctx.library.id, ctx.library);

  if (ctx.nativeLibrary) libraryMap.set(ctx.nativeLibrary.id, ctx.nativeLibrary);

  const libraries = [...libraryMap.values()];

  const actualTypes = new Map();

  for (const ref of call.parameters ?? []) {
    const actual = resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries);

    const formal =
      actual?.parameterDef &&
      resolveRefFull(actual.parameterDef, ctx.library, ctx.nativeLibrary, ctx.allLibraries);

    const type = actual && actualParameterType(actual, ctx);

    if (formal?.name && type) actualTypes.set(formal.name, type);
  }

  definition = resolveTemplateDefinition(definition, libraries, actualTypes);

  if (!definition.scriptCode)
    conversionError(
      'OPERATOR_TEMPLATE',
      'Loaded operator declaration does not describe a supported expression',
      { definition: refKey(definition) },
    );

  const roles = templateRoles(definition, libraries);

  const children = (call.subFunctions ?? []).map((ref) =>
    resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries),
  );

  const roleKeys = new Set([...roles.values()].map((role) => refKey(role, definition.library)));

  const childRole = (child) => {
    const key =
      child.subFunctionType &&
      refKey({ ...child.subFunctionType, type: 'SubFuncType' }, call.library);

    if (child.type !== 'Comment' || (key && roleKeys.has(key))) return key;

    if (roles.size === 1) return roleKeys.values().next().value;

    return undefined;
  };

  // Validate even roles not expanded by conditional template directives. An

  // executable child with no role would be dropped by the role filter below,

  // so it is reported instead of silently disappearing.

  for (const child of children) {
    if (!child || child.disabled) continue;

    const role = childRole(child);

    if (role !== undefined || roles.size <= 1) continue;

    if (child.type === 'Comment') unroled.push(child);
    else
      conversionError(
        'SUBFUNCTION_ROLE_MISSING',
        'Executable subfunction names no role of its parent',
        {
          call: refKey(call),
          child: refKey(child),
          roles: [...roleKeys],

          // What the child does name, so the report says which of the two sides is wrong.

          names: child.subFunctionType
            ? refKey({ ...child.subFunctionType, type: 'SubFuncType' }, call.library)
            : 'nothing',

          childOf: child.functionDef ? refKey(child.functionDef, call.library) : 'nothing',
        },
      );
  }

  const childrenForRole = (name) => {
    const role = roles.get(name);

    if (!role)
      return conversionError(
        'TEMPLATE_ROLE',
        'ScriptCode role is not present in loaded SubFuncType definitions',
        { definition: refKey(definition), name },
      );

    return children.filter(
      (child) =>
        !!child &&
        !child.disabled &&
        (childRole(child)
          ? childRole(child) === refKey(role, definition.library)
          : roles.size === 1),
    );
  };

  const parameterRefs = templateParameters(definition, libraries);

  const formalByName = new Map(
    [...parameterRefs].map(([name, ref]) => [
      name,
      resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries),
    ]),
  );

  const actualFor = (ref, formal) =>
    (call.parameters ?? [])

      .map((ref) => resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries))

      .find(
        (param) =>
          param?.parameterDef &&
          refKey(param.parameterDef, call.library) === refKey(ref, definition.library),
      ) ??
    (formal.default
      ? resolveRefFull(formal.default, ctx.library, ctx.nativeLibrary, ctx.allLibraries)
      : undefined);

  const typeFor = (name) => {
    const formal = formalByName.get(name);

    if (!formal) return undefined;

    const actual = actualFor(parameterRefs.get(name), formal);

    const type = actual && actualParameterType(actual, caller);

    return mapParameterTypeToGalaxy(
      type ?? formal.paramType,
      ctx.library,
      ctx.nativeLibrary,
      ctx.allLibraries,
    );
  };

  for (const macro of templateMacros(definition.scriptCode))
    if (macro.name === 'PARAM' && !parameterRefs.has(macro.args[0])) {
      conversionError(
        'TEMPLATE_PARAMETER',
        'ScriptCode parameter is not bound to a loaded definition',
        { definition: refKey(definition), name: macro.args[0] },
      );
    }

  const initializedAutos = new Map();

  let code = definition.scriptCode ?? '';

  for (let depth = 0; ; depth++) {
    const pending = templateMacros(code).some((macro) =>
      ['IFHAVESUBFUNCS', 'IFSUBFUNC', 'INITAUTOVAR'].includes(macro.name),
    );

    if (!pending) break;

    if (depth >= 64)
      conversionError('TEMPLATE_DEPTH', 'Nested ScriptCode directives exceed the conversion limit');

    const source = code;

    code = replaceTemplateMacros(source, (macro) => {
      const [name, value] = macro.args;

      if (macro.name === 'IFHAVESUBFUNCS')
        return childrenForRole(name).some((child) => child.type !== 'Comment')
          ? (macro.rawArgs[1] ?? '')
          : '';

      if (macro.name === 'IFSUBFUNC') {
        if (name !== 'notfirst')
          return conversionError(
            'TEMPLATE_SUBFUNCTION_TEST',
            'Unknown ScriptCode subfunction condition',
            { condition: name },
          );

        return (ctx.templateSubfunctionIndex ?? 0) > 0 ? (macro.rawArgs[1] ?? '') : '';
      }

      if (macro.name === 'INITAUTOVAR') {
        const formal = formalByName.get(value);

        if (!formal)
          return conversionError(
            'TEMPLATE_PARAMETER',
            'Auto-variable initializer parameter is unavailable',
            { definition: refKey(definition), parameter: value },
          );

        const assignment = `#AUTOVAR(${name},${typeFor(value)}) = #PARAM(${value});`;

        initializedAutos.set(name, { parameter: value, assignment });

        return assignment;
      }

      return source.slice(macro.start, macro.end);
    });
  }

  const macros = templateMacros(code);

  const autoVars = new Map(ctx.templateAutoVars);

  for (const name of initializedAutos.keys()) autoVars.delete(name);

  for (const macro of macros.filter((macro) => macro.name === 'AUTOVAR')) {
    const name = macro.args[0];

    const declaration = autoVariableTypeSource(macro, code);

    let type = declaration?.type;

    if (!type && declaration?.parameter) {
      type = typeFor(declaration.parameter);
    }

    if (type) autoVars.set(name, { identifier: `auto${call.id}_${name}`, type });
  }

  inferAutoTypes(call, { ...definition, scriptCode: code }, ctx, libraries, autoVars);

  ctx = {
    ...ctx,
    templateAutoVars: autoVars,
    templateScopes: [...(ctx.templateScopes ?? []), { definition, variables: autoVars }],
  };

  const parameters = new Map();

  const parameterExpressions = new Map();

  const parameterActuals = new Map();

  for (const [parameterName, formalRef] of parameterRefs) {
    const formal = resolveRefFull(formalRef, ctx.library, ctx.nativeLibrary, ctx.allLibraries);

    if (!formal?.name)
      conversionError('TEMPLATE_PARAMETER', 'Template parameter definition is unavailable', {
        definition: refKey(definition),
        parameter: formalRef,
      });

    const actuals = (call.parameters ?? [])

      .map((ref) => resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries))

      .filter(
        (param) =>
          !!param?.parameterDef &&
          refKey(param.parameterDef, call.library) === refKey(formalRef, definition.library),
      );

    const values =
      actuals.length > 0
        ? actuals
        : formal.default
          ? [resolveRefFull(formal.default, ctx.library, ctx.nativeLibrary, ctx.allLibraries)]
          : [];

    if (!formal.isMultiple && values.length > 1) {
      return conversionError(
        'TEMPLATE_ARGUMENT',
        'Non-multiple template parameter has repeated XML values',
        { call: refKey(call), parameter: formal.name, count: values.length },
      );
    }

    const expressions = values.map((value) => convertParamExpr(value, caller));

    if (expressions.length === 0 || expressions.some((expr) => !expr)) {
      return conversionError('TEMPLATE_ARGUMENT', 'Template argument is unavailable', {
        call: refKey(call),
        parameter: formal.name,
      });
    }

    parameterExpressions.set(parameterName, expressions);

    parameterActuals.set(parameterName, values);

    parameters.set(
      parameterName,
      expressions.map((expr) => printTemplateExpression(expr)),
    );
  }

  // The editor promotes literal #INITAUTOVAR inputs (most visibly foreach end

  // and increment values) to const locals and omits the later assignment.  Do

  // this only for syntax that is intrinsically constant; identifiers and calls

  // may name constants, but proving that requires declaration analysis and an

  // incorrect promotion would change initialization order.

  const constantIdentifiers = new Set();

  for (const owner of libraries) {
    let names = ctx.constantGlobalNamesByLibrary?.get(owner);

    if (!names) {
      names = new Set();

      const variables = globalVariables(owner);

      const generatedNames = globalVariableNames(owner.id, variables);

      for (const variable of variables)
        if (variable.isConstant) {
          names.add(
            ctx.globalVariableNamesByLibrary?.get(owner)?.get(variable.id) ??
              (owner === ctx.library ? ctx.globalVarNames?.get(variable.id) : undefined) ??
              generatedNames.get(variable.id),
          );
        }

      ctx.constantGlobalNamesByLibrary?.set(owner, names);
    }

    for (const name of names) constantIdentifiers.add(name);
  }

  const literalConstant = (node) => {
    if (node?.kind === 126 /* SyntaxKind.ParenthesizedExpression */)
      return literalConstant(node.expression);

    if (node?.kind === 2 /* SyntaxKind.NumericLiteral */) return true;

    if (node?.kind === 113 /* SyntaxKind.Identifier */) return constantIdentifiers.has(node.name);

    return (
      node?.kind === 122 /* SyntaxKind.PrefixUnaryExpression */ &&
      [20 /* SyntaxKind.PlusToken */, 21 /* SyntaxKind.MinusToken */].includes(
        node.operator?.kind,
      ) &&
      literalConstant(node.operand)
    );
  };

  for (const [name, initialized] of initializedAutos) {
    const expressions = parameterExpressions.get(initialized.parameter);

    const variable = autoVars.get(name);

    if (
      !variable ||
      ctx.autoVarDeclarations.some((stmt) => stmt.name?.name === variable.identifier)
    )
      continue;

    const actualsForConstant = parameterActuals.get(initialized.parameter);

    const isLiteral =
      expressions?.length === 1 &&
      ((!isKnownLocalTemplateArgument(actualsForConstant, caller) &&
        literalConstant(expressions[0])) ||
        isLocalLiteralConstantAutoArgument(
          expressions[0],
          actualsForConstant,
          variable.type,
          caller,
          resolveRefFull,
          localVarName,
        ));

    if (isLiteral) {
      const assignmentAt = code.indexOf(initialized.assignment);

      if (assignmentAt >= 0)
        code =
          code.slice(0, assignmentAt) + code.slice(assignmentAt + initialized.assignment.length);
    }

    // Declare every initialized auto in directive order.  Otherwise a promoted

    // const would be inserted before an earlier non-constant auto, producing a

    // semantically equivalent but editor-different declaration sequence.

    ctx.autoVarDeclarations.push(
      createVariableDeclaration(
        variable.type,
        variable.identifier,
        isLiteral ? expressions[0] : undefined,
        isLiteral,
      ),
    );
  }

  const oneParameterValue = (name) => {
    const values = parameters.get(name);

    if (values === undefined)
      return conversionError('TEMPLATE_PARAMETER', 'Unknown ScriptCode parameter', {
        definition: refKey(definition),
        name,
      });

    if (values.length !== 1)
      return conversionError(
        'TEMPLATE_PARAMETER',
        'Nested ScriptCode parameter separator requires one value',
        { definition: refKey(definition), name, count: values.length },
      );

    return values[0];
  };

  const literalParts = (source, parameter) => {
    let output = '';

    let offset = 0;

    while (offset < source.length) {
      while (/\s/u.test(source[offset] ?? '')) offset++;

      if (offset === source.length) break;

      if (source[offset] !== '"')
        return conversionError(
          'TEMPLATE_SEPARATOR',
          'Parameter separator contains unsupported ScriptCode',
          { definition: refKey(definition), parameter, separator: source },
        );

      let end = offset + 1;

      for (; end < source.length; end++) {
        if (source[end] === '\\') {
          end++;

          continue;
        }

        if (source[end] === '"') break;
      }

      if (end >= source.length)
        return conversionError(
          'TEMPLATE_SEPARATOR',
          'Parameter separator has an unterminated string literal',
          { definition: refKey(definition), parameter, separator: source },
        );

      try {
        output += JSON.parse(source.slice(offset, end + 1));
      } catch {
        return conversionError(
          'TEMPLATE_SEPARATOR',
          'Parameter separator has an invalid string literal',
          { definition: refKey(definition), parameter, separator: source },
        );
      }

      offset = end + 1;
    }

    return output;
  };

  /** True when the text is one expression a neighbouring operator cannot split. */

  const selfDelimitedExpression = (text) => {
    const node = parseTemplateFragment(text, true)?.[0];

    return (
      node !== undefined &&
      [
        126 /* SyntaxKind.ParenthesizedExpression */, 113 /* SyntaxKind.Identifier */,
        121 /* SyntaxKind.CallExpression */,

        3 /* SyntaxKind.StringLiteral */, 2 /* SyntaxKind.NumericLiteral */,
        119 /* SyntaxKind.ElementAccessExpression */,

        120 /* SyntaxKind.PropertyAccessExpression */, 67 /* SyntaxKind.TrueKeyword */,
        68 /* SyntaxKind.FalseKeyword */,

        69 /* SyntaxKind.NullKeyword */,
      ].includes(node.kind)
    );
  };

  const parameterSeparator = (source, parameter) => {
    try {
      const separator = JSON.parse(source);

      if (typeof separator === 'string') return separator;
    } catch {
      /* Composite separators are handled below. */
    }

    let output = '';

    let cursor = 0;

    const nested = /#PARAM\((\w+)\)/gu;

    for (let match = nested.exec(source); match; match = nested.exec(source)) {
      output += literalParts(source.slice(cursor, match.index), parameter);

      output += oneParameterValue(match[1]);

      cursor = match.index + match[0].length;
    }

    output += literalParts(source.slice(cursor), parameter);

    return output;
  };

  return replaceTemplateMacros(code, (macro) => {
    const name = macro.args[0] ?? '';

    if (macro.name === 'PARAM') {
      const values = parameters.get(name);

      if (values === undefined)
        conversionError('TEMPLATE_PARAMETER', 'Unknown ScriptCode parameter', {
          definition: refKey(definition),
          name,
        });

      if (values.length === 1) return values[0];

      if (macro.args[1] === undefined)
        return conversionError(
          'TEMPLATE_PARAMETER',
          'Multiple template values require an explicit ScriptCode separator',
          { definition: refKey(definition), name, count: values.length },
        );

      const separator = parameterSeparator(macro.args[1], name);

      // The editor joins the values as they are — `"Range[" + IntToString(0) + "]"` —

      // because every nested operator template already parenthesizes itself. Only a

      // value that does not is wrapped, so precedence still cannot change.

      return values
        .map((value) => (selfDelimitedExpression(value) ? value : `(${value})`))
        .join(separator);
    }

    if (macro.name === 'PRESETIDENT') {
      const actuals = parameterActuals.get(name);

      if (!actuals || actuals.length !== 1)
        return conversionError(
          'TEMPLATE_PARAMETER',
          'Preset identifier macro requires one parameter value',
          {
            definition: refKey(definition),
            name,
            count: actuals?.length ?? 0,
          },
        );

      const type = actualParameterType(actuals[0], caller);

      const typeElement = type?.typeElement;

      const preset =
        typeElement?.type === 'Preset'
          ? resolveRefFull(typeElement, ctx.library, ctx.nativeLibrary, ctx.allLibraries)
          : undefined;

      if (!preset?.generateIdentifier)
        return conversionError(
          'TEMPLATE_PARAMETER',
          'Preset identifier macro requires a PresetGenIdentFunc type',
          {
            definition: refKey(definition),
            name,
            parameterType: type,
          },
        );

      return `${presetIdentifierFunctionName(preset, ctx.libId)}(${oneParameterValue(name)})`;
    }

    if (macro.name === 'SUBFUNCS') {
      const role = roles.get(name);

      if (!role)
        conversionError(
          'TEMPLATE_ROLE',
          'ScriptCode role is not present in loaded SubFuncType definitions',
          { definition: refKey(definition), name },
        );

      const children = childrenForRole(name);

      const roleDefinition = resolveRefFull(
        { ...role, type: 'SubFuncType' },
        ctx.library,
        ctx.nativeLibrary,
        ctx.allLibraries,
      );

      if (roleDefinition?.type === 'SubFuncType' && roleDefinition.functionDef) {
        const allowed = refKey(
          roleDefinition.functionDef,
          roleDefinition.library ?? definition.library,
        );

        for (const child of children)
          if (
            child.type !== 'Comment' &&
            (!child.functionDef ||
              refKey(child.functionDef, child.library ?? call.library) !== allowed)
          ) {
            conversionError(
              'TEMPLATE_SUBFUNCTION_DEFINITION',
              'Subfunction does not match its loaded role definition',
              { call: refKey(child), role: refKey(role), expected: allowed },
            );
          }
      }

      if (macro.args[1] !== undefined) {
        let separator;

        try {
          separator = JSON.parse(macro.args[1]);
        } catch {
          return conversionError('TEMPLATE_SEPARATOR', 'Invalid subfunction separator');
        }

        if (typeof separator !== 'string')
          return conversionError('TEMPLATE_SEPARATOR', 'Subfunction separator must be a string');

        const expressions = children.filter((child) => child.type !== 'Comment');

        if (!expressions.length) {
          const join = parseTemplateFragment(`true ${separator} false`, true)?.[0];

          if (
            join?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
            join.left.kind === 67 /* SyntaxKind.TrueKeyword */ &&
            join.right.kind === 68 /* SyntaxKind.FalseKeyword */
          ) {
            if (join.operatorToken.kind === 34 /* SyntaxKind.AmpersandAmpersandToken */)
              return 'true';

            if (join.operatorToken.kind === 35 /* SyntaxKind.BarBarToken */) return 'false';
          }
        }

        return expressions
          .map((child) => {
            const value = convertFunctionCallExpr(child, ctx);

            if (!value)
              conversionError(
                'TEMPLATE_EXPRESSION',
                'Subfunction expression could not be generated',
                { call: refKey(child) },
              );

            // The enclosing operator must not change a child's expression tree. A child

            // that already parenthesizes itself (every editor comparison does) keeps its

            // own parentheses instead of gaining a second pair the editor never writes.

            const text = printNode(value);

            return value.kind === 126 /* SyntaxKind.ParenthesizedExpression */ ? text : `(${text})`;
          })
          .join(separator);
      }

      let index = 0;

      return children
        .flatMap((child) => {
          if (child.type === 'Comment') {
            const comment = child.comment ?? child.name ?? '';

            return [
              `\n${comment
                .trim()
                .split(/\r?\n/u)
                .map((line) => `// ${line.trim()}`)
                .join('\n')}\n`,
            ];
          }

          const childCtx = { ...ctx, templateSubfunctionIndex: index };

          index++;

          const childDef = resolveRefFull(
            child.functionDef,
            ctx.library,
            ctx.nativeLibrary,
            ctx.allLibraries,
          );

          if (childDef?.flags?.includes('CustomScript') && child.scriptCode)
            return [child.scriptCode];

          if (childDef && isInlineTemplate(childDef)) {
            // Inline children are rendered directly because some editor templates

            // contribute fragments such as `else if` which are only valid after

            // their parent has assembled the complete statement.  This bypasses

            // convertAction's normal prelude capture, so capture expression-side

            // setup here and keep it at the child's exact insertion point.  In

            // particular TextExpressionSetToken must remain inside the loop or

            // branch where its token expression is evaluated.

            const expressionPrelude = (childCtx.expressionPrelude ??= []);

            const preludeStart = expressionPrelude.length;

            const rendered = renderScriptTemplate(child, childDef, childCtx);

            const prelude = expressionPrelude.splice(preludeStart);

            if (prelude.length === 0) return [rendered];

            if (/^\s*else\b/u.test(rendered)) {
              return conversionError(
                'TEMPLATE_EXPRESSION_SCOPE',
                'An inline else fragment requires expression setup that cannot be moved outside its branch',
                {
                  call: refKey(child),
                  definition: refKey(childDef),
                  statements: prelude.length,
                },
              );
            }

            return [`${prelude.map((statement) => printNode(statement)).join('\n')}\n${rendered}`];
          }

          const statements = convertAction(child, childCtx);

          if (statements === undefined)
            conversionError('TEMPLATE_STATEMENT', 'Subfunction could not be generated', {
              call: refKey(child),
            });

          return (Array.isArray(statements) ? statements : [statements]).map((statement) => {
            const expression = statement.expression;

            const raw =
              statement.kind === 138 /* SyntaxKind.ExpressionStatement */ &&
              expression?.kind === 121 /* SyntaxKind.CallExpression */ &&
              expression.expression?.name === RAW_SCRIPT_PLACEHOLDER &&
              expression.arguments?.length === 1
                ? ctx.rawScriptReplacements?.get(expression.arguments[0].value)
                : undefined;

            // A trailing line comment must not consume the parent's next token.

            return raw === undefined ? printNode(statement) : `\n${raw}\n`;
          });
        })
        .join('\n');
    }

    if (macro.name === 'AUTOVAR') {
      const scope = macro.args[1];

      const variables =
        scope === 'parent'
          ? caller.templateScopes?.at(-1)?.variables
          : scope?.startsWith('ancestor:')
            ? caller.templateScopes?.findLast(
                (frame) => frame.definition.name === scope.slice('ancestor:'.length),
              )?.variables
            : autoVars;

      const variable = variables?.get(name);

      if (!variable)
        return conversionError(
          'AUTOVAR_TYPE',
          'Auto-variable has no declaration or inferable parameter type',
          {
            name,

            call: refKey(call),

            definition: refKey(definition),

            scope,

            templateScopes:
              caller.templateScopes?.map((frame) => ({
                definition: refKey(frame.definition),
                name: frame.definition.name,
              })) ?? [],
          },
        );

      const { identifier, type } = variable;

      if (!ctx.autoVarDeclarations.some((stmt) => stmt.name?.name === identifier))
        ctx.autoVarDeclarations.push(createVariableDeclaration(type, identifier));

      return identifier;
    }

    if (macro.name === 'DEFRETURN') {
      const value = defaultReturnSource(ctx.returnType);

      if (value !== undefined) return value;

      return conversionError(
        'RETURN_CONTEXT',
        'Default-return macro requires an explicit supported function return context',
        {
          definition: refKey(definition),
          returnType: ctx.returnType,
        },
      );
    }

    if (macro.name === 'SMARTBREAK') {
      // The editor omits this macro when no enclosing loop can consume it.

      // ponytail: template-scope check; use AST loop scope if a template mixes sibling loops and SMARTBREAK.

      const inLoop = ctx.templateScopes?.some((scope) =>
        /\b(?:for|while)\s*\(|\bdo\s*\{/u.test(scope.definition.scriptCode ?? ''),
      );

      return inLoop ? 'break;' : '';
    }

    if (macro.name === 'SMARTCONTINUE') return 'continue;';

    return conversionError('TEMPLATE_MACRO', 'Unsupported ScriptCode macro', {
      macro: macro.name,
      definition: refKey(definition),
    });
  });
}

/** Infer untyped temporaries from the parsed assignments and loaded function declarations. */

/** Stand-in names for the text fallback below. The Galaxy scanner rejects an































 *  identifier that starts with an underscore, so these begin with a letter; they































 *  exist only inside a throwaway parse and never reach the output. */

const AUTO_HOLE = 'holeTemplateAuto';

const PARAM_HOLE = 'holeTemplateParam';

function inferAutoTypes(call, definition, ctx, libraries, variables) {
  const macrosOf = templateMacros;

  const macros = macrosOf(definition.scriptCode ?? '');

  const assignedNames = new Set(
    macros
      .filter(
        (macro) =>
          macro.name === 'AUTOVAR' &&
          !macro.args[1] &&
          /^\s*=/u.test((definition.scriptCode ?? '').slice(macro.end)),
      )
      .map((macro) => macro.args[0]),
  );

  for (const name of assignedNames)
    if (variables.get(name)?.identifier !== `auto${call.id}_${name}`) variables.delete(name);

  if (![...assignedNames].some((name) => !variables.has(name))) return;

  // An authored template can put a macro where Galaxy expects an operator, which

  // leaves the template uncompilable. That must not disable typing for the

  // auto-variables whose initializer stands on its own.

  const template = compileTemplate(definition, libraries);

  // Every nested render clones the context, so a cache written onto `ctx` dies

  // with the clone and this rescanned all loaded libraries -- 31k elements for

  // NativeLib alone -- per template. The naming indexes outlive the clones and

  // exist for exactly this; they end with the conversion, so an edited library

  // is still read afresh.

  const returnTypes = ctx.templateReturnTypes ?? namingIndexes().templateReturnTypes;

  if (!returnTypes.size) {
    for (const library of libraries) {
      for (const element of Object.values(library.elements)) {
        if (element.type !== 'FunctionDef' || !element.returnType) continue;

        const definitionElement = element;

        if (isInlineTemplate(definitionElement)) continue;

        returnTypes.set(
          toGalaxyFunctionName(definitionElement, ctx),
          mapParameterTypeToGalaxy(
            definitionElement.returnType,
            ctx.library,
            ctx.nativeLibrary,
            ctx.allLibraries,
          ),
        );
      }
    }
  }

  ctx.templateReturnTypes = returnTypes;

  const typeOf = (node) => {
    if (!node) return undefined;

    if (node.kind === 126 /* SyntaxKind.ParenthesizedExpression */) return typeOf(node.expression);

    if (node.kind === 2 /* SyntaxKind.NumericLiteral */)
      return !/^0x/iu.test(node.text ?? '') && /[.eE]/u.test(node.text ?? '') ? 'fixed' : 'int';

    if (node.kind === 3 /* SyntaxKind.StringLiteral */) return 'string';

    if (
      node.kind === 67 /* SyntaxKind.TrueKeyword */ ||
      node.kind === 68 /* SyntaxKind.FalseKeyword */
    )
      return 'bool';

    if (node.kind === 122 /* SyntaxKind.PrefixUnaryExpression */)
      return node.operator?.kind === 32 /* SyntaxKind.ExclamationToken */
        ? 'bool'
        : typeOf(node.operand);

    if (node.kind === 124 /* SyntaxKind.BinaryExpression */) {
      // The language fixes these: a comparison or a logical operator yields bool,

      // an arithmetic one yields the type of its operands.

      const operator = node.operatorToken?.kind;

      if (
        [
          17 /* SyntaxKind.EqualsEqualsToken */, 18 /* SyntaxKind.ExclamationEqualsToken */,
          13 /* SyntaxKind.LessThanToken */,

          15 /* SyntaxKind.LessThanEqualsToken */, 14 /* SyntaxKind.GreaterThanToken */,
          16 /* SyntaxKind.GreaterThanEqualsToken */,

          34 /* SyntaxKind.AmpersandAmpersandToken */, 35 /* SyntaxKind.BarBarToken */,
        ].includes(operator)
      )
        return 'bool';

      return typeOf(node.left) ?? typeOf(node.right);
    }

    if (node.kind === 113 /* SyntaxKind.Identifier */) {
      // Names the text fallback substituted for a macro it could resolve itself.

      if (node.name.startsWith(AUTO_HOLE))
        return variables.get(node.name.slice(AUTO_HOLE.length))?.type;

      const hole = template?.holes.get(node.name);

      if (hole?.kind === 'auto') return variables.get(hole.name)?.type;

      const ref =
        hole?.kind === 'parameter'
          ? template?.parameters.get(hole.name)
          : node.name.startsWith(PARAM_HOLE)
            ? templateParameters(definition, libraries).get(node.name.slice(PARAM_HOLE.length))
            : undefined;

      const formal = ref
        ? resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries)
        : undefined;

      if (formal) {
        const actual = (call.parameters ?? [])
          .map((ref) => resolveRefFull(ref, ctx.library, ctx.nativeLibrary, ctx.allLibraries))

          .find(
            (param) =>
              param?.parameterDef &&
              refKey(param.parameterDef, call.library) === refKey(ref, definition.library),
          );

        const type = actual && actualParameterType(actual, ctx);

        return mapParameterTypeToGalaxy(
          type ?? formal.paramType,
          ctx.library,
          ctx.nativeLibrary,
          ctx.allLibraries,
        );
      }

      // Authored templates can save globals without mentioning a PARAM macro.

      // Resolve the exact generated symbol from loaded declarations, not its prefix.

      let globals = ctx.templateGlobalTypes;

      if (!globals?.size) {
        globals = new Map(
          libraries.flatMap((library) => {
            const declarations = globalVariables(library);

            const names = globalVariableNames(library.id, declarations);

            return declarations.map((variable) => [
              names.get(variable.id),
              mapParameterTypeToGalaxy(
                variable.variableType,
                library,
                ctx.nativeLibrary,
                ctx.allLibraries,
              ),
            ]);
          }),
        );

        ctx.templateGlobalTypes = globals;
      }

      return globals.get(node.name);
    }

    // A trigger model need not describe every native; a supplied declaration does.

    if (node.kind === 121 /* SyntaxKind.CallExpression */)
      return (
        returnTypes.get(node.expression?.name) ??
        declaredReturnType(ctx.nativeLibrary, node.expression?.name)
      );

    return undefined;
  };

  const assignments = [];

  if (template) {
    const pending = [...template.nodes];

    while (pending.length) {
      const node = pending.pop();

      if (
        node?.kind === 124 /* SyntaxKind.BinaryExpression */ &&
        node.operatorToken?.kind === 39 /* SyntaxKind.EqualsToken */
      )
        assignments.push({ left: node.left, right: node.right });

      pending.push(...syntaxChildren(node));
    }
  } else {
    const code = definition.scriptCode ?? '';

    for (const macro of macrosOf(code)) {
      if (macro.name !== 'AUTOVAR' || macro.args[1]) continue;

      const initializer = /^\s*=\s*([^;]*);/u.exec(code.slice(macro.end))?.[1];

      if (initializer === undefined) continue;

      // Stand in for the two macros whose value this pass can decide on its own;

      // any other macro needs the substitutions a compiled template supplies.

      const substituted = initializer

        .replace(/#AUTOVAR\((\w+)\)/gu, (_, inner) => `${AUTO_HOLE}${inner}`)

        .replace(/#PARAM\((\w+)\)/gu, (_, inner) => `${PARAM_HOLE}${inner}`);

      if (/#[A-Za-z]+\(/u.test(substituted)) continue;

      const nodes = parseTemplateFragment(substituted, true);

      if (nodes?.[0]) assignments.push({ auto: macro.args[0], right: nodes[0] });
    }
  }

  for (let pass = 0; pass < assignments.length; pass++) {
    let changed = false;

    for (const assignment of assignments) {
      const hole = assignment.left ? template?.holes.get(assignment.left?.name) : undefined;

      const name = assignment.auto ?? (hole?.kind === 'auto' ? hole.name : undefined);

      if (name === undefined || variables.has(name)) continue;

      const type = typeOf(assignment.right);

      if (type) {
        variables.set(name, { identifier: `auto${call.id}_${name}`, type });

        changed = true;
      }
    }

    if (!changed) break;
  }
}

//# sourceMappingURL=ttg-template.js.map
