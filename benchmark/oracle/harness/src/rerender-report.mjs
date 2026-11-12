import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { enrichGalaxySyntax, renderReportHtml } from './report.mjs';

const jsonPath = path.resolve(process.argv[2] ?? '');
if (!process.argv[2] || path.basename(jsonPath) !== 'report.json') {
  throw new TypeError('Usage: node src/rerender-report.mjs <run-directory>/report.json');
}
const report = JSON.parse(await readFile(jsonPath, 'utf8'));
await enrichGalaxySyntax(report);
await writeFile(jsonPath, `${JSON.stringify(report, null, 2)}\n`);
await writeFile(path.join(path.dirname(jsonPath), 'report.html'), renderReportHtml(report));
console.log(path.join(path.dirname(jsonPath), 'report.html'));
