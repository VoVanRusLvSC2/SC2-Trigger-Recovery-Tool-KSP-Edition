import {parseTriggerXmlSync} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/5cac4ebbb658-5fe36fb85142-923bba4f6513-a593a8020cb0-c0e5b7b5433c-738aa3fd7188-sax-reader.js';
import {parseImmutableGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/7fa3255fd104-immutable-galaxy-syntax.mjs';
import {expressionShape} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/6d0141a0fb9a-formal-preset-expression.arithmetic.mjs';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const skip=new Set(['parent','symbol','locals','flowNode','syntaxTokens']);
const children=node=>Object.entries(node).filter(([key,value])=>!skip.has(key)&&value&&typeof value==='object').flatMap(([,value])=>Array.isArray(value)?value:[value]).filter(value=>value&&typeof value==='object');

/** Retaining syntax is conservative: this index never selects a GUI binding.
 * Actual reconstruction still requires the expected ParamDef's exact domain.
 * The index is owned by this pass and discarded afterwards. */
export function loadedPresetExpressionRoots(ast,inputs){
 const libraries=new Map();
 for(const input of inputs??[]){
  if(input.triggerData)for(const [owner,library]of parseTriggerXmlSync(input.triggerData))libraries.set(owner,library);
  else if(input.elements)libraries.set(input.id,input);
 }
 const definitions=[...libraries.values()].flatMap(library=>Object.values(library.elements??{}));
 const nativeNames=new Set(definitions.filter(e=>e.type==='FunctionDef'&&e.flags?.includes('Native')).map(e=>e.name??e.identifier).filter(Boolean));
 const shapes=new Map();
 for(const [owner,library]of libraries)for(const value of Object.values(library.elements??{})){
  if(value.type!=='PresetValue'||typeof value.value!=='string'||!value.value.includes('('))continue;
  const tree=parseImmutableGalaxySyntax(`void PresetProbe(){${value.value};}`,'preset-expression.galaxy'),body=tree.statements?.[0]?.body?.statements;
  if(tree.parseDiagnostics.length||tree.statements?.length!==1||body?.length!==1||body[0].kind!==K.ExpressionStatement)continue;
  const shape=expressionShape(body[0].expression,name=>nativeNames.has(name));
  if(shape?.[0]!==K.CallExpression)continue;
  const key=JSON.stringify(shape),refs=shapes.get(key)??[];
  refs.push({library:owner,type:'PresetValue',id:value.id});shapes.set(key,refs);
 }
 const nodes=new WeakSet(),evidence=[],pending=[ast];
 while(pending.length){
  const node=pending.pop();
  // Most nodes cannot be complete preset expressions; avoid shaping whole trees.
  const shape=node.kind===K.CallExpression?expressionShape(node,name=>nativeNames.has(name)):undefined;
  const presets=shape&&shapes.get(JSON.stringify(shape));
  if(presets){nodes.add(node);evidence.push({start:node.pos,end:node.end,presets,syntaxRetained:true,bindingProved:false});continue;}
  pending.push(...children(node));
 }
 return {nodes,evidence};
}
