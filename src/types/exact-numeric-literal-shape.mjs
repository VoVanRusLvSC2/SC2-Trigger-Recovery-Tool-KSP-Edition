// Syntax identity must not round source tokens through JavaScript Number.
// Equal decimal spellings are canonicalized exactly; no engine rounding or
// integer overflow semantics are assumed here.
export function exactNumericLiteralShape(node) {
  const token = String(node.text ?? node.value);
  let numericType, value;
  if (
    /^0[xX][\da-fA-F]+$/u.test(token) ||
    /^0[bB][01]+$/u.test(token) ||
    /^0[oO][0-7]+$/u.test(token)
  ) {
    numericType = 'integer';
    value = BigInt(token).toString();
  } else if (/^\d+$/u.test(token)) {
    numericType = 'integer';
    value = token.replace(/^0+(?=\d)/u, '');
  } else if (/^(?:\d+\.\d*|\.\d+)$/u.test(token)) {
    numericType = 'fixed';
    const [whole, fraction] = token.split('.');
    value = (whole || '0').replace(/^0+(?=\d)/u, '') + '.' + (fraction.replace(/0+$/u, '') || '0');
  } else {
    // An unfamiliar token is only equal to that same token. In particular,
    // Infinity/NaN or exponent syntax never acquire Number-based equality.
    numericType = 'unclassified';
    value = token;
  }
  return { kind: node.kind, numericType, value };
}
