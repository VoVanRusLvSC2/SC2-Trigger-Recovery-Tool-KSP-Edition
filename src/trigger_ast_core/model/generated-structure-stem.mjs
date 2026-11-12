// The compiler supplies the namespace prefix. A stem may start with a digit
// when the resulting complete Galaxy identifier is valid.
export function generatedStructureStem(sourceName,prefix){
  if(typeof sourceName!=='string'||typeof prefix!=='string'||!prefix||!sourceName.startsWith(prefix))return;
  const stem=sourceName.slice(prefix.length);
  return stem&&/^[A-Za-z_][A-Za-z_0-9]*$/u.test(prefix+stem)?stem:undefined;
}
