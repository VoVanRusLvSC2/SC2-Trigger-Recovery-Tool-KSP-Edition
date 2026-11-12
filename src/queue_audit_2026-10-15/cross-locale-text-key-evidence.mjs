// Locale presence is evidence about an existing key, never a translation or
// fallback decision. No resource table is merged, synthesized or changed.
import {parseLocalizedValueTable} from './localized-value-retention.mjs';

export function nonemptyLocalizedTextKeys(tables = []) {
  const keys = new Set(), refused = new Set(), locales = new Set();
  for (const table of tables) {
    if (!/^[a-z]{2}[A-Z]{2}$/u.test(table.locale ?? '') || locales.has(table.locale)) {
      throw new TypeError('Distinct real locale tables are required');
    }
    locales.add(table.locale);
    const local = new Map();
    for (const field of ['triggerStrings', 'gameStrings']) {
      if (table[field] === undefined) continue;
      if (typeof table[field] !== 'string') throw new TypeError('Localized table must be text');
      for (const [key, values] of parseLocalizedValueTable(Buffer.from(table[field], 'utf8')).values) {
        if (!/^Param\/Value\/(?:lib_[A-Za-z0-9]+_)?[0-9A-Fa-f]{8}$/u.test(key)) continue;
        const observed = local.get(key) ?? new Set();
        for (const value of values) observed.add(value);
        local.set(key, observed);
      }
    }
    for (const [key, values] of local) {
      // Different translations between locales are allowed. A conflict within
      // one locale, or any explicit empty value, keeps the native GUI call.
      if (values.size !== 1 || values.has('')) refused.add(key);
      else keys.add(key);
    }
  }
  for (const key of refused) keys.delete(key);
  return keys;
}

export function ownTextKey(library, paramId) {
  if (!library || !/^[0-9A-Fa-f]{8}$/u.test(paramId ?? '')) return undefined;
  return library.implicit === true
    ? `Param/Value/${paramId}`
    : `Param/Value/lib_${library.id}_${paramId}`;
}

// Non-serialized, per-conversion evidence only. It is recreated from the
// supplied document's own tables, including tables reread from the packed MPQ.
const evidence = new WeakMap();
export function attachLocalizedTextKeyEvidence(library, tables) {
  const prefix = library.implicit === true ? 'Param/Value/' : `Param/Value/lib_${library.id}_`;
  const keys = new Set([...nonemptyLocalizedTextKeys(tables)].filter(key => {
    const id = key.startsWith(prefix) ? key.slice(prefix.length) : undefined;
    return id !== undefined && ownTextKey(library, id) === key;
  }));
  evidence.set(library, keys);
  return keys.size;
}

export function hasLocalizedTextKeyEvidence(library, paramId) {
  const key = ownTextKey(library, paramId);
  return key !== undefined && evidence.get(library)?.has(key) === true;
}

export function documentTextLocales(input, normalized) {
  const primary = normalized.locales.find(table => table.locale === normalized.primaryLocale);
  return [{locale: normalized.primaryLocale,
    triggerStrings: input.triggerStrings ?? primary?.triggerStrings,
    gameStrings: input.gameStrings ?? primary?.gameStrings},
    ...normalized.locales.filter(table => table.locale !== normalized.primaryLocale)];
}
