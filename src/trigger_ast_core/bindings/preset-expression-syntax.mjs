import {parseTriggerXmlSync} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/sax-reader.js';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {expressionShape} from './formal-preset-expression.arithmetic.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
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
