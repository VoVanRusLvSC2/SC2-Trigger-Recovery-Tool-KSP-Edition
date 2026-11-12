// Shared SDK source reader; ownership stays in the current conversion.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createConversionSyntaxProgram,parseConversionGalaxySyntax} from "./conversion-syntax-program.collections.mjs";
const localSyntax = new AsyncLocalStorage();
// Forward conversion also has a bounded, disposable syntax owner. A reverse
// conversion's existing syntax owner takes precedence, preserving node identity.
export function withSdkDeclarationSyntax(operation, report) {
  if(localSyntax.getStore()) return operation();
  const program=createConversionSyntaxProgram();
  try {return localSyntax.run(program,operation);}
  finally {const evidence=program.evidence();program.dispose();report?.(evidence);}
}
export function readSdkDeclaration(text,fileName='declarations.galaxy') {
  return parseConversionGalaxySyntax(text,fileName,()=>withSdkDeclarationSyntax(()=>localSyntax.getStore().parse(text,fileName)));
}
