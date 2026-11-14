/** Editor type constraints. These are schema fields, never API/map names. */
export const guiTypeQualifiers = Object.freeze({
  GameType: 'gameType',
  VariableType: 'variableType',
  UserType: 'userType',
  AssetType: 'assetType',
  EntryType: 'entryType',
  ReferenceType: 'referenceType',
  CmdTarget: 'cmdTarget',
});

export function retainedGuiType(type) {
  if (!type?.type) return undefined;
  const result = { type: type.type };
  for (const key of [...Object.values(guiTypeQualifiers), 'typeElement']) {
    if (type[key] !== undefined) result[key] = type[key];
  }
  return result;
}
