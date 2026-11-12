// Shared SDK source reader; ownership stays in the current conversion.
import {AsyncLocalStorage} from 'node:async_hooks';
import {createConversionSyntaxProgram,parseConversionGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/f17eedfffe2e-conversion-syntax-program.collections.mjs';
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
