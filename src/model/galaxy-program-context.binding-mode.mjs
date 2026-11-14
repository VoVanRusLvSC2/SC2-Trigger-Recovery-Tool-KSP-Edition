/** One map's semantic host. Existing parser/binder/checker, private AST copies,
 * explicit include identities and side tables. Never serializes checker fields.
 */
import {
  Parser,
  bindSourceFile,
  TypeChecker,
  SyntaxKind as K,
  TypeFlags,
  DiagnosticCategory,
  forEachChild,
  isPartOfExpression,
  normalizeGalaxyIncludeIdentity,
  tokenToString,
} from '../sdk/array-values/modules/galaxy/language-core/index.js';
const semanticKeys = [
  'kind',
  'name',
  'typeName',
  'typeArguments',
  'returnType',
  'elementType',
  'size',
  'expression',
  'left',
  'right',
  'operatorToken',
  'value',
  'text',
];
export function declarationTypeKey(node) {
  if (!node) return 'unknown';
  const clean = (n) =>
    !n || typeof n !== 'object'
      ? n
      : Array.isArray(n)
        ? n.map(clean)
        : Object.fromEntries(
            semanticKeys.filter((k) => n[k] !== undefined).map((k) => [k, clean(n[k])]),
          );
  return JSON.stringify(clean(node));
}
export function declaredCarrier(node) {
  if (!node) return 'unknown';
  if (node.kind === K.ArrayType) return declaredCarrier(node.elementType) + '[]';
  if (node.typeArguments && node.returnType)
    return (
      declaredCarrier(node.returnType) +
      '<' +
      node.typeArguments.map(declaredCarrier).join(',') +
      '>'
    );
  return typeof node.name === 'string'
    ? node.name
    : (node.typeName?.name ?? tokenToString(node.kind) ?? 'unknown');
}
const signature = (d) =>
  JSON.stringify([
    d.kind,
    declarationTypeKey(d.type),
    d.parameters?.map((p) => declarationTypeKey(p.type)),
  ]);
const idOf = (input, n) =>
  `${input.sourceId}|${input.contentSha256 ?? 'UNVERIFIED'}|${input.fileName}|${n.pos}:${n.end}:${n.kind}`;
export class GalaxyProgramContext {
  documents = new Map();
  qualifiedDocuments = new Map();
  diagnostics = [];
  snapshot;
  originals = new WeakMap();
  inputs = new Map();
  verifiedIdentityFiles = new Set();
  nodes = new Map();
  globals = new Map();
  conflicts = new Set();
  diagnosticKeys = new Set();
  omittedDiagnostics = 0;
  errorCount = 0;
  annotations = new WeakMap();
  functionLocals = new WeakMap();
  checker;
  closed = false;
  bindingOnly = false;
  constructor(inputs, snapshot, hashText, { checks = 'semantic' } = {}) {
    if (!['semantic', 'binding'].includes(checks)) throw new Error('UNKNOWN_PROGRAM_CHECK_ROLE');
    this.bindingOnly = checks === 'binding';
    this.snapshot = snapshot ? structuredClone(snapshot) : undefined;
    if (!snapshot)
      this.diagnostics.push({
        code: 'INPUT_SNAPSHOT_INCOMPLETE',
        severity: 'incomplete',
        message: 'No content/build/dependency snapshot supplied; full source proof is unavailable',
      });
    if (!hashText)
      this.diagnostics.push({
        code: 'CONTENT_VERIFIER_INCOMPLETE',
        severity: 'incomplete',
        message: 'No hash verifier supplied; claimed input digests are not verified',
      });
    if (inputs.length > 2048 || inputs.reduce((a, x) => a + x.text.length, 0) > 128 * 1024 * 1024)
      throw new Error('Program semantic input exceeds per-map bound');
    const declarations = new Map();
    for (const offeredInput of inputs) {
      const input = Object.freeze({
        ...offeredInput,
        includeNames: offeredInput.includeNames ? [...offeredInput.includeNames] : undefined,
      });
      if (this.documents.has(input.fileName))
        throw new Error('Duplicate logical source file: ' + input.fileName);
      const source = new Parser().parseFile(input.fileName, input.text);
      this.documents.set(input.fileName, source);
      this.inputs.set(input.fileName, input);
      if (!input.contentSha256)
        this.diagnostics.push({
          code: 'CONTENT_IDENTITY_INCOMPLETE',
          severity: 'incomplete',
          file: input.fileName,
          message: 'Content SHA is absent',
        });
      if (input.contentSha256 && hashText && hashText(input.text) !== input.contentSha256)
        throw new Error('Source content SHA mismatch: ' + input.fileName);
      if (input.contentSha256 && hashText) this.verifiedIdentityFiles.add(input.fileName);
      if (
        snapshot &&
        !snapshot.files.some(
          (f) =>
            f.fileName === input.fileName &&
            f.sourceId === input.sourceId &&
            f.contentSha256 === input.contentSha256,
        )
      )
        throw new Error('Source is outside InputSnapshot: ' + input.fileName);
      for (const d of source.parseDiagnostics)
        this.diagnostics.push({
          code: 'GALAXY_SYNTAX',
          severity: 'error',
          file: input.fileName,
          start: d.start ?? 0,
          end: (d.start ?? 0) + (d.length ?? 0),
          message: String(d.messageText),
        });
      const aliases = new Set([input.fileName, ...(input.includeNames ?? [])]);
      const normalized = input.fileName.replaceAll('\\', '/');
      const trigger = normalized.toLowerCase().lastIndexOf('triggerlibs/');
      if (trigger >= 0) aliases.add(normalized.slice(trigger));
      for (const alias of aliases) {
        const key = normalizeGalaxyIncludeIdentity(alias);
        let group = this.qualifiedDocuments.get(key);
        if (!group) this.qualifiedDocuments.set(key, (group = new Map()));
        group.set(input.fileName, source);
      }
      for (const n of source.statements) {
        if (!n.name?.name || n.modifiers?.some((m) => m.kind === K.StaticKeyword)) continue;
        const group = declarations.get(n.name.name) ?? [];
        group.push({ input, node: n });
        declarations.set(n.name.name, group);
      }
    }
    for (const [name, group] of declarations) {
      const keys = new Set(group.map((x) => signature(x.node)));
      const bodies = group.filter((x) => x.node.kind === K.FunctionDeclaration && x.node.body);
      const other = group.filter((x) => x.node.kind !== K.FunctionDeclaration);
      const repeatedConstEvidence =
        other.length > 1 &&
        keys.size === 1 &&
        group.every(
          (x) => !x.input.owned && x.node.modifiers?.some((m) => m.kind === K.ConstKeyword),
        ) &&
        new Set(group.map((x) => declarationTypeKey(x.node.initializer))).size === 1;
      if (repeatedConstEvidence)
        this.record({
          code: 'REDUNDANT_CONSTANT_EVIDENCE',
          severity: 'incomplete',
          file: group[0].input.fileName,
          message: `Identical ${name} declaration appears in more than one dependency evidence source; exact include-view proof still required`,
        });
      if (keys.size > 1 || bodies.length > 1 || (other.length > 1 && !repeatedConstEvidence)) {
        // Compatible function prototype/body pairs are merged by the real binder.
        // Conflicting declarations must not be selected by source iteration order.
        this.conflicts.add(name);
        this.record({
          code: 'AMBIGUOUS_DECLARATION',
          severity: 'error',
          message: `Conflicting active declarations for ${name}`,
          file: group[0].input.fileName,
          start: group[0].node.pos,
          end: group[0].node.end,
        });
      }
    }
    const host = {
      documents: this.documents,
      qualifiedDocuments: this.qualifiedDocuments,
      resolveGlobalSymbol: (name) =>
        this.conflicts.has(name) ? undefined : this.globals.get(name),
      resolveQualifiedDocuments: (name) => {
        const group = this.qualifiedDocuments.get(normalizeGalaxyIncludeIdentity(name));
        if (group && group.size > 1) {
          this.record({
            code: 'AMBIGUOUS_INCLUDE',
            severity: 'error',
            message: 'Multiple active sources for include ' + name,
          });
          return undefined;
        }
        return group;
      },
      getDocument: (name) => this.documents.get(name),
    };
    for (const [file, source] of this.documents) {
      bindSourceFile(source, host);
      for (const [name, symbol] of source.symbol.members) {
        if (symbol.declarations[0]?.modifiers?.some((m) => m.kind === K.StaticKeyword)) continue;
        if (!this.conflicts.has(name)) this.globals.set(name, symbol);
      }
      const walk = (n) => {
        this.nodes.set(this.key(file, n), n);
        forEachChild(n, walk);
      };
      walk(source);
      for (const fn of source.statements) {
        if (fn.kind !== K.FunctionDeclaration) continue;
        const names = new Map();
        this.functionLocals.set(fn, names);
        const add = (n) => {
          if (![K.ParameterDeclaration, K.VariableDeclaration].includes(n.kind)) return;
          if (names.has(n.name.name))
            this.record({
              code: 'LOCAL_SCOPE_COLLISION',
              severity: 'error',
              file,
              start: n.pos,
              end: n.end,
              message: 'Duplicate function-local declaration ' + n.name.name,
            });
          else names.set(n.name.name, n);
        };
        fn.parameters.forEach(add);
        const visit = (n) => {
          add(n);
          forEachChild(n, visit);
        };
        if (fn.body) visit(fn.body);
      }
    }
    this.checker = new TypeChecker(host);
    if (!this.bindingOnly)
      for (const source of this.documents.values()) {
        try {
          for (const d of this.checker.checkSourceFile(source, false) ?? [])
            this.record({
              code: 'TYPE_CHECKER',
              severity: d.category === DiagnosticCategory.Error ? 'error' : 'warning',
              file: source.fileName,
              start: d.start ?? 0,
              end: (d.start ?? 0) + (d.length ?? 0),
              message: String(d.messageText),
            });
        } catch (error) {
          this.record({
            code: 'TYPE_CHECKER_INCOMPLETE',
            severity: 'incomplete',
            file: source.fileName,
            message: String(error),
          });
        }
        const checkReferences = (node) => {
          if (node.kind === K.CallExpression) {
            const symbol = this.checker.getSymbolAtLocation(node.expression),
              declaration = symbol?.valueDeclaration ?? symbol?.declarations[0];
            for (let i = 0; i < (declaration?.parameters?.length ?? 0); i++) {
              const formal = declaration.parameters[i].type,
                argument = node.arguments[i];
              if (
                formal?.kind === K.MappedType &&
                [K.StructrefKeyword, K.ArrayrefKeyword].includes(formal.returnType?.kind)
              ) {
                if (
                  !argument ||
                  ![K.Identifier, K.PropertyAccessExpression, K.ElementAccessExpression].includes(
                    argument.kind,
                  )
                )
                  this.record({
                    code: 'REFERENCE_REQUIRES_LVALUE',
                    severity: 'error',
                    file: source.fileName,
                    start: argument?.pos ?? node.pos,
                    end: argument?.end ?? node.end,
                    message: 'Reference parameter requires an actual bound lvalue',
                  });
                else {
                  const argumentSymbol = this.checker.getSymbolAtLocation(argument);
                  if (
                    argumentSymbol?.declarations.some((d) =>
                      d.modifiers?.some((m) => m.kind === K.ConstKeyword),
                    )
                  )
                    this.record({
                      code: 'REFERENCE_TO_CONSTANT',
                      severity: 'error',
                      file: source.fileName,
                      start: argument.pos,
                      end: argument.end,
                      message: 'Mutable reference cannot bind a constant',
                    });
                }
              }
            }
          }
          forEachChild(node, checkReferences);
        };
        try {
          checkReferences(source);
        } catch (error) {
          this.record({
            code: 'REFERENCE_CHECK_INCOMPLETE',
            severity: 'incomplete',
            file: source.fileName,
            message: String(error),
          });
        }
      }
  }
  record(d) {
    const key = JSON.stringify(d);
    if (this.diagnosticKeys.has(key)) return;
    this.diagnosticKeys.add(key);
    if (d.severity === 'error') this.errorCount++;
    if (this.diagnostics.length >= 1024) {
      this.omittedDiagnostics++;
      return;
    }
    this.diagnostics.push(d);
  }
  key(file, n) {
    return `${file}|${n.pos}:${n.end}:${n.kind}`;
  }
  attachOriginal(source, logicalName = source.fileName) {
    this.assertOpen();
    const input = this.inputs.get(logicalName);
    if (!input) throw new Error('Source is outside semantic snapshot: ' + logicalName);
    if (source.text !== input.text) throw new Error('Source text differs from semantic snapshot');
    const walk = (n) => {
      this.originals.set(n, input);
      forEachChild(n, walk);
    };
    walk(source);
  }
  location(node) {
    const input = this.originals.get(node);
    if (!input) return undefined;
    let owner = node;
    while (owner.parent && owner.kind !== K.FunctionDeclaration) owner = owner.parent;
    return {
      sourceFile: input.fileName,
      start: node.pos,
      end: node.end,
      owner: owner.name?.name ?? input.fileName,
      sourceId: input.sourceId,
      contentSha256: input.contentSha256,
    };
  }
  getBinding(node) {
    this.assertOpen();
    const prior = this.annotations.get(node);
    if (prior) return prior;
    const input = this.originals.get(node),
      file = input?.fileName ?? '';
    const semantic = input && this.nodes.get(this.key(file, node));
    const result = { status: 'UNKNOWN', file, start: node.pos, end: node.end };
    if (!semantic) return result;
    const name = semantic.name;
    if (typeof name === 'string' && this.conflicts.has(name)) {
      result.status = 'AMBIGUOUS';
      this.annotations.set(node, result);
      return result;
    }
    try {
      let symbol = this.checker.getSymbolAtLocation(semantic);
      // The inherited binder merges prototype and definition parameter members.
      // A prototype's parameter is not visible in another declaration's body.
      // Diagnose that leak rather than treating it as a bound GUI variable.
      let fn = semantic;
      while (fn && fn.kind !== K.FunctionDeclaration) fn = fn.parent;
      if (
        fn &&
        semantic.kind === K.Identifier &&
        symbol?.declarations.some((d) => d.kind === K.ParameterDeclaration) &&
        !this.functionLocals.get(fn)?.has(semantic.name)
      ) {
        this.record({
          code: 'PROTOTYPE_PARAMETER_SCOPE_LEAK',
          severity: 'error',
          file,
          start: node.pos,
          end: node.end,
          message: 'Identifier resolved only to another function declaration parameter',
        });
        this.annotations.set(node, result);
        return result;
      }
      if (symbol) {
        result.declarations = symbol.declarations
          .map((d) => {
            let owner = d;
            while (owner.parent) owner = owner.parent;
            const i = this.inputs.get(owner.fileName);
            return idOf(i, d);
          })
          .sort();
        result.symbolId = result.declarations[0];
        result.status = 'BOUND';
      }
      if (!this.bindingOnly && isPartOfExpression(semantic)) {
        const type = this.checker.getTypeOfNode(semantic, true);
        result.type = type.getName();
        if (type.flags & TypeFlags.Unknown) {
          this.record({
            code: 'UNKNOWN_NODE_TYPE',
            severity: 'incomplete',
            file,
            start: node.pos,
            end: node.end,
            message: 'Checker returned unknown type',
          });
        } else
          result.carrier =
            type.flags & TypeFlags.Integer
              ? 'int'
              : type.flags & TypeFlags.Fixed
                ? 'fixed'
                : type.flags & TypeFlags.Boolean
                  ? 'bool'
                  : type.flags & TypeFlags.String
                    ? 'string'
                    : type.getName();
      }
    } catch (error) {
      this.record({
        code: 'SEMANTIC_QUERY_INCOMPLETE',
        severity: 'incomplete',
        file,
        start: node.pos,
        end: node.end,
        message: String(error),
      });
    }
    this.annotations.set(node, result);
    return result;
  }
  declarationAt(node) {
    const input = this.originals.get(node);
    if (!input) return undefined;
    const semantic = this.nodes.get(this.key(input.fileName, node));
    if (!semantic) return undefined;
    const symbol = this.checker.getSymbolAtLocation(semantic);
    return symbol?.valueDeclaration ?? symbol?.declarations[0];
  }
  verifiedInputIdentity(fileName) {
    this.assertOpen();
    const input = this.inputs.get(fileName);
    if (!input?.contentSha256 || !this.verifiedIdentityFiles.has(fileName)) return undefined;
    return Object.freeze({
      owned: input.owned,
      sourceId: input.sourceId,
      contentSha256: input.contentSha256,
    });
  }
  conflictingDeclarationNames() {
    return [...this.conflicts].sort();
  }
  report() {
    this.assertOpen();
    return {
      bindingOnly: this.bindingOnly,
      semanticValidationPerformed: !this.bindingOnly,
      status:
        this.errorCount ||
        this.conflicts.size ||
        this.diagnostics.some((d) => d.severity === 'error')
          ? 'INVALID'
          : this.omittedDiagnostics || this.diagnostics.some((d) => d.severity === 'incomplete')
            ? 'INCOMPLETE'
            : this.bindingOnly
              ? 'BOUND_ONLY'
              : 'CHECKED',
      documents: this.documents.size,
      diagnostics: this.diagnostics.map((x) => ({ ...x })),
      diagnosticsOmitted: this.omittedDiagnostics,
      errorCount: this.errorCount,
      snapshot: this.snapshot
        ? {
            buildIdentity: this.snapshot.buildIdentity,
            locale: this.snapshot.locale,
            adaptation: this.snapshot.adaptation,
          }
        : null,
      fullProofAvailable:
        !this.bindingOnly &&
        !this.errorCount &&
        !this.omittedDiagnostics &&
        this.diagnostics.every((d) => d.severity !== 'error' && d.severity !== 'incomplete'),
    };
  }
  assertOpen() {
    if (this.closed) throw new Error('Program context was disposed');
  }
  dispose() {
    this.closed = true;
    this.documents.clear();
    this.qualifiedDocuments.clear();
    this.nodes.clear();
    this.globals.clear();
    this.inputs.clear();
    this.verifiedIdentityFiles.clear();
    this.annotations = new WeakMap();
    this.originals = new WeakMap();
    this.functionLocals = new WeakMap();
  }
}
