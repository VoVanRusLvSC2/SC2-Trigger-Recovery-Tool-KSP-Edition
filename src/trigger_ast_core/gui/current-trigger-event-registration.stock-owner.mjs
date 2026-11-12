// A native Event is not an ordinary Action. Reuse the loaded event container
// only when the source explicitly targets the current trigger in its callback.
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {declaredCarrier} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/galaxy-program-context.js';

const unwrap = node => { while (node?.kind === K.ParenthesizedExpression) node = node.expression; return node; };
const ref = element => ({type: element.type, library: element.library, id: element.id});

function verifiedNative(call, session) {
  const callee = unwrap(call?.expression);
  if (call?.kind !== K.CallExpression || callee?.kind !== K.Identifier) return false;
  const program = session.program, declaration = program.declarationAt(callee);
  if (program.getBinding(callee).status !== 'BOUND' || declaration?.body ||
      !declaration?.modifiers?.some(m => m.kind === K.NativeKeyword)) return false;
  let source = declaration;
  while (source.parent) source = source.parent;
  const identity = program.verifiedInputIdentity(source.fileName);
  return identity?.owned === false && !!identity.contentSha256;
}

export function currentTriggerEventRecipe(call, ctx, session) {
  if (!session || ctx.containingTriggerBody !== true || !verifiedNative(call, session)) return;
  const target = unwrap(call.arguments[0]), callee = unwrap(target?.expression);
  if (target?.kind !== K.CallExpression || target.arguments.length ||
      callee?.kind !== K.Identifier || callee.name !== 'TriggerGetCurrent' || !verifiedNative(target, session)) return;
  const getter = session.program.declarationAt(callee);
  if (declaredCarrier(getter.type) !== 'trigger' || getter.parameters.length) return;
  const event = session.resolveCall(call, ctx, 'event');
  if (event.status !== 'RESOLVED' || !event.definition.flags?.includes('Native')) return;
  const candidates = [];
  for (const library of session.candidates.libraries.values()) {
    if (library !== ctx.nativeLibrary) continue;
    for (const definition of Object.values(library.elementsByType?.FunctionDef ?? {})) {
      if (!definition.flags?.includes('Action') || !definition.flags.includes('SubFunctions') || definition.flags.includes('Native') ||
          definition.disabled || definition.scriptCode || definition.actions?.length || definition.localVariables?.length || definition.parameters?.length ||
          definition.returnType && definition.returnType.type !== 'void' ||
          definition.subFunctionTypes?.length !== 1) continue;
      const roleRef = definition.subFunctionTypes[0];
      const role = session.candidates.libraries.get(roleRef.library ?? library.id)?.elementsByType?.SubFuncType?.[roleRef.id];
      if (role?.isEvent === true) candidates.push({container: definition, role});
    }
  }
  // Two equally valid definitions require an explicit library choice.
  if (candidates.length !== 1) return;
  const {container, role} = candidates[0];
  return {event: event.definition, container, role: ref(role), arguments: [...call.arguments].slice(1)};
}

export function lowerCurrentTriggerEvent(call, ctx, session, {mkFCRef, structuredParam}) {
  const recipe = currentTriggerEventRecipe(call, ctx, session);
  if (!recipe) return;
  const child = mkFCRef({functionDef: ref(recipe.event), subFunctionType: recipe.role,
    parameters: recipe.arguments.map((arg, i) => structuredParam(arg, ctx, recipe.event.parameters[i]))}, ctx);
  return {functionDef: ref(recipe.container), parameters: [], subFunctions: [child]};
}
