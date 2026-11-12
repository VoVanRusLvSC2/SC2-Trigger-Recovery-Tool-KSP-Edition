import {createEventRegistrationModel} from '../model/event-registration-model.current-aliases.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
// Weak keys are the existing per-conversion semantic sessions. This index is
// never shared by maps or persisted between runs.
const models=new WeakMap();
export function currentTriggerEventRecipe(call,ctx,session) {
  if(!session||ctx.containingTriggerBody!==true)return;
  if(call?.kind!==K.CallExpression)return;
  let target=call.arguments[0];while(target?.kind===K.ParenthesizedExpression)target=target.expression;
  let getter=target?.expression;while(getter?.kind===K.ParenthesizedExpression)getter=getter.expression;
  if(target?.kind!==K.Identifier&&(target?.kind!==K.CallExpression||target.arguments.length||getter?.kind!==K.Identifier||getter.name!=='TriggerGetCurrent'))return;
  let model=models.get(session);if(!model){model=createEventRegistrationModel(session);models.set(session,model);}
  return model.registration(call,ctx)?.recipe;
}
export function lowerCurrentTriggerEvent(call,ctx,session,{mkFCRef,structuredParam}) {
  const recipe=currentTriggerEventRecipe(call,ctx,session);if(!recipe)return;
  const ref=e=>({type:e.type,library:e.library,id:e.id});
  const child=mkFCRef({functionDef:ref(recipe.event),subFunctionType:recipe.role,
    parameters:recipe.arguments.map((arg,i)=>structuredParam(arg,ctx,recipe.event.parameters[i]))},ctx);
  return {functionDef:ref(recipe.container),parameters:[],subFunctions:[child]};
}
