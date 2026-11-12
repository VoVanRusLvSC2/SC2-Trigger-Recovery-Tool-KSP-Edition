function namedCounts(comparison = {}) {
  return {
    expected: comparison.expected ?? 0,
    actual: comparison.actual ?? 0,
    exact: comparison.exact?.length ?? 0,
    equivalent: comparison.equivalent?.length ?? 0,
    missing: comparison.missing?.length ?? 0,
    added: comparison.added?.length ?? 0,
    differing: comparison.differing?.length ?? 0,
    duplicateExpected: comparison.duplicateExpected?.length ?? 0,
    duplicateActual: comparison.duplicateActual?.length ?? 0,
  };
}

function sequenceCounts(comparison = {}) {
  return {
    expected: comparison.expected ?? 0,
    actual: comparison.actual ?? 0,
    exact: comparison.exact === true,
    differences: comparison.exact === true ? 0 : 1,
    sample: comparison.difference,
  };
}

function callCounts(comparison = {}) {
  return {
    missing: comparison.missingCount ?? 0,
    added: comparison.addedCount ?? 0,
    missingSamples: comparison.missingSamples ?? [],
    addedSamples: comparison.addedSamples ?? [],
  };
}

export function summarizeAstComparison(comparison) {
  if (!comparison || typeof comparison !== 'object') return { status: 'unavailable' };
  if (!['functions', 'signatures', 'declarations'].some(key =>
    Number.isFinite(comparison[key]?.expected) && Number.isFinite(comparison[key]?.actual))) {
    return { status: 'unavailable' };
  }
  const components = {
    functions: namedCounts(comparison.functions),
    signatures: namedCounts(comparison.signatures),
    declarations: namedCounts(comparison.declarations),
    includes: sequenceCounts(comparison.includes),
    globalInitializers: sequenceCounts(comparison.globalInitializers),
    calls: callCounts(comparison.calls),
    callees: callCounts(comparison.callees),
    triggerRegistrations: callCounts(comparison.triggerRegistrations),
  };
  const named = [components.functions, components.signatures, components.declarations];
  const expected = named.reduce((total, item) => total + item.expected, 0);
  const actual = named.reduce((total, item) => total + item.actual, 0);
  // An item equal only up to tolerated forms matches: a difference, not an error.
  const exact = named.reduce((total, item) => total + item.exact + item.equivalent, 0);
  const equivalent = named.reduce((total, item) => total + item.equivalent, 0);
  const namedDifferences = named.reduce((total, item) => total + item.missing + item.added + item.differing
    + item.duplicateExpected + item.duplicateActual, 0);
  const sequenceDifferences = components.includes.differences + components.globalInitializers.differences;
  const callDifferences = ['calls', 'callees', 'triggerRegistrations'].reduce((total, key) =>
    total + components[key].missing + components[key].added, 0);
  return {
    status: 'available',
    syntaxValid: comparison.syntaxValid,
    exact: comparison.exact,
    tolerated: comparison.tolerated === true,
    similarityPercent: expected + actual === 0 ? null : Math.round(200 * exact / (expected + actual) * 10) / 10,
    expectedNamedNodes: expected,
    actualNamedNodes: actual,
    exactNamedNodes: exact,
    equivalentNamedNodes: equivalent,
    namedNodeDifferences: namedDifferences,
    sequenceDifferences,
    callDifferences,
    astDifferences: namedDifferences + sequenceDifferences,
    components,
  };
}
