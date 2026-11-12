import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { loadConversionOracle, readGalaxyComparisonPair } from './conversion-oracle.mjs';
import { summarizeAstComparison } from './ast-metrics.mjs';

const MAX_DIAGNOSTIC_CODES = 12;
const MAX_DIFFERENCE_SAMPLES = 5;
const MAX_CHANGED_FUNCTIONS = 30;
const MAX_FUNCTION_SOURCE_CHARS = 20_000;

function counts(items, value) {
  return items.reduce((result, item) => {
    const key = value(item) ?? 'not-reported';
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
}

function median(values) {
  const sorted = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function cleanReason(text) {
  return text
    .replace(/^[A-Za-z]*Error:\s*/u, '')
    .replace('NativeLib CustomScript action FunctionDef is required for unresolved Galaxy statements', 'Missing NativeLib CustomScript definition')
    .replace('Editor object reference has no supported value codec', 'Unsupported editor object reference')
    .replace('Expanded ScriptCode is not valid Galaxy', 'Invalid Galaxy in expanded ScriptCode');
}

function processFailureReason(attempt) {
  if (attempt.timedOut || attempt.status === 'timeout') return 'Timed out';
  const line = attempt.error?.split(/\r?\n/u).map(value => value.trim())
    .find(value => /^[A-Za-z]*Error:\s/u.test(value));
  if (line) return cleanReason(line);
  return attempt.status === 'invalid-output' ? 'Invalid output' : 'Conversion failed';
}

function attemptReasons(attempt) {
  const reasons = [];
  if (attempt.status !== 'completed') {
    reasons.push(processFailureReason(attempt));
    return reasons;
  }
  if (attempt.conversionQuality?.completeness === 'partial') reasons.push('Partial conversion');
  if (attempt.roundtripConversion?.status === 'failed') reasons.push('Galaxy → Triggers conversion failed');
  if (['different', 'invalid-syntax'].includes(attempt.structuralComparison?.script?.status)) reasons.push('Roundtrip Galaxy differs');
  if (['different', 'invalid-syntax'].includes(attempt.structuralComparison?.originalScript?.status)) reasons.push('Original Triggers Galaxy differs');
  if (attempt.originalConversion?.status === 'failed') reasons.push('Original Triggers conversion failed');
  if (attempt.guiComparison?.status === 'different') reasons.push('GUI triggers differ');
  if (attempt.diagnosticsSummary?.byCode?.some(item => item.severity === 'error')) reasons.push('Conversion diagnostics');
  return reasons;
}

function shortStatus(group) {
  const failed = group.attempts.filter(item => item.status !== 'completed').length;
  const incorrect = group.attempts.filter(item => item.correctness === 'fail').length;
  if (failed === group.attempts.length) return 'Error';
  if (failed) return 'Mixed';
  if (incorrect) return 'Failed';
  if (group.attempts.some(item => item.correctness === 'warning')) return 'Warning';
  if (group.attempts.every(item => item.correctness === 'pass')) return 'Pass';
  return 'Inconclusive';
}

// Pure LCS-based line diff. Kept dependency-free so the exact same source can
// run server-side (Node) and client-side (embedded verbatim in the report).
export function diffFunctionLines(original, converted, aliases = {}) {
  function colorCalls(source) {
    const number = '[+-]?(?:\\d+(?:\\.\\d*)?|\\.\\d+)';
    const pattern = new RegExp(`\\b(Color|ColorWithAlpha)\\(\\s*(${number}(?:\\s*,\\s*${number}){2,3})\\s*\\)`, 'gu');
    const calls = [];
    let quote = null, blockComment = false, lineComment = false, scanned = 0;
    for (const match of source.matchAll(pattern)) {
      for (; scanned < match.index; scanned++) {
        const char = source[scanned], next = source[scanned + 1];
        if (lineComment) { if (char === '\n') lineComment = false; continue; }
        if (blockComment) { if (char === '*' && next === '/') { blockComment = false; scanned++; } continue; }
        if (quote) {
          if (char === '\\') scanned++;
          else if (char === quote) quote = null;
        } else if (char === '/' && next === '/') { lineComment = true; scanned++; }
        else if (char === '/' && next === '*') { blockComment = true; scanned++; }
        else if (char === '"' || char === "'") quote = char;
      }
      if (quote || blockComment || lineComment || source[match.index - 1] === '.') continue;
      const argumentStart = match.index + match[0].indexOf(match[2]);
      const tokens = [...match[2].matchAll(new RegExp(number, 'gu'))].map(item => ({
        text: item[0], start: argumentStart + item.index, end: argumentStart + item.index + item[0].length,
      }));
      if (tokens.length !== (match[1] === 'Color' ? 3 : 4) || tokens.some(token => !Number.isFinite(Number(token.text)))) continue;
      calls.push({ name: match[1], tokens });
    }
    return calls;
  }
  function canonicalizeColorNumbers(code) {
    const replacements = new Map(colorCalls(code).flatMap(call => call.tokens.map(token => [token.start, token])));
    const positions = [0];
    let key = '';
    for (let i = 0; i < code.length;) {
      const token = replacements.get(i);
      if (!token) { key += code[i++]; positions[i] = key.length; continue; }
      const numeric = String(Number(token.text));
      for (let at = i + 1; at < token.end; at++) positions[at] = key.length;
      key += numeric; positions[token.end] = key.length; i = token.end;
    }
    return { key, positions };
  }
  function canonicalizeIdentifiers(code, names) {
    const replacements = new Map(names ?? []), positions = new Array(code.length + 1);
    const renamed = [];
    let key = '', quote = null;
    for (let i = 0; i < code.length;) {
      positions[i] = key.length;
      const char = code[i];
      if (quote) {
        key += char;
        if (char === '\\' && i + 1 < code.length) { positions[++i] = key.length; key += code[i]; }
        else if (char === quote) quote = null;
        positions[++i] = key.length;
      } else if (char === '"' || char === "'") {
        quote = char; key += char; positions[++i] = key.length;
      } else if (/[_A-Za-z]/u.test(char)) {
        let end = i + 1;
        while (end < code.length && /[_A-Za-z0-9]/u.test(code[end])) end++;
        const word = code.slice(i, end);
        const replacement = code[i - 1] === '.' ? word : replacements.get(word) ?? word;
        const start = key.length;
        key += replacement;
        renamed.push({ start, end: key.length, word, sourceStart: i, sourceEnd: end });
        for (let at = i + 1; at < end; at++) positions[at] = positions[i];
        positions[end] = key.length;
        i = end;
      } else { key += char; positions[++i] = key.length; }
    }
    return { key, positions, renamed };
  }
  function matchingClose(source, open) {
    let depth = 0, quote = null;
    for (let i = open; i < source.length; i++) {
      const char = source[i];
      if (quote) {
        if (char === '\\') i++;
        else if (char === quote) quote = null;
      } else if (char === '"' || char === "'") quote = char;
      else if (char === '(') depth++;
      else if (char === ')' && --depth === 0) return i;
    }
    return -1;
  }
  function withoutRedundantParens(code) {
    const chars = Array.from(code, (char, index) => ({ char, index }));
    let changed = true;
    while (changed) {
      changed = false;
      let quote = null;
      const current = chars.map(item => item.char).join('');
      for (let open = 0; open < current.length; open++) {
        const char = current[open];
        if (quote) {
          if (char === '\\') open++;
          else if (char === quote) quote = null;
          continue;
        }
        if (char === '"' || char === "'") { quote = char; continue; }
        // `x==true` and `x!=false` are `x`: the GUI writes a condition so, hand-written code without.
        const comparison = /^(?:==true|!=false)(?![_A-Za-z0-9])/u.exec(current.slice(open))?.[0];
        if (comparison && /[_A-Za-z0-9)\]]/u.test(current[open - 1] ?? '')) {
          chars.splice(open, comparison.length);
          changed = true;
          break;
        }
        if (char !== '(') continue;
        const close = matchingClose(current, open);
        if (close < 0) break;
        const before = current.slice(0, open), inside = current.slice(open + 1, close), after = current.slice(close + 1);
        const wholeValue = after === ';' && (before.trimEnd() === 'return' || /[^=!<>+\-*/%&|^]=$/u.test(before));
        const unaryCall = before.endsWith('!') && /^[_A-Za-z][_A-Za-z0-9]*\(/u.test(inside)
          && matchingClose(inside, inside.indexOf('(')) === inside.length - 1;
        const wholeCondition = /(?:^|[^_A-Za-z0-9])(?:if|while)\($/u.test(before) && after.startsWith(')');
        const comparisonOperand = /(?:==|!=|<=|>=|<|>)/u.test(inside)
          && !/(?:&&|\|\||\?|:)/u.test(inside)
          && /(?:\(|&&|\|\|)$/u.test(before)
          && /^(?:\)|&&|\|\|)/u.test(after);
        const bareName = /^[_A-Za-z][_A-Za-z0-9]*$/u.test(inside) && !/[_A-Za-z0-9]$/u.test(before);
        if (!wholeValue && !unaryCall && !wholeCondition && !comparisonOperand && !bareName) continue;
        chars.splice(close, 1);
        chars.splice(open, 1);
        changed = true;
        break;
      }
    }
    const surviving = new Set(chars.map(item => item.index)), removed = [];
    let anchor = 0;
    for (let index = 0; index < code.length; index++) {
      if (surviving.has(index)) anchor++;
      else removed.push({ index, anchor, char: code[index] });
    }
    return { key: chars.map(item => item.char).join(''), removed, kept: chars.map(item => item.index) };
  }
  function comparableLines(source, names) {
    let blockComment = false;
    let previousCode = '';
    const lines = source.split(/\r?\n/u).flatMap((text, line) => {
      let code = '', quote = null, positions = [];
      for (let i = 0; i < text.length; i++) {
        const char = text[i], next = text[i + 1];
        if (blockComment) {
          if (char === '*' && next === '/') { blockComment = false; i++; }
        } else if (quote) {
          code += char; positions.push(i);
          if (char === '\\' && next) { code += text[++i]; positions.push(i); }
          else if (char === quote) quote = null;
        } else if (char === '/' && next === '*') { blockComment = true; i++; }
        else if (char === '/' && next === '/') break;
        else if (char === '"' || char === "'") { quote = char; code += char; positions.push(i); }
        else if (/\s/u.test(char)) {
          const nextWord = /\S/u.exec(text.slice(i + 1))?.[0];
          if (/[_A-Za-z0-9]/u.test(code.at(-1) ?? '') && /[_A-Za-z0-9]/u.test(nextWord ?? '')) {
            code += ' '; positions.push(i);
          }
        } else {
          if (char === '(' && /(?:^|[^_A-Za-z0-9])return$/u.test(code)) {
            code += ' '; positions.push(i);
          }
          code += char; positions.push(i);
        }
      }
      if (!code) return [];
      const inertSemicolon = code === ';' && /[;{}]$/u.test(previousCode);
      previousCode = code;
      const normalized = withoutRedundantParens(code);
      const canonical = canonicalizeIdentifiers(normalized.key, names);
      const colors = canonicalizeColorNumbers(canonical.key);
      return [{ text, line: line + 1, key: colors.key, inertSemicolon,
        redundantParens: normalized.removed.map(item => ({ ...item, anchor: colors.positions[canonical.positions[item.anchor]], textIndex: positions[item.index] })),
        renamed: canonical.renamed.map(item => ({ ...item, start: colors.positions[item.start], end: colors.positions[item.end],
          textIndices: normalized.kept.slice(item.sourceStart, item.sourceEnd).map(index => positions[index]),
        })) }];
    });
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index], sameLine = line.key === '}else{}';
      if (!sameLine && !(line.key === '}else{' && lines[index + 1]?.key === '}')) continue;
      line.key = '}';
      const elseAt = line.text.search(/\belse\b/u);
      line.neutralExtra = Array.from({ length: line.text.length - elseAt }, (_, at) => elseAt + at)
        .filter(at => /\S/u.test(line.text[at]));
      if (!sameLine) {
        const closing = lines[index + 1];
        closing.inertElse = true;
        closing.neutralExtra = [closing.text.indexOf('}')];
        index++;
      }
    }
    return lines;
  }
  function showInertSemicolons(rows, originalLines, convertedLines) {
    for (const [side, lines] of [['original', originalLines], ['converted', convertedLines]]) {
      for (const line of lines) {
        if (!line.inertSemicolon && !line.inertElse) continue;
        const row = { originalLine: null, originalText: '', convertedLine: null, convertedText: '',
          originalChange: 'same', convertedChange: 'same', originalParenHighlights: [], convertedParenHighlights: [] };
        row[`${side}Line`] = line.line;
        row[`${side}Text`] = line.text;
        row[`${side}ParenHighlights`] = line.inertElse ? line.neutralExtra : [line.text.indexOf(';')];
        const at = rows.findIndex(item => item[`${side}Line`] !== null && item[`${side}Line`] > line.line);
        rows.splice(at < 0 ? rows.length : at, 0, row);
      }
    }
    return rows;
  }
  function parenthesisHighlights(old, next) {
    const grouped = items => {
      const groups = new Map();
      for (const item of items) {
        const key = `${item.char}:${item.anchor}`;
        const group = groups.get(key) ?? [];
        group.push(item.textIndex);
        groups.set(key, group);
      }
      return groups;
    };
    const before = grouped(old.redundantParens), after = grouped(next.redundantParens);
    const original = [], converted = [];
    for (const key of new Set([...before.keys(), ...after.keys()])) {
      const left = before.get(key) ?? [], right = after.get(key) ?? [];
      const excess = Math.abs(left.length - right.length);
      if (!excess) continue;
      const entries = left.length > right.length ? left : right;
      const chosen = key.startsWith('(:') ? entries.slice(0, excess) : entries.slice(-excess);
      (left.length > right.length ? original : converted).push(...chosen);
    }
    return { original, converted };
  }
  function combinedLines(lines) {
    let key = '', textLength = 0;
    const redundantParens = [], renamed = [], neutralExtra = [];
    for (const line of lines) {
      redundantParens.push(...line.redundantParens.map(item => ({
        ...item, anchor: item.anchor + key.length, textIndex: item.textIndex + textLength,
      })));
      renamed.push(...line.renamed.map(item => ({ ...item, start: item.start + key.length, end: item.end + key.length,
        textIndices: item.textIndices.map(index => index + textLength) })));
      neutralExtra.push(...(line.neutralExtra ?? []).map(index => index + textLength));
      key += line.key;
      textLength += line.text.length + 1;
    }
    return { key, text: lines.map(line => line.text).join('\n'), redundantParens, renamed, neutralExtra };
  }
  function neutralHighlights(old, next) {
    const marks = parenthesisHighlights(old, next);
    marks.original.push(...(old.neutralExtra ?? []));
    marks.converted.push(...(next.neutralExtra ?? []));
    const originalCalls = colorCalls(old.text), convertedCalls = colorCalls(next.text);
    for (let index = 0; index < Math.min(originalCalls.length, convertedCalls.length); index++) {
      const left = originalCalls[index], right = convertedCalls[index];
      if (left.name !== right.name) continue;
      for (let argument = 0; argument < left.tokens.length; argument++) {
        const before = left.tokens[argument], after = right.tokens[argument];
        if (Number(before.text) !== Number(after.text) || before.text === after.text) continue;
        for (let at = before.start; at < before.end; at++) marks.original.push(at);
        for (let at = after.start; at < after.end; at++) marks.converted.push(at);
      }
    }
    const after = new Map(next.renamed.map(item => [`${item.start}:${item.end}`, item]));
    const originalAliases = [], convertedAliases = [];
    for (const item of old.renamed) {
      const counterpart = after.get(`${item.start}:${item.end}`);
      if (!counterpart || item.word === counterpart.word) continue;
      originalAliases.push(...item.textIndices);
      convertedAliases.push(...counterpart.textIndices);
    }
    return { ...marks, originalAliases, convertedAliases };
  }
  function marksByLine(lines, marks) {
    let offset = 0;
    return lines.map(line => {
      const selected = marks.filter(index => index >= offset && index < offset + line.text.length)
        .map(index => index - offset);
      offset += line.text.length + 1;
      return selected;
    });
  }
  const originalLines = comparableLines(original, aliases.original), convertedLines = comparableLines(converted, aliases.converted);
  const before = originalLines.filter(line => !line.inertSemicolon && !line.inertElse),
    after = convertedLines.filter(line => !line.inertSemicolon && !line.inertElse);
  if (combinedLines(before).key === combinedLines(after).key) {
    const highlights = neutralHighlights(combinedLines(before), combinedLines(after));
    const oldMarks = marksByLine(before, highlights.original), newMarks = marksByLine(after, highlights.converted);
    const oldAliases = marksByLine(before, highlights.originalAliases), newAliases = marksByLine(after, highlights.convertedAliases);
    return showInertSemicolons(Array.from({ length: Math.max(before.length, after.length) }, (_, index) => ({
      originalLine: before[index]?.line ?? null, originalText: before[index]?.text ?? '',
      convertedLine: after[index]?.line ?? null, convertedText: after[index]?.text ?? '',
      originalChange: 'same', convertedChange: 'same',
      originalParenHighlights: oldMarks[index] ?? [], convertedParenHighlights: newMarks[index] ?? [],
      originalAliasHighlights: oldAliases[index] ?? [], convertedAliasHighlights: newAliases[index] ?? [],
    })), originalLines, convertedLines);
  }
  let prefix = 0;
  while (prefix < before.length && prefix < after.length && before[prefix].key === after[prefix].key) prefix++;
  let suffix = 0;
  while (suffix < before.length - prefix && suffix < after.length - prefix
      && before[before.length - suffix - 1].key === after[after.length - suffix - 1].key) suffix++;
  const oldLines = before.slice(prefix, before.length - suffix), newLines = after.slice(prefix, after.length - suffix);
  const n = oldLines.length, m = newLines.length, ops = [];
  for (let i = 0; i < prefix; i++) ops.push({ kind: 'same', old: i, next: i });
  // ponytail: cap the LCS matrix; giant rewrites become one highlighted block instead of exhausting memory.
  if (n * m <= 1_000_000) {
    const width = m + 1, matrix = new Uint32Array((n + 1) * width);
    for (let i = n - 1; i >= 0; i--) for (let j = m - 1; j >= 0; j--) {
      const at = i * width + j;
      matrix[at] = oldLines[i].key === newLines[j].key && oldLines[i].key !== '}'
        ? matrix[(i + 1) * width + j + 1] + 1
        : Math.max(matrix[(i + 1) * width + j], matrix[i * width + j + 1]);
    }
    let i = 0, j = 0;
    while (i < n || j < m) {
      if (i < n && j < m && oldLines[i].key === newLines[j].key && oldLines[i].key !== '}') {
        ops.push({ kind: 'same', old: prefix + i, next: prefix + j }); i++; j++;
      } else if (i < n && (j === m || matrix[(i + 1) * width + j] >= matrix[i * width + j + 1])) {
        ops.push({ kind: 'remove', old: prefix + i++ });
      } else ops.push({ kind: 'add', next: prefix + j++ });
    }
  } else {
    for (let i = 0; i < n; i++) ops.push({ kind: 'remove', old: prefix + i });
    for (let j = 0; j < m; j++) ops.push({ kind: 'add', next: prefix + j });
  }
  for (let i = suffix; i > 0; i--) {
    const old = before.length - i, next = after.length - i;
    ops.push({ kind: 'same', old, next });
  }
  const rows = [];
  for (let i = 0; i < ops.length;) {
    if (ops[i].kind === 'same') {
      const old = before[ops[i].old], next = after[ops[i].next];
      const highlights = neutralHighlights(old, next);
      rows.push({ originalLine: old.line, originalText: old.text, convertedLine: next.line, convertedText: next.text, originalChange: 'same', convertedChange: 'same', originalParenHighlights: highlights.original, convertedParenHighlights: highlights.converted, originalAliasHighlights: highlights.originalAliases, convertedAliasHighlights: highlights.convertedAliases });
      i++; continue;
    }
    const removed = [], added = [];
    while (i < ops.length && ops[i].kind !== 'same') (ops[i].kind === 'remove' ? removed : added).push(ops[i++]);
    const oldBlock = removed.map(op => before[op.old]), newBlock = added.map(op => after[op.next]);
    function appendLines(oldLines, newLines, same) {
      const highlights = same ? neutralHighlights(combinedLines(oldLines), combinedLines(newLines)) : null;
      const oldMarks = same ? marksByLine(oldLines, highlights.original) : [];
      const newMarks = same ? marksByLine(newLines, highlights.converted) : [];
      const oldAliases = same ? marksByLine(oldLines, highlights.originalAliases) : [];
      const newAliases = same ? marksByLine(newLines, highlights.convertedAliases) : [];
      for (let j = 0; j < Math.max(oldLines.length, newLines.length); j++) {
        const old = oldLines[j], next = newLines[j];
        rows.push({ originalLine: old?.line ?? null, originalText: old?.text ?? '', convertedLine: next?.line ?? null, convertedText: next?.text ?? '',
          originalChange: same ? 'same' : old ? 'remove' : 'empty', convertedChange: same ? 'same' : next ? 'add' : 'empty',
          originalParenHighlights: oldMarks[j] ?? [], convertedParenHighlights: newMarks[j] ?? [],
          originalAliasHighlights: oldAliases[j] ?? [], convertedAliasHighlights: newAliases[j] ?? [] });
      }
    }
    let oldAt = 0, newAt = 0;
    while (oldAt < oldBlock.length || newAt < newBlock.length) {
      let match = null;
      // A short local lookahead recovers formatting-only wraps amid unrelated changed lines.
      for (let gap = 0; gap <= 3 && !match; gap++) for (let oldSkip = 0; oldSkip <= gap && !match; oldSkip++) {
        const newSkip = gap - oldSkip;
        for (let span = 2; span <= 8 && !match; span++) for (let oldSize = 1; oldSize < span; oldSize++) {
          const newSize = span - oldSize;
          if (oldSize > 4 || newSize > 4 || oldAt + oldSkip + oldSize > oldBlock.length || newAt + newSkip + newSize > newBlock.length) continue;
          const oldSlice = oldBlock.slice(oldAt + oldSkip, oldAt + oldSkip + oldSize);
          const newSlice = newBlock.slice(newAt + newSkip, newAt + newSkip + newSize);
          if (oldSlice.map(line => line.key).join('') === newSlice.map(line => line.key).join('')) {
            match = { oldSkip, newSkip, oldSize, newSize };
            break;
          }
        }
      }
      if (match) {
        appendLines(oldBlock.slice(oldAt, oldAt + match.oldSkip), newBlock.slice(newAt, newAt + match.newSkip), false);
        oldAt += match.oldSkip; newAt += match.newSkip;
        appendLines(oldBlock.slice(oldAt, oldAt + match.oldSize), newBlock.slice(newAt, newAt + match.newSize), true);
        oldAt += match.oldSize; newAt += match.newSize;
      } else {
        appendLines(oldBlock.slice(oldAt, oldAt + 1), newBlock.slice(newAt, newAt + 1),
          oldBlock[oldAt]?.key === newBlock[newAt]?.key);
        oldAt++; newAt++;
      }
    }
  }
  return showInertSemicolons(rows, originalLines, convertedLines);
}

function galaxyFunctionSources(tree, source) {
  const functions = new Map();
  for (const node of tree.statements ?? []) {
    if (!node.parameters || !node.body || typeof node.pos !== 'number' || typeof node.end !== 'number') continue;
    const name = node.name?.name ?? node.name?.text ?? node.name?.escapedText;
    if (typeof name === 'string') functions.set(name, { source: source.slice(node.pos, node.end).trim(), node });
  }
  return functions;
}

export function topLevelComparisonItems(parsed, expectedTree, actualTree, expectedSource, actualSource) {
  const items = [];
  const snippets = (tree, source, predicate, signature = false) => (tree.statements ?? [])
    .filter(predicate)
    .map(node => source.slice(node.pos, signature && node.body ? node.body.pos : node.end).trim())
    .filter(Boolean).join('\n');
  const add = (name, left, right) => items.push({ name, status: 'modified',
    expectedSource: clipSource(left), actualSource: clipSource(right) });
  const changedNames = comparison => new Set([
    ...(comparison?.missing ?? []), ...(comparison?.added ?? []), ...(comparison?.differing ?? []),
  ]);
  if (parsed.includes && !parsed.includes.exact) {
    const includes = source => [...source.matchAll(/^\s*include\b[^\r\n]*/gmu)].map(match => match[0].trim()).join('\n');
    add('Includes', includes(expectedSource), includes(actualSource));
  }
  const signatures = changedNames(parsed.signatures);
  if (signatures.size) {
    const select = node => node.parameters && signatures.has(node.name?.name ?? node.name?.text);
    add('Function signatures', snippets(expectedTree, expectedSource, select, true),
      snippets(actualTree, actualSource, select, true));
  }
  const declarations = changedNames(parsed.declarations);
  if (declarations.size) {
    const select = node => !node.parameters && [...declarations].some(key => key.endsWith(`:${node.name?.name ?? node.name?.text}`));
    add('Global declarations', snippets(expectedTree, expectedSource, select),
      snippets(actualTree, actualSource, select));
  } else if (parsed.globalInitializers && !parsed.globalInitializers.exact) {
    const select = node => !node.parameters && node.initializer !== undefined;
    add('Global initializer order', snippets(expectedTree, expectedSource, select),
      snippets(actualTree, actualSource, select));
  }
  return items;
}

function clipSource(text) {
  if (text.length <= MAX_FUNCTION_SOURCE_CHARS) return text;
  return `${text.slice(0, MAX_FUNCTION_SOURCE_CHARS)}\n… (${text.length - MAX_FUNCTION_SOURCE_CHARS} more characters clipped)`;
}

async function enrichAstMetrics(summary) {
  const functionDiffs = new Map();
  if (!summary.manifestPath) return functionDiffs;
  const manifestPath = path.resolve(summary.manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest.astOracleModule) return functionDiffs;
  const oracle = await loadConversionOracle(manifest.astOracleModule, path.dirname(manifestPath));
  if (!oracle.compareGalaxyAst || !oracle.parseGalaxySource) return functionDiffs;
  const cases = new Map(manifest.cases.map(item => [item.id, item]));
  const sourceCache = new Map(), comparisonCache = new Map();
  const sourceInfo = (text, fileName) => {
    const key = createHash('sha256').update(text).digest('hex');
    if (!sourceCache.has(key)) {
      const tree = oracle.parseGalaxySource(text, fileName);
      sourceCache.set(key, { tree, functions: galaxyFunctionSources(tree, text) });
    }
    return { key, ...sourceCache.get(key) };
  };
  for (const attempt of summary.results) {
    if (attempt.status !== 'completed') continue;
    const benchmarkCase = cases.get(attempt.caseId);
    if (!benchmarkCase) continue;
    const inputs = new Map(attempt.inputArtifacts.map(item => [item.role, item.path]));
    const outputs = new Map(attempt.outputArtifacts.map(item => [item.role, item.path]));
    const isRoundtrip = attempt.operation === 'galaxy-triggers-roundtrip';
    const files = isRoundtrip
      ? [['script', 'roundtrip-script'], ['header', 'roundtrip-header'],
          ['script', 'original-script'], ['header', 'original-header']]
      : attempt.operation === 'triggers-to-galaxy'
        ? [['expected-script', 'script'], ['expected-header', 'header']]
        : [];
    for (const [inputRole, outputRole] of files) {
      const key = outputRole.startsWith('original-')
        ? (inputRole === 'header' ? 'originalHeader' : 'originalScript')
        : inputRole.endsWith('header') ? 'header' : 'script';
      const comparison = attempt.structuralComparison?.[key];
      if (!comparison) continue;
      const inputPath = inputs.get(inputRole);
      const outputPath = outputs.get(outputRole);
      if (!inputPath || !outputPath) continue;
      try {
        const { expected, actual } = await readGalaxyComparisonPair(
          inputs, outputs, inputRole, outputRole, benchmarkCase.options?.libraryId,
        );
        const expectedInfo = sourceInfo(expected, `${key}-expected.galaxy`);
        const actualInfo = sourceInfo(actual, `${key}-converted.galaxy`);
        const pairKey = `${expectedInfo.key}:${actualInfo.key}`;
        let parsed = comparisonCache.get(pairKey);
        if (!parsed) {
          parsed = oracle.compareGalaxyAst(expectedInfo.tree, actualInfo.tree, benchmarkCase.options ?? {});
          comparisonCache.set(pairKey, parsed);
        }
        const metrics = summarizeAstComparison(parsed);
        if (!(comparison.astMetrics?.status === 'available' && Number.isFinite(comparison.astMetrics.astDifferences))
            && metrics.status === 'available') comparison.astMetrics = metrics;
        const changes = parsed.functions ?? {};
        const namedChanges = [
          ...(changes.differing ?? []).map(name => [name, 'modified']),
          // Equal up to the forms the GUI writes for hand-written code: shown, in yellow, but not an error.
          ...(changes.equivalent ?? []).map(name => [name, 'equivalent']),
          ...(changes.missing ?? []).map(name => [name, 'removed']),
          ...(changes.added ?? []).map(name => [name, 'added']),
        ];
        const topLevel = topLevelComparisonItems(parsed, expectedInfo.tree, actualInfo.tree, expected, actual);
        if (namedChanges.length || topLevel.length) {
          const filesForAttempt = functionDiffs.get(attempt) ?? {};
          filesForAttempt[key] = {
            truncated: Math.max(0, namedChanges.length + topLevel.length - MAX_CHANGED_FUNCTIONS),
            functions: [...topLevel, ...namedChanges.slice(0, Math.max(0, MAX_CHANGED_FUNCTIONS - topLevel.length)).map(([name, status]) => {
              const left = expectedInfo.functions.get(name), right = actualInfo.functions.get(name);
              const paired = left && right && typeof oracle.pairedFunctionLocalNames === 'function'
                ? oracle.pairedFunctionLocalNames(left.node, right.node) : undefined;
              return {
                name, status,
                expectedSource: clipSource(left?.source ?? ''), actualSource: clipSource(right?.source ?? ''),
                ...(paired ? { aliases: { original: [...paired[0]], converted: [...paired[1]] } } : {}),
              };
            })],
          };
          functionDiffs.set(attempt, filesForAttempt);
        }
      } catch (error) {
        if (!comparison.astMetrics) comparison.astMetrics = { status: 'unavailable', error: String(error) };
      }
    }
  }
  return functionDiffs;
}

function summarizeDiagnostics(diagnostics = []) {
  const byCode = new Map();
  for (const item of diagnostics) {
    const code = item.code ?? 'unknown';
    const severity = String(item.severity ?? 'unknown').toLowerCase();
    const key = `${code}\0${severity}`;
    const entry = byCode.get(key) ?? { code, severity, count: 0, example: item.message };
    entry.count += 1;
    byCode.set(key, entry);
  }
  const items = [...byCode.values()].sort((a, b) => b.count - a.count);
  return { total: diagnostics.length, byCode: items.slice(0, MAX_DIAGNOSTIC_CODES), truncatedCodes: Math.max(0, items.length - MAX_DIAGNOSTIC_CODES) };
}

function capSamples(samples = []) {
  return { samples: samples.slice(0, MAX_DIFFERENCE_SAMPLES).map(String), total: samples.length };
}

function compactStructuralComparison(structuralComparison = {}) {
  const result = {};
  for (const [key, comparison] of Object.entries(structuralComparison)) {
    result[key] = {
      status: comparison.status,
      syntaxValid: comparison.syntaxValid,
      exact: comparison.exact,
      astMetrics: comparison.astMetrics,
      differenceSamples: capSamples(comparison.differenceSamples),
    };
  }
  return result;
}

function compactArtifacts(artifacts = []) {
  return artifacts.map(item => ({ role: item.role, path: item.path, bytes: item.bytes }));
}

function compactAttempt(attempt, functionDiffs) {
  return {
    attempt: attempt.attempt,
    status: attempt.status,
    correctness: attempt.correctness,
    timedOut: attempt.timedOut,
    code: attempt.code,
    signal: attempt.signal,
    error: attempt.error,
    wallTimeMs: attempt.wallTimeMs,
    peakWorkingSetBytes: attempt.peakWorkingSetBytes,
    peakPagedMemorySizeBytes: attempt.peakPagedMemorySizeBytes,
    conversionQuality: attempt.conversionQuality,
    originalConversion: attempt.originalConversion,
    roundtripConversion: attempt.roundtripConversion,
    converterMetrics: attempt.converterMetrics,
    diagnosticsSummary: summarizeDiagnostics(attempt.diagnostics),
    structuralComparison: compactStructuralComparison(attempt.structuralComparison),
    guiComparison: attempt.guiComparison,
    inputArtifacts: compactArtifacts(attempt.inputArtifacts),
    outputArtifacts: compactArtifacts(attempt.outputArtifacts),
    logFiles: attempt.logFiles,
    functionDiffs: functionDiffs.get(attempt) ?? {},
  };
}

export function buildReport(summary, functionDiffs = new Map()) {
  const groups = new Map();
  for (const attempt of summary.results) {
    const key = `${attempt.caseId}\0${attempt.converterId}`;
    const packageArtifact = attempt.inputArtifacts?.find(item => item.role === 'package');
    const group = groups.get(key) ?? {
      caseId: attempt.caseId,
      displayName: packageArtifact ? path.basename(packageArtifact.path) : attempt.caseId,
      packagePath: packageArtifact?.path,
      packageBytes: packageArtifact?.bytes ?? null,
      converterId: attempt.converterId,
      documentKind: attempt.documentKind ?? 'unspecified',
      operation: attempt.operation,
      tags: attempt.tags ?? [],
      rawAttempts: [],
    };
    group.rawAttempts.push(attempt);
    groups.set(key, group);
  }
  const processErrors = new Map();
  for (const attempt of summary.results.filter(item => item.status !== 'completed')) {
    const key = processFailureReason(attempt);
    const entry = processErrors.get(key) ?? { attempts: 0, exampleCaseId: attempt.caseId };
    entry.attempts += 1;
    processErrors.set(key, entry);
  }
  return {
    reportSchemaVersion: 2,
    name: summary.name,
    runDirectory: summary.runDirectory,
    startedAt: summary.startedAt,
    finishedAt: summary.finishedAt,
    manifestPath: summary.manifestPath,
    manifestSha256: summary.manifestSha256,
    platform: summary.platform,
    caseCoverage: summary.caseCoverage,
    performanceStats: summary.performanceStats,
    ranking: summary.ranking,
    qualityChecks: {
      completedOutputs: summary.results.filter(item => item.status === 'completed').length,
      processErrors: summary.results.filter(item => item.status !== 'completed').length,
      partialFidelity: summary.results.filter(item => item.conversionQuality?.completeness === 'partial').length,
      astMismatchAttempts: summary.results.filter(item => Object.values(item.structuralComparison ?? {})
        .some(comparison => ['different', 'invalid-syntax'].includes(comparison.status))).length,
      guiMismatches: summary.results.filter(item => item.guiComparison?.status === 'different').length,
      guiInconclusive: summary.results.filter(item => item.guiComparison?.status === 'inconclusive').length,
    },
    processErrorSummary: [...processErrors].map(([reason, entry]) => ({ reason, ...entry }))
      .sort((a, b) => b.attempts - a.attempts),
    caseResults: [...groups.values()].map(group => {
      const performance = summary.performanceStats[group.converterId]?.cases[group.caseId] ?? {};
      const attempts = group.rawAttempts.map(attempt => compactAttempt(attempt, functionDiffs));
      const astMetrics = attempts.flatMap(attempt => [attempt.structuralComparison?.script, attempt.structuralComparison?.header]
        .map(comparison => comparison?.astMetrics).filter(metric => metric?.status === 'available'));
      const originalAstMetrics = attempts.flatMap(attempt => [attempt.structuralComparison?.originalScript, attempt.structuralComparison?.originalHeader]
        .map(comparison => comparison?.astMetrics).filter(metric => metric?.status === 'available'));
      const guiMetrics = group.rawAttempts.map(attempt => attempt.converterMetrics?.guiFidelity ?? {});
      const baselineTriggerCounts = group.rawAttempts.map(attempt => attempt.guiComparison?.expected?.typeCounts?.Trigger);
      return {
        caseId: group.caseId,
        displayName: group.displayName,
        packagePath: group.packagePath,
        packageBytes: group.packageBytes,
        converterId: group.converterId,
        documentKind: group.documentKind,
        operation: group.operation,
        tags: group.tags,
        attempts,
        shortStatus: shortStatus({ attempts: group.rawAttempts }),
        failureReasons: [...attempts.flatMap(attemptReasons).reduce((result, reason) => result.set(reason, (result.get(reason) ?? 0) + 1), new Map())]
          .map(([reason, count]) => ({ reason, attempts: count })),
        statusCounts: counts(attempts, attempt => attempt.status),
        correctnessCounts: counts(attempts, attempt => attempt.correctness),
        guiComparisonCounts: counts(attempts, attempt => attempt.guiComparison?.status),
        astComparisonCounts: counts(attempts.flatMap(attempt => Object.values(attempt.structuralComparison ?? {})), comparison => comparison.status),
        diagnostics: attempts.reduce((total, attempt) => total + (attempt.diagnosticsSummary?.total ?? 0), 0),
        outputMetrics: {
          guiTriggers: median(guiMetrics.map(metric => metric.guiTriggerCount)),
          customScriptTags: median(guiMetrics.map(metric => metric.customScriptTagCount)),
          triggerLocalVariables: median(guiMetrics.map(metric => metric.triggerLocalVariableCount)),
          baselineGuiTriggers: median(baselineTriggerCounts),
          astSimilarityPercent: median(astMetrics.map(metric => metric.similarityPercent)),
          astDifferences: median(astMetrics.map(metric => metric.astDifferences)),
          callDifferences: median(astMetrics.map(metric => metric.callDifferences)),
          originalAstSimilarityPercent: median(originalAstMetrics.map(metric => metric.similarityPercent)),
          originalAstDifferences: median(originalAstMetrics.map(metric => metric.astDifferences)),
          originalCallDifferences: median(originalAstMetrics.map(metric => metric.callDifferences)),
        },
        performance,
      };
    }),
  };
}

export async function enrichGalaxySyntax(report) {
  if (!report.manifestPath) return report;
  const manifestPath = path.resolve(report.manifestPath);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (!manifest.astOracleModule) return report;
  const oracle = await loadConversionOracle(manifest.astOracleModule, path.dirname(manifestPath));
  if (!oracle.tokenizeGalaxyLines) return report;
  for (const benchmarkCase of report.caseResults ?? []) {
    for (const attempt of benchmarkCase.attempts ?? []) {
      for (const group of Object.values(attempt.functionDiffs ?? {})) {
        for (const fn of group.functions ?? []) {
          fn.originalSyntax = oracle.tokenizeGalaxyLines(fn.expectedSource ?? '');
          fn.convertedSyntax = oracle.tokenizeGalaxyLines(fn.actualSource ?? '');
        }
      }
    }
  }
  return report;
}

async function enrichLineCounts(report) {
  const cached = new Map();
  async function count(file) {
    if (!file) return null;
    if (!cached.has(file)) cached.set(file, readFile(file, 'utf8').then(source => {
      if (!source.length) return 0;
      let lines = 1;
      for (let i = 0; i < source.length; i++) {
        if (source[i] === '\n' || (source[i] === '\r' && source[i + 1] !== '\n')) lines++;
      }
      return lines - Number(source.endsWith('\n') || source.endsWith('\r'));
    }).catch(() => null));
    return cached.get(file);
  }
  for (const item of report.caseResults) {
    const source = item.attempts[0]?.inputArtifacts.filter(artifact => ['script', 'header'].includes(artifact.role)) ?? [];
    const galaxyLines = await Promise.all(source.map(artifact => count(artifact.path)));
    item.outputMetrics.galaxyInputLines = galaxyLines.length && galaxyLines.every(Number.isFinite)
      ? galaxyLines.reduce((total, value) => total + value, 0) : null;
    const triggerLines = [];
    for (const attempt of item.attempts) {
      const trigger = attempt.outputArtifacts.find(artifact => artifact.role === 'trigger-data');
      triggerLines.push(await count(trigger?.path));
    }
    item.outputMetrics.triggerDataLines = median(triggerLines);
  }
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1_048_576) return `${(bytes / 1024).toFixed(1)} KiB`;
  return `${(bytes / 1_048_576).toFixed(1)} MiB`;
}

export function renderReportHtml(report) {
  const data = JSON.stringify(report).replaceAll('<', '\\u003c').replaceAll('>', '\\u003e').replaceAll('&', '\\u0026');
  const diffFunctionLinesSource = diffFunctionLines.toString();
  return `<!doctype html>
<html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Galaxy ↔ Triggers benchmark report</title>
<style>
:root{color-scheme:dark;--bg:#0b111a;--panel:#121d2a;--panel2:#182637;--line:#304153;--text:#edf4fa;--muted:#a2b4c6;--green:#64d9a8;--red:#ff8890;--yellow:#f4cf80;--blue:#9bcaff}
*{box-sizing:border-box}body{margin:0;background:radial-gradient(circle at 20% -15%,#20364b 0,transparent 34rem),var(--bg);color:var(--text);font:14px/1.5 system-ui,Segoe UI,sans-serif}main{max-width:1680px;margin:auto;padding:32px clamp(16px,3vw,48px) 60px}h1,h2,h3,p{margin-top:0}h1{font-size:clamp(27px,3vw,40px);line-height:1.15;letter-spacing:-.035em;margin:8px 0 10px}h2{font-size:19px;letter-spacing:-.01em;margin:0}a{color:var(--blue)}button,select,input{font:inherit}button{cursor:pointer}.muted,small{color:var(--muted)}.eyebrow{color:var(--blue);font-size:12px;font-weight:750;text-transform:uppercase;letter-spacing:.13em}.hero{display:flex;justify-content:space-between;align-items:end;gap:24px;margin-bottom:25px}.hero p{color:var(--muted);margin:0}.hero-actions{display:flex;gap:8px;flex:none}.link-button,.diff-button,.diff-close{display:inline-flex;align-items:center;justify-content:center;min-height:36px;padding:7px 12px;background:var(--panel2);color:var(--text);border:1px solid var(--line);border-radius:7px;text-decoration:none}.link-button:hover,.diff-button:hover,.diff-close:hover{border-color:var(--blue)}.cards{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:12px;margin:18px 0 12px}.card,.surface{background:var(--panel);border:1px solid var(--line);border-radius:12px}.card{padding:17px 19px;min-height:105px}.card strong{display:block;font-size:clamp(24px,2.4vw,33px);letter-spacing:-.04em;line-height:1.2}.card span{display:block;color:var(--muted);margin-top:5px}.card small{display:block;margin-top:4px;font-size:11px}.card-danger strong{color:var(--red)}.card-good strong{color:var(--green)}.overview{padding:18px 20px;margin-bottom:24px}.overview-head,.section-head{display:flex;justify-content:space-between;align-items:baseline;gap:16px}.overview-head strong{font-size:15px}.stack{display:flex;overflow:hidden;height:12px;border-radius:20px;background:#304153;margin:14px 0 10px}.stack span{min-width:2px}.stack .seg-pass{background:var(--green)}.stack .seg-warning{background:var(--yellow)}.stack .seg-failed{background:#ef896f}.stack .seg-error{background:#c54f68}.stack .seg-other{background:#68839d}.legend{display:flex;gap:18px;flex-wrap:wrap;color:var(--muted);font-size:12px}.legend b{color:var(--text);font-weight:650}.dot{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:6px}.dot-error{background:#c54f68}.dot-failed{background:#ef896f}.dot-pass{background:var(--green)}.dot-warning{background:var(--yellow)}.dot-other{background:#68839d}.section-block{margin-top:24px}.section-head{margin-bottom:12px}.section-head p{margin:0;color:var(--muted);font-size:12px}.scroll{overflow:auto;border:1px solid var(--line);border-radius:10px;background:var(--panel)}table{border-collapse:collapse;width:100%;font-variant-numeric:tabular-nums}th,td{text-align:left;border-bottom:1px solid var(--line);padding:11px 12px;vertical-align:top}th{position:sticky;top:0;z-index:1;background:#1b2b3a;color:var(--muted);font-size:11px;font-weight:750;letter-spacing:.04em;text-transform:uppercase;white-space:nowrap}tbody tr:last-child td{border-bottom:0}tbody tr:hover{background:#1a2a3a}.cases-table{min-width:1200px}.cases-table td{max-width:290px}.cases-table td:first-child{min-width:230px}.case-name{font-weight:650;overflow-wrap:anywhere}.case-sub{font-size:11px;color:var(--muted);margin-top:2px}.status{display:inline-block;border-radius:20px;padding:3px 9px;font-size:12px;font-weight:700;background:#354252}.status-pass{color:var(--green);background:#173a32}.status-failed,.status-error,.status-mixed{color:#ffb1b8;background:#442630}.status-warning,.status-inconclusive{color:var(--yellow);background:#453b2a}.reason-cell{min-width:190px;color:#e8c4c5}.reason-cell div+div{margin-top:3px}.metric-main{font-weight:680}.metric-sub{font-size:11px;color:var(--muted)}.metric-empty{color:#8295a7}.number{text-align:right;white-space:nowrap}.number-header{text-align:right}.filters{display:flex;gap:9px;flex-wrap:wrap;margin:0 0 11px;align-items:center}.filters input,.filters select,.diff-select{background:#172535;color:var(--text);border:1px solid var(--line);padding:8px 10px;border-radius:7px}.filters input:focus,.filters select:focus,.diff-select:focus{outline:2px solid var(--blue);outline-offset:1px}.filters #search{min-width:260px;flex:1}.filters label{font-size:12px;white-space:nowrap}.filters label input{vertical-align:middle}.case-count{margin:0 0 10px;color:var(--muted);font-size:12px}.help{margin:14px 0 0;color:var(--muted);font-size:12px}.help strong{color:var(--text)}.secondary{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:26px}.secondary .surface{padding:16px 18px}.secondary h2{font-size:16px;margin-bottom:10px}.secondary table td,.secondary table th{padding:7px 5px}.secondary th{position:static;background:none}.secondary .scroll{border:0}.explain{padding-left:18px;margin:0;color:var(--muted)}.explain li{margin:5px 0}.explain strong{color:var(--text)}details{max-width:540px}details summary{cursor:pointer;color:var(--blue);white-space:nowrap}details section{margin:10px 0;padding:12px;background:#142130;border:1px solid var(--line);border-radius:8px;min-width:310px}details section strong{display:block;margin-bottom:7px}details p{margin:8px 0}pre{white-space:pre-wrap;overflow-wrap:anywhere;color:var(--muted);max-width:100%;margin:6px 0}.err-pre{background:#24171c;border:1px solid #703b45;border-radius:6px;padding:8px;color:#ffc7ce;max-height:180px;overflow:auto}.diag-list{display:flex;flex-direction:column;gap:2px;font-size:12px}.artifact-links{display:flex;gap:9px;flex-wrap:wrap;margin-top:10px;font-size:12px}dialog{width:96vw;height:92vh;max-width:none;max-height:none;margin:auto;padding:0;border:1px solid var(--line);border-radius:12px;background:var(--bg);color:var(--text)}dialog::backdrop{background:#05080de0}.diff-head{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:13px 20px;background:var(--panel);border-bottom:1px solid var(--line)}.diff-head h2{margin:0;font-size:17px}.diff-content{height:calc(92vh - 64px);overflow:auto;padding:16px}.diff-item{margin:0 0 16px;padding:14px;border:1px solid var(--line);border-radius:8px;background:var(--panel)}.diff-item pre{margin:6px 0 0;padding:10px;background:#10151d;border-radius:6px}@media(max-width:1050px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.secondary{grid-template-columns:1fr}}@media(max-width:700px){main{padding:18px 12px 44px}.hero{align-items:start;flex-direction:column}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.card{min-height:95px;padding:13px}.overview{padding:14px}.filters #search{min-width:100%}}
.cases-table{min-width:0;table-layout:fixed}.cases-table th,.cases-table td{padding:8px 6px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;vertical-align:middle}.cases-table td:first-child{min-width:0}.cases-table th:nth-child(1){width:15%}.cases-table th:nth-child(2){width:7%}.cases-table th:nth-child(3){width:15%}.cases-table th:nth-child(4){width:5%}.cases-table th:nth-child(5){width:6%}.cases-table th:nth-child(6){width:9%}.cases-table th:nth-child(7){width:10%}.cases-table th:nth-child(8){width:9%}.cases-table th:nth-child(9){width:9%}.cases-table th:nth-child(10){width:9%}.cases-table th:nth-child(11){width:6%}.cases-table .reason-cell{min-width:0}.cases-table .case-name{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.cases-table .metric-sub{display:none}.cases-table .link-button{min-height:28px;padding:3px 7px;font-size:11px}.cases-table td.number{text-align:right}.cases-table td:last-child{text-align:right}
#details-dialog{width:min(860px,calc(100vw - 28px));height:min(86vh,900px);overflow:hidden}.details-content{height:calc(100% - 62px);overflow:auto;padding:18px}.details-content section{margin:0 0 14px;padding:16px;border:1px solid var(--line);border-radius:9px;background:var(--panel)}.details-content section>strong{display:block;margin-bottom:10px}.details-content details{max-width:none}.details-content .artifact-links{margin-top:12px}
@media(max-width:900px){.cases-table th,.cases-table td{padding:7px 4px;font-size:11px}.cases-table .link-button{padding:2px 4px}.cases-table th{letter-spacing:0}}
@media(max-width:600px){.overview-head{align-items:start;flex-direction:column;gap:2px}.cards{grid-template-columns:repeat(2,minmax(0,1fr))}.details-content{padding:12px}#details-dialog{width:calc(100vw - 16px);height:calc(100vh - 20px)}.diff-head{padding:10px 12px}.diff-content{padding:10px}.cases-table{min-width:620px}}
.cards{grid-template-columns:repeat(4,minmax(0,1fr))}.process-details{max-width:none;margin-top:20px;padding:12px 16px;border:1px solid var(--line);border-radius:9px;background:var(--panel)}.process-details summary{font-weight:650}.process-details .secondary{margin-top:14px}.process-details .surface{background:var(--bg)}@media(max-width:800px){.cards{grid-template-columns:repeat(2,minmax(0,1fr))}}
</style><main><header class="hero"><div><div class="eyebrow">Conversion quality report</div><h1>Galaxy ↔ Triggers benchmark</h1><p id="meta"></p></div><div class="hero-actions"><a class="link-button" href="../history.html">Compare runs</a><a id="report-json-link" class="link-button" href="report.json">Download JSON</a></div></header>
<div id="totals" class="cards"></div>
<section class="section-block"><div class="section-head"><div><h2>Results by map / mod</h2><p>One conversion per case. Select a map for diagnostics and Galaxy code differences.</p></div></div><div class="filters"><input id="search" type="search" aria-label="Search map or mod" placeholder="Search map or mod…"><select id="correctness" aria-label="Filter by status"><option value="">All statuses</option><option value="Pass">Pass</option><option value="Warning">Warning</option><option value="Failed">Failed</option><option value="Error">Error</option><option value="Mixed">Mixed</option><option value="Inconclusive">Inconclusive</option></select><select id="kind" aria-label="Filter by package type"><option value="">Maps and mods</option></select><label class="muted"><input id="failedOnly" type="checkbox"> Problems only</label></div><div id="case-count" class="case-count"></div><div class="scroll"><table class="cases-table"><thead><tr><th>Map / mod</th><th>Status</th><th>Why</th><th class="number-header" title="Editable GUI triggers in converted output">GUI</th><th class="number-header" title="ScriptCode tags in converted output">Script</th><th class="number-header" title="Editor Galaxy → our Triggers → Galaxy">Roundtrip AST</th><th class="number-header" title="Original Triggers → our Galaxy conversion">Triggers → Galaxy</th><th class="number-header" title="Galaxy generated from original Triggers, compared with editor Galaxy">Original AST</th><th class="number-header" title="Input Galaxy script and header lines / converted Triggers file lines">Lines G / T</th><th class="number-header" title="Elapsed time and peak process working set">Time / memory</th><th>Inspect</th></tr></thead><tbody id="cases"></tbody></table></div><p class="help">Roundtrip compares Galaxy regenerated from converted triggers; Original compares Galaxy generated directly from editor Triggers. Lines G / T = input Galaxy / generated Triggers. Yellow diff marks display-only equivalence; AST percentages still use ModKit's typed comparator.</p></section>
<details class="process-details"><summary>Process errors and converter comparison</summary><div class="secondary"><section class="surface"><h2>Most common process errors</h2><div class="scroll"><table><thead><tr><th>Reason</th><th class="number-header">Cases</th><th>Example map / mod</th></tr></thead><tbody id="error-summary"></tbody></table></div></section><section class="surface" id="comparison" hidden><h2>Converter comparison</h2><div class="scroll"><table><thead><tr><th>Converter</th><th>Pass</th><th>Warning</th><th>Fail</th><th>Inconclusive</th><th>Median time</th><th>Peak memory</th></tr></thead><tbody id="ranking"></tbody></table></div></section></div></details></main>
<dialog id="details-dialog" aria-labelledby="details-title"><div class="diff-head"><h2 id="details-title">Run details</h2><button id="close-details" class="diff-close" type="button">Close</button></div><div id="details-content" class="details-content"></div></dialog>
<dialog id="diff-dialog" aria-labelledby="diff-title"><div class="diff-head"><h2 id="diff-title">Galaxy differences</h2><button id="close-diff" class="diff-close" type="button">Close</button></div><div id="diff-content" class="diff-content"></div></dialog>
<script type="application/json" id="report-data">${data}</script><script>
${diffFunctionLinesSource}
const data=JSON.parse(document.getElementById('report-data').textContent),fmtMs=v=>Number.isFinite(v)?v.toFixed(1)+' ms':'—',fmtMem=v=>Number.isFinite(v)?(v/1048576).toFixed(1)+' MiB':'—',fmtBytes=v=>Number.isFinite(v)?(v<1024?v+' B':v<1048576?(v/1024).toFixed(1)+' KiB':(v/1048576).toFixed(1)+' MiB'):'—',fmtNum=v=>Number.isFinite(v)?String(v):'—',sum=o=>Object.values(o||{}).reduce((a,b)=>a+b,0),el=(tag,text,cls)=>{const n=document.createElement(tag);if(text!==undefined)n.textContent=text;if(cls)n.className=cls;return n};
function fileUrl(p){if(!p)return null;const norm=String(p).replaceAll('\\\\','/');const segments=norm.split('/').map((part,i)=>i===0&&/^[A-Za-z]:$/.test(part)?part:encodeURIComponent(part));return 'file:///'+segments.join('/').replace(/^\\/+/, '')}
const cases=data.caseResults||[],attemptCount=cases.reduce((n,c)=>n+(c.attempts?.length||0),0),uniqueCount=new Set(cases.map(c=>c.caseId)).size;
const runDate=new Date(data.startedAt),dateLabel=Number.isNaN(runDate.getTime())?'':runDate.toLocaleString(undefined,{dateStyle:'medium',timeStyle:'short'});
document.getElementById('meta').textContent=[data.name,dateLabel,uniqueCount+' maps / mods',attemptCount!==uniqueCount?attemptCount+' runs':null].filter(Boolean).join(' · ');
const outcomeCounts={Pass:0,Warning:0,Failed:0,Error:0,Mixed:0,Inconclusive:0};for(const c of cases)outcomeCounts[c.shortStatus]=(outcomeCounts[c.shortStatus]||0)+1;
const measured=cases.filter(c=>Number.isFinite(c.outputMetrics?.astSimilarityPercent)),astMedian=medianPercent(measured.map(c=>c.outputMetrics.astSimilarityPercent));
const totals=document.getElementById('totals');for(const [label,value,note,cls] of [
  ['Maps / mods',uniqueCount,'',''],
  ['Passed',outcomeCounts.Pass||0,'Fully passing cases','card-good'],
  ['Process errors',data.qualityChecks.processErrors,'No converted output','card-danger'],
  ['AST median',Number.isFinite(astMedian)?astMedian.toFixed(1)+'%':'—',measured.length+' of '+cases.length+' case results','']]){
  const card=el('div',undefined,'card '+cls);card.append(el('strong',String(value)),el('span',label),el('small',note));totals.append(card)}
const names=new Map(cases.map(c=>[c.caseId,c.displayName]));
const errorRows=document.getElementById('error-summary');for(const item of (data.processErrorSummary||[]).slice(0,8)){const row=el('tr');row.append(el('td',item.reason),el('td',String(item.attempts),'number'),el('td',names.get(item.exampleCaseId)||item.exampleCaseId||'—'));errorRows.append(row)}
if(!errorRows.childNodes.length){const row=el('tr');const cell=el('td','No process errors');cell.colSpan=3;row.append(cell);errorRows.append(row)}
if((data.ranking||[]).length>1){document.getElementById('comparison').hidden=false;const ranking=document.getElementById('ranking');for(const item of data.ranking){const row=el('tr');for(const value of [item.converterId,item.correctness.pass||0,item.correctness.warning||0,item.correctness.fail||0,item.correctness.inconclusive||0,fmtMs(item.medianWallTimeMs),fmtMem(item.medianPeakWorkingSetBytes)])row.append(el('td',String(value)));ranking.append(row)}}
const kindSelect=document.getElementById('kind');for(const kind of new Set(cases.map(c=>c.documentKind||'unspecified')))kindSelect.append(el('option',kind));
const rows=document.getElementById('cases'),search=document.getElementById('search'),outcome=document.getElementById('correctness'),failedOnly=document.getElementById('failedOnly'),detailsDialog=document.getElementById('details-dialog'),detailsTitle=document.getElementById('details-title'),detailsContent=document.getElementById('details-content'),diffDialog=document.getElementById('diff-dialog'),diffTitle=document.getElementById('diff-title'),diffContent=document.getElementById('diff-content');
document.getElementById('close-details').addEventListener('click',()=>detailsDialog.close());
detailsDialog.addEventListener('click',event=>{if(event.target===detailsDialog)detailsDialog.close()});
document.getElementById('close-diff').addEventListener('click',()=>diffDialog.close());
diffDialog.addEventListener('click',event=>{if(event.target===diffDialog)diffDialog.close()});
function medianPercent(values){const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b);if(!sorted.length)return null;const m=Math.floor(sorted.length/2);return sorted.length%2?sorted[m]:(sorted[m-1]+sorted[m])/2}
function render(){rows.replaceChildren();const query=search.value.trim().toLowerCase(),choice=outcome.value,kind=kindSelect.value,onlyFailed=failedOnly.checked;
const visible=cases.filter(c=>(!query||(c.displayName||'').toLowerCase().includes(query))&&(!choice||c.shortStatus===choice)&&(!kind||c.documentKind===kind)&&(!onlyFailed||['Error','Mixed','Failed'].includes(c.shortStatus)));
document.getElementById('case-count').textContent='Showing '+visible.length+' of '+cases.length+' case results';
if(!visible.length){const row=el('tr'),cell=el('td','No maps or mods match these filters.');cell.colSpan=11;row.append(cell);rows.append(row);return}
for(const c of visible){const row=el('tr'),metrics=c.outputMetrics||{};row.dataset.caseId=c.caseId;row.dataset.converterId=c.converterId;
const name=el('td',c.displayName||'Unknown package','case-name');name.title=(c.displayName||'Unknown package')+' · '+(c.documentKind||'package')+' · '+fmtBytes(c.packageBytes);row.append(name);
const statusCell=el('td'),status=el('span',c.shortStatus||'Unknown','status status-'+(c.shortStatus||'unknown').toLowerCase());statusCell.append(status);row.append(statusCell);
const reasons=el('td',(c.failureReasons||[]).map(item=>item.reason+(item.attempts>1?' ×'+item.attempts:'')).join('; ')||'—','reason-cell');reasons.title=reasons.textContent;row.append(reasons);
row.append(el('td',fmtNum(metrics.guiTriggers),'number'+(Number.isFinite(metrics.guiTriggers)?'':' metric-empty')));
row.append(el('td',fmtNum(metrics.customScriptTags),'number'+(Number.isFinite(metrics.customScriptTags)?'':' metric-empty')));
const astCell=el('td',Number.isFinite(metrics.astSimilarityPercent)?metrics.astSimilarityPercent.toFixed(1)+'%':'—','number metric-main');astCell.title=fmtNum(metrics.astDifferences)+' AST differences · '+fmtNum(metrics.callDifferences)+' call differences';row.append(astCell);
const originalRun=c.attempts.find(a=>a.originalConversion)?.originalConversion,originalRunCell=el('td',originalRun?.status==='completed'?'Done · '+(originalRun.wallTimeMs/1000).toFixed(1)+' s':originalRun?.status==='failed'?'Error':'—','number');originalRunCell.title=originalRun?.error||'Original Triggers → our Galaxy';row.append(originalRunCell);
const originalCell=el('td',Number.isFinite(metrics.originalAstSimilarityPercent)?metrics.originalAstSimilarityPercent.toFixed(1)+'%':c.attempts.some(a=>a.originalConversion?.status==='failed')?'Error':'—','number metric-main');originalCell.title=c.attempts.find(a=>a.originalConversion?.error)?.originalConversion.error||fmtNum(metrics.originalAstDifferences)+' AST differences · '+fmtNum(metrics.originalCallDifferences)+' call differences';row.append(originalCell);
const lines=el('td',fmtNum(metrics.galaxyInputLines)+' / '+fmtNum(metrics.triggerDataLines),'number');lines.title='Input Galaxy: '+fmtNum(metrics.galaxyInputLines)+' lines; generated Triggers: '+fmtNum(metrics.triggerDataLines)+' lines';row.append(lines);
const time=c.performance.wallTimeMs?.median,mem=c.performance.peakWorkingSetBytes?.median;
const performance=el('td',(Number.isFinite(time)?(time/1000).toFixed(1)+' s':'—')+' · '+(Number.isFinite(mem)?(mem/1048576).toFixed(0)+' MiB':'—'),'number');performance.title='Median time: '+fmtMs(time)+'; peak memory: '+fmtMem(mem);row.append(performance);
const detailsCell=el('td'),actions=el('div',undefined,'case-actions'),detailsButton=el('button','Details','link-button');detailsButton.type='button';detailsButton.addEventListener('click',()=>showDetails(c));actions.append(detailsButton);
const comparable=c.attempts.find(a=>Object.values(a.functionDiffs||{}).some(group=>group.functions?.length));
if(comparable){const compare=el('button','Compare','link-button diff-button');compare.type='button';compare.dataset.caseId=c.caseId;compare.dataset.converterId=c.converterId;compare.dataset.attempt=String(comparable.attempt);actions.append(compare)}
detailsCell.append(actions);row.append(detailsCell);
rows.append(row)}}
function showDetails(c){detailsTitle.textContent=(c.displayName||c.caseId)+' · '+(c.converterId||'converter');detailsContent.replaceChildren();
for(const a of c.attempts){const box=el('section'),status=a.status==='completed'?a.correctness:'Error';
box.append(el('strong',(c.attempts.length>1?'Run '+a.attempt+' · ':'')+status+' · '+fmtMs(a.wallTimeMs)+' · '+fmtMem(a.peakWorkingSetBytes)));
if(a.error){const errorDetails=el('details'),errorSummary=el('summary',a.error.split(/\\r?\\n/)[0]||'Process error');errorDetails.append(errorSummary,el('pre',a.error,'err-pre'));box.append(errorDetails)}
const diag=a.diagnosticsSummary;if(diag&&diag.total){const p=el('p',undefined,'muted');p.textContent=diag.total+' diagnostics';const list=el('div',undefined,'diag-list');for(const item of diag.byCode)list.append(el('div',item.severity+' · '+item.code+' × '+item.count+(item.example?' — '+item.example:'')));if(diag.truncatedCodes)list.append(el('small','+'+diag.truncatedCodes+' more codes'));box.append(p,list)}
const differences=Object.entries(a.structuralComparison||{}).flatMap(([file,comparison])=>(comparison.differenceSamples?.samples||[]).map(diff=>({file,diff,total:comparison.differenceSamples.total})));
for(const [file,comparison] of Object.entries(a.structuralComparison||{})){if(comparison.astMetrics?.status==='available')box.append(el('p',file+' · AST '+fmtNum(comparison.astMetrics.astDifferences)+' differences'))}
for(const item of differences){const card=el('article',undefined,'diff-item');card.append(el('strong',item.file),el('pre',item.diff));box.append(card)}
const links=el('div',undefined,'artifact-links');for(const artifact of [...(a.inputArtifacts||[]),...(a.outputArtifacts||[])]){const link=el('a',artifact.role);link.href=fileUrl(artifact.path);link.target='_blank';links.append(link)}
for(const [label,path] of [['stdout.log',a.logFiles?.stdout],['stderr.log',a.logFiles?.stderr]]){if(!path)continue;const link=el('a',label);link.href=fileUrl(path);link.target='_blank';links.append(link)}
if(links.childNodes.length)box.append(links);
detailsContent.append(box)}detailsDialog.showModal()}
search.addEventListener('input',render);outcome.addEventListener('change',render);kindSelect.addEventListener('change',render);failedOnly.addEventListener('change',render);render();
</script><style>
.diff-toolbar{display:flex;align-items:center;gap:8px;margin:0 0 8px;flex-wrap:wrap}.diff-toolbar .muted{margin-right:auto}.function-pair{max-width:none;border:1px solid var(--line);border-bottom:0;background:var(--panel)}.function-pair:last-child{border-bottom:1px solid var(--line)}.function-pair>summary{padding:5px 10px;line-height:24px;font-weight:650;color:var(--text);background:#192839}.function-pair>summary small{margin-left:10px;font-weight:400}.diff-panes{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1fr);gap:0}.code-pane{min-width:0;margin:0;padding:0;overflow-x:auto;background:#111923;border-top:1px solid var(--line)}.code-pane+.code-pane{border-left:1px solid var(--line)}.code-pane h3{position:sticky;top:0;margin:0;padding:4px 8px;background:#19212c;border-bottom:1px solid #2b3949;font-size:12px}.code-line{display:flex;min-height:18px;font:11px/18px Consolas,monospace;white-space:pre}.code-line code{padding:0 6px;white-space:pre}.code-paren{background:#795713;color:#ffe39a;border-radius:2px}.code-line .line-no{width:38px;flex:none;padding-right:6px;text-align:right;color:#7e90a2;border-right:1px solid #293747;user-select:none}.code-added{background:#16442f;color:#bdffda}.code-tolerated{background:#4a3d16;color:#ffe9b0}.code-removed{background:#54232c;color:#ffd0d4}.code-empty{background:#111923}@media(max-width:600px){.code-line{font-size:10px}.code-line .line-no{width:30px}}
.code-line .tok-comment{color:#8294a8}.code-line .tok-keyword{color:#c79bea}.code-line .tok-type{color:#78c9e9}.code-line .tok-function{color:#a7c8ff}.code-line .tok-string{color:#e9bd88}.code-line .tok-number{color:#b9df8a}.code-line .tok-literal{color:#f0a49d}
.case-actions{display:flex;justify-content:flex-end;gap:3px}.case-actions .link-button{padding-inline:4px}
</style><script>
function appendSyntaxCode(code,text,marks,tokens){
  if(!text){code.textContent=' ';return}
  const parentheses=new Set(marks),syntax=tokens||[];let tokenIndex=0,start=0,previous=null;
  for(let index=0;index<text.length;index++){
    while(tokenIndex<syntax.length&&syntax[tokenIndex][1]<=index)tokenIndex++;
    const category=parentheses.has(index)?'code-paren':syntax[tokenIndex]?.[0]<=index&&index<syntax[tokenIndex]?.[1]?'tok-'+syntax[tokenIndex][2]:null;
    if(category===previous)continue;
    if(index>start){const part=text.slice(start,index);code.append(previous?el('span',part,previous):document.createTextNode(part))}
    start=index;previous=category;
  }
  const rest=text.slice(start);if(rest)code.append(previous?el('span',rest,previous):document.createTextNode(rest));
}
document.addEventListener('click',event=>{
  const button=event.target.closest('.diff-button');
  if(!button)return;
  const attemptNumber=Number(button.dataset.attempt);
  const benchmarkCase=data.caseResults.find(item=>item.caseId===button.dataset.caseId&&item.converterId===button.dataset.converterId),attempt=benchmarkCase?.attempts.find(item=>item.attempt===attemptNumber),displayName=benchmarkCase?.displayName||'Map / mod';
  const functions=Object.entries(attempt?.functionDiffs||{}).flatMap(([file,group])=>(group.functions||[]).map(item=>({...item,file,truncated:group.truncated})));
  if(!functions.length)return;
  event.preventDefault();event.stopImmediatePropagation();
  const dialog=document.getElementById('diff-dialog'),title=document.getElementById('diff-title'),content=document.getElementById('diff-content');
  title.textContent=displayName+' · run '+attemptNumber+' · '+functions.length+' changed sections'+(functions[0]?.truncated?' (+'+functions[0].truncated+' more not shown)':'');content.replaceChildren();
  const toolbar=el('div',undefined,'diff-toolbar'),expand=el('button','Expand all','diff-button'),collapse=el('button','Collapse all','diff-button');
  expand.type=collapse.type='button';toolbar.append(el('span','Comments, whitespace and line wrapping ignored · paired local names, redundant parentheses, comparisons with true/false, typed Color literals, empty else and inert semicolons in yellow; an equivalent section differs only in such forms (not an error)','muted'),expand,collapse);content.append(toolbar);
  expand.addEventListener('click',()=>content.querySelectorAll('.function-pair').forEach(pair=>{pair.open=true}));
  collapse.addEventListener('click',()=>content.querySelectorAll('.function-pair').forEach(pair=>{pair.open=false}));
  for(const item of functions){
    const lines=diffFunctionLines(item.expectedSource||'',item.actualSource||'',item.aliases),pair=el('details',undefined,'function-pair'),panes=el('div',undefined,'diff-panes');
    pair.open=true;pair.append(el('summary',item.name+' · '+item.status+' · '+(item.file.startsWith('original')?'Original Triggers → Galaxy':'Galaxy roundtrip')+' · '+item.file));
    for(const [side,label] of [['converted',item.file.startsWith('original')?'Our Galaxy from original Triggers':'Roundtrip Galaxy'],['original','Editor Galaxy']]){
      const pane=el('section',undefined,'code-pane');pane.append(el('h3',label+' · '+item.name));
      for(const line of lines){const change=side==='converted'?line.convertedChange:line.originalChange,number=side==='converted'?line.convertedLine:line.originalLine,text=side==='converted'?line.convertedText:line.originalText,marks=[...((side==='converted'?line.convertedParenHighlights:line.originalParenHighlights)||[]),...((side==='converted'?line.convertedAliasHighlights:line.originalAliasHighlights)||[])],syntax=side==='converted'?item.convertedSyntax:item.originalSyntax,entry=el('div',undefined,'code-line '+((change==='add'||change==='remove')&&item.status==='equivalent'?'code-tolerated':change==='add'?'code-added':change==='remove'?'code-removed':change==='empty'?'code-empty':'')),code=el('code');appendSyntaxCode(code,text,marks,syntax?.[number-1]);entry.append(el('span',number??'','line-no'),code);pane.append(entry)}
      panes.append(pane);
    }
    pair.append(panes);content.append(pair);
  }
  dialog.showModal();
},true);
</script></html>`;
}

export async function writeReport(summary) {
  const functionDiffs = await enrichAstMetrics(summary);
  const report = buildReport(summary, functionDiffs);
  await enrichGalaxySyntax(report);
  await enrichLineCounts(report);
  const jsonPath = path.join(summary.runDirectory, 'report.json');
  const htmlPath = path.join(summary.runDirectory, 'report.html');
  await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
  await writeFile(htmlPath, renderReportHtml(report));
  return { jsonPath, htmlPath };
}

export function openReport(file) {
  const target = path.resolve(file);
  if (process.platform === 'win32') {
    const quoted = target.replaceAll("'", "''");
    const child = spawn('powershell.exe', ['-NoLogo', '-NoProfile', '-Command', `Start-Process -LiteralPath '${quoted}'`], { detached: true, stdio: 'ignore', windowsHide: true });
    child.unref();
    return;
  }
  const child = spawn(process.platform === 'darwin' ? 'open' : 'xdg-open', [target], { detached: true, stdio: 'ignore' });
  child.unref();
}
