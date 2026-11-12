/** A native FunctionDef describes an existing API. Do not add an ordinary
 * map forward declaration when the supplied RAW native source already owns
 * the exact signature. Model/synthetic declaration sources are NOT admitted.
 */
import {Parser,SyntaxKind} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {printNode} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/0facdb3525fc37a5-script-template.mjs';
const signature=(type,params)=>JSON.stringify([printNode(type),params.map(p=>printNode(p.type))]);
export function importedNativePrototypeIndex(sources=[]){
 const output=new Map(),ambiguous=new Set();
 for(const d of sources){
  if(/GuiNativeActionDeclarations|model|prototypes/iu.test(d.fileName))continue;
  const ast=new Parser().parseFile(d.fileName,d.text);if(ast.parseDiagnostics?.length)continue;
  for(const n of ast.statements){
   if(n.kind!==142||!n.name?.name)continue;
   if(n.body||!n.modifiers?.some(m=>m.kind===SyntaxKind.NativeKeyword)){output.delete(n.name.name);ambiguous.add(n.name.name);continue;}
   const name=n.name.name,value=signature(n.type,[...n.parameters]);if(ambiguous.has(name))continue;
   if(output.has(name)&&output.get(name)!==value){output.delete(name);ambiguous.add(name);}else output.set(name,value);
  }
 }return output;
}
export function importedNativePrototypeMatches(index,name,type,params){
 return index.get(name)===signature(type,params);
}
