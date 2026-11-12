import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const request = JSON.parse(await readFile(process.argv[2], 'utf8'));
if (request.options.mode === 'crash') {
  console.error('mock converter crashed deliberately');
  process.exit(9);
}
if (request.options.mode === 'slow') await new Promise(resolve => setTimeout(resolve, 10_000));
await mkdir(request.outputDirectory, { recursive: true });

if (request.options.mode === 'mutate-package') {
  const packageInput = request.inputs.find(input => input.role === 'package');
  if (!packageInput) throw new Error('package input is required');
  const script = path.join(packageInput.path, 'MapScript.galaxy');
  const original = await readFile(script, 'utf8');
  await writeFile(script, 'mutated by converter');
  await writeFile(path.join(request.outputDirectory, 'package-input.txt'), original);
  await writeFile(request.resultPath, JSON.stringify({
    schemaVersion: 1,
    status: 'completed',
    artifacts: [{ role: 'script', path: 'package-input.txt' }],
    diagnostics: [],
  }));
  process.exit(0);
}

if (request.operation === 'triggers-to-galaxy') {
  const script = path.join(request.outputDirectory, 'Galaxy.galaxy');
  await writeFile(script, 'void Run() {}\n');
  await writeFile(request.resultPath, JSON.stringify({
    schemaVersion: 1,
    status: 'completed',
    artifacts: [{ role: 'script', path: 'Galaxy.galaxy' }],
    diagnostics: [],
    conversionQuality: { completeness: 'complete' },
    structuralComparison: { script: { status: 'equivalent', exact: true, syntaxValid: true } },
  }));
  process.exit(0);
}

const triggerData = path.join(request.outputDirectory, 'Triggers');
const triggerStrings = path.join(request.outputDirectory, 'TriggerStrings.txt');
await writeFile(triggerData, `<TriggerData case="${request.caseId}"/>\n`);
await writeFile(triggerStrings, `DocInfo/Name=${request.caseId}\n`);
if (request.options.mode === 'overclaim-gui') {
  await writeFile(request.resultPath, JSON.stringify({
    schemaVersion: 1,
    status: 'completed',
    artifacts: [
      { role: 'trigger-data', path: 'Triggers' },
      { role: 'trigger-strings', path: 'TriggerStrings.txt' },
    ],
    diagnostics: [],
    conversionQuality: { completeness: 'complete' },
    structuralComparison: { script: { status: 'equivalent', exact: true, syntaxValid: true } },
    guiComparison: { status: 'equivalent-structure' },
  }));
  process.exit(0);
}
if (request.options.mode === 'invalid-output') {
  await writeFile(request.resultPath, JSON.stringify({ schemaVersion: 1, status: 'failed', artifacts: [] }));
  process.exit(0);
}
if (request.options.mode === 'empty-artifacts') {
  await writeFile(request.resultPath, JSON.stringify({ schemaVersion: 1, status: 'completed', artifacts: [] }));
  process.exit(0);
}
await writeFile(request.resultPath, JSON.stringify({
  schemaVersion: 1,
  status: 'completed',
  artifacts: [
    { role: 'trigger-data', path: 'Triggers' },
    { role: 'trigger-strings', path: 'TriggerStrings.txt' },
  ],
  diagnostics: [],
  guiComparison: request.options.guiComparison,
}));
