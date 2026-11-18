/** Match the map compiler locale policy; archive enumeration is not an authority.
 * Keep tables separate: selecting metadata must never overwrite translations. */
export function primaryLocalizedTable(tables = [], preferredLocale = 'enUS') {
  return tables.find((table) => table.locale === preferredLocale) ?? tables[0] ?? {};
}
