// Proves totality only. It never substitutes host arithmetic for Galaxy values.
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const limit = 32766n;
const abs = n => n < 0n ? -n : n;
const bounded = ({lo, hi}) => lo > -limit && hi < limit;

function envelope(token) {
    if (typeof token !== 'string' || token.length > 128) return;
    let numerator, denominator = 1n;
    if (/^[+-]?0[xX][0-9a-fA-F]+$/u.test(token)) {
        numerator = BigInt(token.replace(/^[+-]/u, ''));
        if (token[0] === '-') numerator = -numerator;
    } else {
        const match = /^([+-]?)(\d+)(?:\.(\d*))?$/u.exec(token);
        if (!match) return;
        if (match[3] === undefined && /^0[0-7]+$/u.test(match[2])) {
            numerator = BigInt('0o' + match[2].slice(1));
        } else {
            if (match[3] === undefined && match[2].length > 1 && match[2][0] === '0' && /[89]/u.test(match[2])) return;
            denominator = 10n ** BigInt(match[3]?.length ?? 0);
            numerator = BigInt(match[2]) * denominator + BigInt(match[3] || '0');
        }
        if (match[1] === '-') numerator = -numerator;
    }
    const quotient = numerator / denominator, remainder = numerator % denominator;
    // Whole-unit slack contains fixed quantization; exact integers need no slack.
    const lo = remainder === 0n ? quotient : quotient - (numerator < 0n ? 1n : 0n) - 1n;
    const hi = remainder === 0n ? quotient : quotient + (numerator > 0n ? 1n : 0n) + 1n;
    return bounded({lo, hi}) ? {lo, hi} : undefined;
}

function combine(op, a, b) {
    if (op === K.PlusToken) return {lo: a.lo + b.lo - 1n, hi: a.hi + b.hi + 1n};
    if (op === K.MinusToken) return {lo: a.lo - b.hi - 1n, hi: a.hi - b.lo + 1n};
    if (op === K.AsteriskToken) {
        const values = [a.lo*b.lo, a.lo*b.hi, a.hi*b.lo, a.hi*b.hi];
        return {lo: values.reduce((x,y) => x < y ? x : y) - 1n,
                hi: values.reduce((x,y) => x > y ? x : y) + 1n};
    }
    if (op === K.SlashToken && (b.lo >= 1n || b.hi <= -1n)) {
        const numerator = abs(a.lo) > abs(a.hi) ? abs(a.lo) : abs(a.hi);
        const denominator = abs(b.lo) < abs(b.hi) ? abs(b.lo) : abs(b.hi);
        const bound = (numerator + denominator - 1n) / denominator + 1n;
        return {lo: -bound, hi: bound};
    }
}

export function proveBoundedLiteralArithmetic(node, resolve) {
    if (node.kind !== K.BinaryExpression) return;
    let visits = 0;
    const operands = [];
    function visit(n, depth) {
        if (!n || ++visits > 128 || depth > 16) return;
        const literal = resolve(n);
        if (literal) {
            const interval = envelope(literal.token);
            if (!interval) return;
            operands.push(literal);
            return interval;
        }
        if (n.kind === K.ParenthesizedExpression) return visit(n.expression, depth + 1);
        if (n.kind === K.PrefixUnaryExpression && [K.PlusToken, K.MinusToken].includes(n.operator?.kind)) {
            const child = visit(n.operand, depth + 1);
            if (!child) return;
            return n.operator.kind === K.PlusToken ? child : {lo: -child.hi, hi: -child.lo};
        }
        if (n.kind !== K.BinaryExpression) return;
        const left = visit(n.left, depth + 1), right = visit(n.right, depth + 1);
        if (!left || !right) return;
        const interval = combine(n.operatorToken.kind, left, right);
        return interval && bounded(interval) ? interval : undefined;
    }
    const result = visit(node, 0);
    if (!result) return;
    return {kind: 'BOUNDED_READONLY_LITERAL_ARITHMETIC_TOTALITY', operands,
        resultInterval: {min: result.lo.toString(), max: result.hi.toString()},
        numericValueFolded: false, integerBigIntBounds: true,
        fixedRoundingEnvelopeWholeUnits: 1, everyIntermediateBounded: true,
        syntaxVisits: visits, rangeStrictlyInsideBothNumericCarriers: true,
        sourceOrCandidateChanged: false};
}
