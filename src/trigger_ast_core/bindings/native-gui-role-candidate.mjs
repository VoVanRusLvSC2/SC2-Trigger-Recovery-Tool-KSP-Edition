// Role is part of the GUI contract, not a filter after an ambiguous lookup.
// Reuse all signature/ParamDef/owner checks from the candidate index.
export function resolveNativeRoleCandidate(index, query, requiredRole) {
  const guiUse = {Event: 'event', Action: 'action', Call: 'value'}[requiredRole];
  if (!guiUse || !query.declaration) return {status: 'UNRESOLVED', candidateKeys: [], reason: 'A declared GUI role and actual Galaxy ABI are required'};
  const matches = (index.bySymbol.get(query.name) ?? []).filter(candidate =>
    candidate.definition.flags?.includes('Native') && candidate.definition.flags.includes(requiredRole));
  if (matches.length !== 1) return {status: matches.length ? 'AMBIGUOUS' : 'UNRESOLVED',
    candidateKeys: matches.map(candidate => candidate.key), reason: 'Native owner for the proved GUI role is not unique'};
  const candidate = matches[0];
  const resolution = index.resolve({...query, guiUse, libraryId: candidate.library.id});
  if (resolution.status !== 'RESOLVED' || resolution.candidateKeys[0] !== candidate.key) return resolution;
  return {...resolution, requiredRole, owner: candidate.key};
}
