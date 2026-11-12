/** Isolated proposal: a proved GUI role constrains an existing candidate.
 * No new definitions, prototypes, name ranking, trigger movement or acceptance.
 */
export function resolveNativeRoleCandidate(index,query,requiredRole) {
 const matches=(index.bySymbol.get(query.name)??[]).filter(c=>c.definition.flags?.includes('Native')&&c.definition.flags.includes(requiredRole));
 if(!query.declaration)return {status:'UNRESOLVED',reason:'An actual Galaxy declaration is required',candidateKeys:[]};
 if(matches.length!==1)return {status:matches.length?'AMBIGUOUS':'UNRESOLVED',reason:'Native owner for the proved GUI role is not unique',candidateKeys:matches.map(c=>c.key)};
 // Reuse all existing ParamDef/hidden-trigger/carrier/ABI checks. The library
 // restriction is justified solely by the unique actual role-bearing owner.
 const candidate=matches[0],resolution=index.resolve({...query,libraryId:candidate.library.id});
 if(resolution.status!=='RESOLVED'||resolution.candidateKeys[0]!==candidate.key)return resolution;
 return {...resolution,requiredRole,owner: candidate.key};
}
