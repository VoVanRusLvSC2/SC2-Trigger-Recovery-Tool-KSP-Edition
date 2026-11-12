import path from 'node:path';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { guiLibrarySignature } from './gui-signature.mjs';

export async function readGalaxyComparisonPair(inputs, outputs, inputRole, outputRole, libraryId) {
  const [expected, output] = await Promise.all([
    readFile(inputs.get(inputRole), 'utf8'), readFile(outputs.get(outputRole), 'utf8'),
  ]);
  const inputHeader = inputRole === 'script' ? 'header' : 'expected-header';
  const outputHeader = outputRole === 'roundtrip-script' ? 'roundtrip-header'
    : outputRole === 'original-script' ? 'original-header' : 'header';
  if (!inputRole.endsWith('script') || inputs.has(inputHeader) || !outputs.has(outputHeader)) {
    return { expected, actual: output };
  }
  // The source may embed globals in MapScript.galaxy while the converter
  // moves them to its header. Compare the two complete logical programs.
  const header = await readFile(outputs.get(outputHeader), 'utf8');
  const generatedInclude = libraryId === undefined ? undefined : `include "Lib${libraryId}_h"`;
  return {
    expected,
    actual: `${header}\n${output.split(/\r?\n/u).filter(line => line.trim() !== generatedInclude).join('\n')}`,
  };
}

export async function loadConversionOracle(moduleSpec, baseDirectory = process.cwd()) {
  const moduleUrl = moduleSpec.startsWith('file:')
    ? new URL(moduleSpec)
    : pathToFileURL(path.resolve(baseDirectory, moduleSpec));
  const publicApi = await import(moduleUrl.href);
  let galaxyLanguageCore;
  try { galaxyLanguageCore = await import(new URL('../../../galaxy/language-core/index.js', moduleUrl)); }
  catch { /* Other AST oracles may not ship ModKit's Galaxy scanner. */ }
  const tokenizeGalaxyLines = galaxyLanguageCore && ((source) => {
    const { Scanner, SyntaxKind, isKeywordKind, isKeywordTypeKind } = galaxyLanguageCore;
    const scanner = new Scanner();
    return source.split(/\r?\n/u).map(line => {
      scanner.setText(line);
      const tokens = [];
      let kind;
      while ((kind = scanner.scan()) !== SyntaxKind.EndOfFileToken) {
        const start = scanner.getTokenPos(), token = scanner.getTokenText();
        const category = kind === SyntaxKind.SingleLineCommentTrivia ? 'comment'
          : kind === SyntaxKind.StringLiteral ? 'string'
          : kind === SyntaxKind.NumericLiteral ? 'number'
          : kind === SyntaxKind.TrueKeyword || kind === SyntaxKind.FalseKeyword || kind === SyntaxKind.NullKeyword ? 'literal'
          : isKeywordKind(kind) && isKeywordTypeKind(kind) ? 'type'
          : isKeywordKind(kind) ? 'keyword'
          : kind === SyntaxKind.Identifier && /^\s*\(/u.test(line.slice(start + token.length)) ? 'function'
          : null;
        if (category) tokens.push([start, start + token.length, category]);
      }
      return tokens;
    });
  });
  let parseGalaxySource = publicApi.parseGalaxySource;
  if (typeof parseGalaxySource !== 'function' && moduleUrl.protocol === 'file:') {
    try { ({ parseGalaxySource } = await import(new URL('./internal/galaxy-to-trigger.js', moduleUrl))); }
    catch {}
  }
  let triggerDocumentApi = null;
  if (moduleUrl.protocol === 'file:') {
    try { triggerDocumentApi = await import(new URL('../../shared/trigger-document/index.js', moduleUrl)); }
    catch {}
  }
  const compareGalaxyAst = typeof publicApi.compareGalaxyPrograms === 'function'
    ? (expected, actual, options) => publicApi.compareGalaxyPrograms(expected, actual, options)
    : null;
  const compareGalaxy = compareGalaxyAst && typeof parseGalaxySource === 'function'
    ? (expected, actual, options) => compareGalaxyAst(
        parseGalaxySource(expected, 'benchmark-expected.galaxy'),
        parseGalaxySource(actual, 'benchmark-actual.galaxy'),
        options,
      )
    : null;

  function inspectTriggerDataCounts(triggerData) {
    const typeCounts = {};
    for (const [, , type] of triggerData.matchAll(/<Element\b[^>]*\bType\s*=\s*(['"])([^'"]+)\1[^>]*>/giu)) {
      typeCounts[type] = (typeCounts[type] ?? 0) + 1;
    }
    return {
      status: 'parsed-elements',
      elementCount: Object.values(typeCounts).reduce((total, count) => total + count, 0),
      typeCounts,
      guiTriggerCount: typeCounts.Trigger ?? 0,
      customScriptTagCount: [...triggerData.matchAll(/<ScriptCode(?:\s[^>]*)?>[\s\S]*?<\/ScriptCode\s*>/giu)].length,
      triggerLocalVariableCount: null,
    };
  }

  async function inspectTriggerData(triggerData, triggerStrings) {
    if (typeof triggerData !== 'string') return { status: 'unavailable' };
    if (typeof triggerDocumentApi?.readTriggerLibraryFast !== 'function') return inspectTriggerDataCounts(triggerData);
    try {
      const parsed = await triggerDocumentApi.readTriggerLibraryFast(triggerData, triggerStrings);
      const library = parsed.library;
      const elements = Object.values(library?.elements ?? {});
      const typeCounts = triggerDocumentApi.triggerLibraryTypeCounts?.(library)
        ?? elements.reduce((counts, element) => {
          counts[element.type] = (counts[element.type] ?? 0) + 1;
          return counts;
        }, {});
      const localVariableIds = new Set();
      for (const element of elements) {
        if (element.type === 'Trigger' || element.type === 'FunctionDef') {
          for (const ref of element.localVariables ?? []) localVariableIds.add(ref.id);
        }
      }
      return {
        status: 'parsed',
        elementCount: elements.length,
        typeCounts,
        semanticHash: guiLibrarySignature(library),
        guiTriggerCount: typeCounts.Trigger ?? 0,
        customScriptTagCount: elements.filter(element => typeof element.scriptCode === 'string' && element.scriptCode.length > 0).length,
        triggerLocalVariableCount: localVariableIds.size,
      };
    } catch (error) {
      if (String(error).includes('No libraries found in trigger XML')) return inspectTriggerDataCounts(triggerData);
      return { status: 'invalid', error: String(error) };
    }
  }

  function compareGuiFidelity(expected, actual) {
    if (expected.status.startsWith('invalid') || actual.status.startsWith('invalid')
        || expected.status === 'unavailable' || actual.status === 'unavailable') {
      return { status: 'inconclusive', expectedStatus: expected.status, actualStatus: actual.status };
    }
    const nonSemantic = new Set(['Category', 'Param', 'ParamDef']);
    const types = new Set([...Object.keys(expected.typeCounts ?? {}), ...Object.keys(actual.typeCounts ?? {})]);
    const typeDifferences = Object.fromEntries([...types].sort().flatMap(type => {
      if (nonSemantic.has(type)) return [];
      const before = expected.typeCounts?.[type] ?? 0;
      const after = actual.typeCounts?.[type] ?? 0;
      return before === after ? [] : [[type, { expected: before, actual: after }]];
    }));
    const differences = {
      ...(Object.keys(typeDifferences).length ? { typeCounts: typeDifferences } : {}),
      ...(expected.customScriptTagCount !== actual.customScriptTagCount
        ? { customScriptTagCount: { expected: expected.customScriptTagCount, actual: actual.customScriptTagCount } }
        : {}),
      ...(Number.isFinite(expected.triggerLocalVariableCount) && Number.isFinite(actual.triggerLocalVariableCount)
        && expected.triggerLocalVariableCount !== actual.triggerLocalVariableCount
        ? { triggerLocalVariableCount: { expected: expected.triggerLocalVariableCount, actual: actual.triggerLocalVariableCount } }
        : {}),
    };
    const metrics = value => ({
      typeCounts: value.typeCounts,
      customScriptTagCount: value.customScriptTagCount,
      triggerLocalVariableCount: value.triggerLocalVariableCount,
      semanticHash: value.semanticHash,
    });
    if (!expected.semanticHash || !actual.semanticHash) {
      return {
        status: Object.keys(differences).length === 0 ? 'inconclusive' : 'different',
        reason: 'semantic-trigger-structure-unavailable',
        differences,
        expected: metrics(expected),
        actual: metrics(actual),
      };
    }
    if (expected.semanticHash !== actual.semanticHash) {
      differences.semanticStructure = { expectedHash: expected.semanticHash, actualHash: actual.semanticHash };
    }
    return {
      status: Object.keys(differences).length === 0 ? 'equivalent-structure' : 'different',
      differences,
      expected: metrics(expected),
      actual: metrics(actual),
    };
  }

  return {
    compareGalaxy, compareGalaxyAst, parseGalaxySource, inspectTriggerData, compareGuiFidelity,
    pairedFunctionLocalNames: publicApi.pairedFunctionLocalNames,
    tokenizeGalaxyLines,
  };
}
