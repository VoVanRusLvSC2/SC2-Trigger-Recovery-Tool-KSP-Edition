export async function convertGalaxyToTriggers(input) {
  if (!input.script.includes('InitMap')) throw new Error('missing script');
  if (!input.header.includes('BenchmarkHeader')) throw new Error('missing header');
  if (input.galaxyDeclarations.length !== 1) throw new Error('missing declaration');
  if (input.dependencyLibraries.length !== 1 || !input.dependencyLibraries[0].triggerStrings) throw new Error('missing dependency');
  return {
    output: {
      triggerData: '<TriggerData/>\n',
      triggerStrings: 'DocInfo/Name=Recovered\n',
      ...(input.gameStrings ? { gameStrings: input.gameStrings } : {}),
      generationOptions: { initialization: 'preserve' },
      elements: 1,
      typeCounts: { Trigger: 1 },
    },
    diagnostics: input.fixtureDiagnostic
      ? [{ severity: 'warning', code: input.fixtureDiagnostic }]
      : [],
    fidelity: { complete: true },
    provenance: { converter: 'fake-modkit', documentKind: input.documentKind },
  };
}

export async function convertTriggersToGalaxy(triggerData, input) {
  if (!triggerData.includes('<TriggerData')) throw new Error('missing TriggerData');
  if (input.fixtureRequirePreserve && input.initialization !== 'preserve') throw new Error('lost generation contract');
  return {
    output: {
      script: 'void Run() {}\n',
      header: 'void Run();\n',
      libraryId: 'TEST',
    },
    diagnostics: [],
    fidelity: { completeness: 'complete' },
  };
}

export function parseGalaxySource(source) {
  return source;
}

export function compareGalaxyPrograms(expected, actual) {
  const normalize = source => source.replace(/\s+/gu, ' ').trim();
  const exact = normalize(expected) === normalize(actual);
  return { exact, syntaxValid: true, functions: { differenceSamples: exact ? [] : ['fake AST mismatch'] } };
}
