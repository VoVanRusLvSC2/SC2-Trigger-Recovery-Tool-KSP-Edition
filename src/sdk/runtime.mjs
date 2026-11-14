/** Runtime paths belong to this checkout. Historical graph JSON is provenance,
 * never a source of executable module locations. */
import { fileURLToPath, pathToFileURL } from 'node:url';
import { isAbsolute, resolve } from 'node:path';
import { stat } from 'node:fs/promises';
import { TriggerDocument } from './array-values/modules/triggers/services/galaxy-conversion/trigger-document.js';
import { parseTriggerXmlSync, readTriggerLibrariesFast } from '../ast/authored-xml-parser.mjs';
import { xmlTree } from './array-values/modules/triggers/shared/trigger-document/lossless-xml.js';

export const arrayValuesSdkRoot = fileURLToPath(new URL('./array-values/', import.meta.url));
const localRuntime = Object.freeze({ TriggerDocument, parseTriggerXmlSync, readTriggerLibrariesFast, xmlTree });

export function isLocalTriggerSdk(sdk = arrayValuesSdkRoot) {
  return typeof sdk === 'string' && isAbsolute(sdk) && resolve(sdk) === resolve(arrayValuesSdkRoot);
}

/** An explicitly supplied external SDK keeps its own document/parser classes.
 * Validate the complete requested layout before loading any of its modules. */
export async function loadAuthoredSdk(sdk = arrayValuesSdkRoot) {
  if (isLocalTriggerSdk(sdk)) return localRuntime;
  if (typeof sdk !== 'string' || !isAbsolute(sdk)) throw new TypeError('SDK root must be an absolute directory');
  const root = pathToFileURL(resolve(sdk) + '/');
  const urls = [
    'services/galaxy-conversion/trigger-document.js',
    'shared/trigger-document/sax-reader.js',
    'shared/trigger-document/lossless-xml.js',
  ].map((file) => new URL('dist/modules/triggers/' + file, root));
  await Promise.all(urls.map(async (url) => {
    if (!(await stat(url)).isFile()) throw new TypeError('SDK module is not a regular file: ' + url.href);
  }));
  const [document, parser, xml] = await Promise.all(urls.map((url) => import(url.href)));
  const runtime = { TriggerDocument: document.TriggerDocument, parseTriggerXmlSync: parser.parseTriggerXmlSync, readTriggerLibrariesFast: parser.readTriggerLibrariesFast, xmlTree: xml.xmlTree };
  for (const [name, value] of Object.entries(runtime)) if (typeof value !== 'function') throw new TypeError('SDK export missing: ' + name);
  return runtime;
}
