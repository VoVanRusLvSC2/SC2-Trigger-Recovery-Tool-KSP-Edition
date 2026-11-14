import { SyntaxKind as K, SymbolFlags } from './index-alternate-3.js';

// Keep the global callable symbol (and every prototype) unchanged. A function
// body's lexical table contains only its own parameters and local declarations.
// This runs before TypeChecker construction, so binding and type queries agree.
export function isolateFunctionBodyLexicalScopes(ast, functionLocals) {
  const records = [];
  for (const fn of ast.statements) {
    if (fn.kind !== K.FunctionDeclaration || !fn.body || !fn.symbol) continue;
    const foreign = [...fn.symbol.members.values()].some((symbol) =>
      symbol.declarations.some((d) => d.kind === K.ParameterDeclaration && d.parent !== fn),
    );
    if (!foreign) continue;
    const own = functionLocals.get(fn);
    if (!own) throw Error('FUNCTION_BODY_LEXICAL_TABLE_REQUIRED');
    const scope = { ...fn.symbol, members: new Map() };
    for (const [name, declaration] of own) {
      const prior = declaration.symbol;
      if (!prior) throw Error('FUNCTION_LOCAL_SYMBOL_REQUIRED');
      const symbol = {
        ...prior,
        declarations: [declaration],
        valueDeclaration: declaration,
        members: new Map(prior.members),
        parent: scope,
        flags:
          declaration.kind === K.ParameterDeclaration
            ? SymbolFlags.FunctionParameter
            : SymbolFlags.LocalVariable,
      };
      scope.members.set(name, symbol);
      declaration.symbol = symbol;
    }
    fn.symbol = scope;
    records.push({
      fileName: ast.fileName,
      functionName: fn.name.name,
      start: fn.pos,
      end: fn.end,
      parameters: fn.parameters.length,
      locals: own.size,
      globalCallableSymbolChanged: false,
      sourceTextChanged: false,
    });
  }
  return records;
}
