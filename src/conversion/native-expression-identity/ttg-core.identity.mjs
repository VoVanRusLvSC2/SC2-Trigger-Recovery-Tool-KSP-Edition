export * from './core-alternate.mjs';
import {
  sanitizeIdentifier,
  libraryPrefix,
} from '../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
/** Explicit editor Identifiers can begin with a digit because gt_ is already
 * legal. A default display name still uses the editor's ordinary sanitizer. */
export function recoveredTriggerScriptStem(trigger) {
  const raw = trigger.identifier ?? trigger.name ?? trigger.id;
  if (trigger.identifier !== undefined && /^[0-9][A-Za-z0-9_]*$/u.test(raw)) return raw;
  return sanitizeIdentifier(raw);
}
export function triggerFuncName(libId, trigger) {
  return `${libraryPrefix(libId)}gt_${recoveredTriggerScriptStem(trigger)}_Func`;
}
export function triggerHandleName(libId, trigger) {
  return `${libraryPrefix(libId)}gt_${recoveredTriggerScriptStem(trigger)}`;
}
export function triggerInitFuncName(libId, trigger) {
  return `${libraryPrefix(libId)}gt_${recoveredTriggerScriptStem(trigger)}_Init`;
}
