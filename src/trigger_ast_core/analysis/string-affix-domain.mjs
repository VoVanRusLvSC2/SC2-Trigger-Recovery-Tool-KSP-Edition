// Abstract language of normal string-concatenation results. Unknown values are
// retained as top, never sampled or replaced in the original program.
export const unknownStringAffix=()=>({prefix:'',suffix:'',exact:false});
export const literalStringAffix=value=>({prefix:value,suffix:value,exact:true});
export function concatenateStringAffixes(left,right){
 return {prefix:left.exact?left.prefix+right.prefix:left.prefix,
  suffix:right.exact?left.suffix+right.suffix:right.suffix,
  exact:left.exact&&right.exact};
}
export function stringAffixMayContain(domain,value){
 return domain.exact?value===domain.prefix:value.startsWith(domain.prefix)&&value.endsWith(domain.suffix)&&value.length>=Math.max(domain.prefix.length,domain.suffix.length);
}
export function excludesCaseFoldedIdentifiers(domain,identifiers){
 const names=[...identifiers];
 if(!/^[\x20-\x7e]*$/u.test(domain.prefix+domain.suffix)||names.some(n=>typeof n!=='string'||!/^[A-Za-z_]\w*$/u.test(n)))return false;
 const folded={...domain,prefix:domain.prefix.toLowerCase(),suffix:domain.suffix.toLowerCase()};
 return names.every(name=>!stringAffixMayContain(folded,name.toLowerCase()));
}
