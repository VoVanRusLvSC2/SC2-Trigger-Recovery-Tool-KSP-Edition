import { parentPort, workerData } from 'node:worker_threads';
import { libraryInitializers } from '../analysis/compiler-library-autoload.gui-demand.mjs';
import { arrayValuesSdkRoot } from '../sdk/runtime.mjs';
import { readAuthoredNativeCatalog } from '../utilities/read-authored-trigger-document.mjs';

const native = workerData.filter(({ fileName }) =>
  /(?:^|[\\/])nativelib\.triggerlib$/iu.test(fileName),
);
if (native.length === 1) {
  const [{ text, sha256 }] = native;
  try {
    const { document, scopeProof } = await readAuthoredNativeCatalog(text, arrayValuesSdkRoot);
    parentPort.postMessage({
      type: 'native-catalog',
      sha256,
      catalog: { document: { libraries: document.libraries }, scopeProof },
    });
  } catch {
    // A failed speculative read is retried by the original native catalog check.
  }
}
parentPort.postMessage({ type: 'native-finished' });
parentPort.postMessage({ type: 'initializers', value: libraryInitializers(workerData) });
