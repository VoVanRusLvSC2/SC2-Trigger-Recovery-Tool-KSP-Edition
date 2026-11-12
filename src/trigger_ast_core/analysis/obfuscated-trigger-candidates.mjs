import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {declaredTriggerConstructorFrame} from '../model/declared-trigger-constructor-frame.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';

// Candidate discovery only: no name change, GUI ownership or semantic proof.
// Cross-file references, dynamically constructed strings and Editor emission
// remain explicit obligations for any future lowering.
export function analyzeObfuscatedTriggerCandidates(statements) {
 const defs=new Map(),globals=new Map();
 for(const node of statements){
  if(node.kind===K.FunctionDeclaration&&node.body){const list=defs.get(node.name.name)??[];list.push(node);defs.set(node.name.name,list);}
  if(node.kind===K.VariableDeclaration){const list=globals.get(node.name.name)??[];list.push(node);globals.set(node.name.name,list);}
 }
 const roots=defs.get('InitMap')??[];
 const direct=s=>s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression?.kind===K.Identifier&&!s.expression.arguments.length?s.expression.expression.name:undefined;
 if(roots.length!==1||!roots[0].body.statements.length)return {status:'REFUSED',reason:'MAP_ENTRY_NOT_UNIQUE',candidates:[]};
 const stageName=direct(roots[0].body.statements.at(-1)),stages=defs.get(stageName)??[];
 if(stages.length!==1)return {status:'REFUSED',reason:'TRIGGER_STAGE_NOT_UNIQUE',candidates:[]};
 const calls=stages[0].body.statements.map(direct);
 if(calls.some(x=>!x)||new Set(calls).size!==calls.length)return {status:'REFUSED',reason:'STAGE_CALLS_NOT_UNIQUE_DIRECT',candidates:[]};
 const records=[];
 for(const name of calls){
  const constructors=defs.get(name)??[],frame=constructors.length===1?declaredTriggerConstructorFrame(constructors[0]):undefined;
  if(!frame)return {status:'REFUSED',reason:'CONSTRUCTOR_SHAPE_UNRESOLVED',name,candidates:[]};
  const cb=defs.get(frame.callback)??[],handle=globals.get(frame.handle)??[];
  if(cb.length!==1||cb[0].type.kind!==K.BoolKeyword||cb[0].parameters.length!==2||cb[0].parameters.some(p=>p.type.kind!==K.BoolKeyword||p.isReference)||handle.length!==1||handle[0].type.kind!==K.TriggerKeyword)
   return {status:'REFUSED',reason:'CALLBACK_OR_HANDLE_ABI_UNRESOLVED',name,candidates:[]};
  records.push({constructor:name,callback:frame.callback,handle:frame.handle,constructorCalls:[],constructorOther:[],callbackCalls:[],callbackOther:[],callbackStrings:[]});
 }
 if(new Set(records.map(r=>r.callback)).size!==records.length||new Set(records.map(r=>r.handle)).size!==records.length)return {status:'REFUSED',reason:'CALLBACK_OR_HANDLE_NOT_UNIQUE',candidates:[]};
 const constructors=new Map(records.map(r=>[r.constructor,r])),callbacks=new Map(records.map(r=>[r.callback,r]));
 function walk(node,parent,owner){
  if(node.kind===K.Identifier){const ctor=constructors.get(node.name),cb=callbacks.get(node.name);
   if(ctor){const directCall=parent?.kind===K.CallExpression&&parent.expression===node&&!parent.arguments.length;(directCall?ctor.constructorCalls:ctor.constructorOther).push(owner);}
   if(cb){const directCall=parent?.kind===K.CallExpression&&parent.expression===node;(directCall?cb.callbackCalls:cb.callbackOther).push(owner);}}
  if(node.kind===K.StringLiteral){const value=readStringLiteralValue(node.text)?.value,cb=callbacks.get(value);
   if(cb)cb.callbackStrings.push({owner,triggerCreate:parent?.kind===K.CallExpression&&parent.expression?.kind===K.Identifier&&parent.expression.name==='TriggerCreate'});}
  forEachChild(node,child=>walk(child,node,owner));
 }
 for(const node of statements)if(node.kind===K.FunctionDeclaration&&node.body)walk(node.body,node,node.name.name);else if(node.kind===K.VariableDeclaration&&node.initializer)walk(node.initializer,node,'<global>');
 for(const r of records){
  if(r.constructorCalls.length!==1||r.constructorCalls[0]!==stageName||r.constructorOther.length)return {status:'REFUSED',reason:'CONSTRUCTOR_REFERENCE_NOT_ISOLATED',name:r.constructor,candidates:[]};
  if(r.callbackCalls.length||r.callbackOther.length||r.callbackStrings.length!==1||r.callbackStrings[0].owner!==r.constructor||!r.callbackStrings[0].triggerCreate)
   return {status:'REFUSED',reason:'CALLBACK_REFERENCE_NOT_ISOLATED',name:r.callback,candidates:[]};
 }
 return {status:'CANDIDATES_ONLY',stage:stageName,candidates:records.map(({constructor,callback,handle})=>({constructor,callback,handle})),
  obligations:['DEPENDENCY_AND_DYNAMIC_STRING_REFERENCES','GUI_CALLBACK_AND_EVENT_BINDINGS','EDITOR_EMISSION_AND_STARTUP_ORDER'],
  sourceChanged:false,renamingAuthorized:false,wholeMapAccepted:false};
}
