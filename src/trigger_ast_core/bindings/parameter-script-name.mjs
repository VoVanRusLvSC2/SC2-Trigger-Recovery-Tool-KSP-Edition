import {sanitizeIdentifier} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';

/** Explicit ABI identifiers and localized GUI names are different inputs.
 * The Editor sanitizes a localized name before adding lp_; a digit-leading
 * localized name therefore keeps the sanitizer's leading underscore.
 * Existing explicit identifiers retain the prior ABI rule. */
export function parameterScriptName(param, fallback = 'p0') {
  const explicit = param?.identifier ?? (param?.displayName === undefined ? param?.name : undefined);
  const source = String(explicit ?? param?.name ?? fallback);
  let stem = sanitizeIdentifier(source);
  if (explicit !== undefined && /^\d/u.test(source)) stem = stem.slice(1);
  if (!stem) stem = fallback;
  if (explicit === undefined) stem = stem[0].toLowerCase() + stem.slice(1);
  return stem.startsWith('lp_') ? stem : `lp_${stem}`;
}
