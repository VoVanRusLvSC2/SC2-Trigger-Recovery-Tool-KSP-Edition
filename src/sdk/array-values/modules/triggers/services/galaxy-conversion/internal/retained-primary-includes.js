/** Preserve actual primary-file includes that precede the first declaration.
 * Managed editor library includes stay owned by their existing library model.
 * No external path is guessed, copied, downloaded or read from a symbol catalog.
 */
// @ts-nocheck
export function retainPrimaryCustomIncludes(source, selected, headerInclude, files, managed){
 const names=new Set(files.map(p=>p.replaceAll('\\','/').toLowerCase()));
 const editor=new Set([...managed,headerInclude].filter(Boolean).map(p=>p.replaceAll('\\','/').toLowerCase()));
 const chosen=new Set(selected);
 for(const n of source.statements){
  if(n.kind!==136)break;
  const path=(n.path.value??n.path.text??'').replaceAll('"','').replaceAll('\\','/').replace(/\.galaxy$/iu,'');
  if(path.startsWith('/')||path.includes(':')||path.split('/').some(s=>s==='..'||s===''))throw Error('Unsafe primary custom include');
  const key=path.toLowerCase();
  if(!editor.has(key)&&(names.has(key+'.galaxy')||names.has(key+'_h.galaxy')))chosen.add(n);
 }
 // Native Editor emits this built-in include itself. Keeping it in a
 // CustomScript adds a duplicate include and an empty InitCustomScript stage.
 // Preserve every other authored include and its original order.
 return source.statements.filter(n => chosen.has(n) &&
   String(n.path.value ?? n.path.text ?? '').replaceAll('"','').replaceAll('\\','/').replace(/\.galaxy$/iu,'').toLowerCase() !== 'triggerlibs/natives');
}
