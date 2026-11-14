/** GUI unitfilter scalars use source flag tokens, not display Preset identifiers.
 * E.g. loaded MapObject preset has value c_targetFilterUser1, but the actual
 * Editor stores User1 in unitfilter values. Require the exact declared binding.
 */
export function unitFilterSourceSymbol(identifier,definition) {
 const match=/^c_targetFilter([A-Za-z][A-Za-z0-9]*)$/u.exec(identifier??'');
 return match&&definition?.type==='PresetValue'&&definition.value===identifier?match[1]:undefined;
}
