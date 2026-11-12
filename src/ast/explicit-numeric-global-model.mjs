// Actual Editor98310 proves a digit-leading explicit global Identifier is valid.
// Keep the existing model singleton and every nonnumeric naming rule unchanged.
export * from "../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
import {globalVariableName as original,libraryPrefix} from "../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/conversion-model.js";
export function globalVariableName(libraryId,variable){
 if(typeof variable.identifier==='string' && /^\d[A-Za-z0-9_]*$/u.test(variable.identifier) && !variable.flags?.includes('NoScriptPrefix'))
  return `${libraryPrefix(libraryId)}gv_${variable.identifier}`;
 return original(libraryId,variable);
}

export function globalVariableNames(libraryId,variables){
 const counts=new Map();for(const v of variables){const name=globalVariableName(libraryId,v);counts.set(name,(counts.get(name)??0)+1);}
 return new Map(variables.map(v=>{const name=globalVariableName(libraryId,v),suffix=v.id.replace(/[^a-zA-Z0-9]/gu,'').toUpperCase().slice(0,8);return [v.id,counts.get(name)>1?`${name}_${suffix}`:name];}));
}
