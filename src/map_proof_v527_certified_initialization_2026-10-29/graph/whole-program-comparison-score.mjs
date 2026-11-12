// Diagnostic ordering only. It cannot change the oracle's exact/syntax verdict.
// Proven declaration/signature progress must not be discarded merely because
// the number of differing functions stayed unchanged in the complete pair.
export function countWholeProgramMismatches(comparison){
 if(!comparison.syntaxValid)return Infinity;
 let total=0;
 for(const section of Object.values(comparison)){
  if(!section||typeof section!=='object'||Array.isArray(section))continue;
  let count=0;
  for(const name of ['missing','added','differing','duplicateExpected','duplicateActual'])
   if(Array.isArray(section[name]))count+=section[name].length;
  for(const [name,list]of [['missingCount','missing'],['addedCount','added']])
   if(!Array.isArray(section[list])&&Number.isSafeInteger(section[name])&&section[name]>0)count+=section[name];
  if(section.exact===false&&!count)count=1;
  total+=count;
 }
 return total||Number(comparison.exact!==true);
}
