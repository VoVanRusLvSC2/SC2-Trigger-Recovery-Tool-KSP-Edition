import path from 'node:path';
import { fileURLToPath } from 'node:url';

/** Resource data uses filesystem paths; module imports use URLs. In particular,
 * path.resolve(base, 'file:///...') does not decode a file URL on Windows. */
export function localResourcePath(resource, base = process.cwd()) {
  if (resource instanceof URL || (typeof resource === 'string' && /^file:/i.test(resource))) {
    const url = resource instanceof URL ? resource : new URL(resource);
    if (url.protocol !== 'file:' || url.search || url.hash)
      throw Error('LOCAL_FILE_RESOURCE_URL_REQUIRED');
    return fileURLToPath(url);
  }
  if (typeof resource !== 'string' || !resource) throw Error('LOCAL_FILE_RESOURCE_PATH_REQUIRED');
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(resource)) throw Error('LOCAL_FILE_RESOURCE_URL_REQUIRED');
  return path.resolve(base instanceof URL ? fileURLToPath(base) : base, resource);
}
