import {immediateCurrentTriggerAlias} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/caf3709453cf-immediate-current-trigger-alias.mjs';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {declaredCarrier} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d47b1c49befb-galaxy-program-context.js';
import {createGuiCapabilityCatalog} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/bindings/gui-capability-catalog.mjs';
import {resolveBoundStorage} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v452_source_axes_integrated_2026-10-26/graph/c5f4b17e9143-cf7af898d5a8-bound-storage-path.type-aliases.mjs';
const un=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
const ref=e=>({type:e.type,library:e.library,id:e.id});

/** Facts and representation are separate. A correctly bound target path does
 * not prove that the stock GUI has an Action for that target. */
export function createEventRegistrationModel(session) {
  const program=session.program,catalog=createGuiCapabilityCatalog(session.candidates.libraries);
  // Semantic declarations use private AST copies. Register their exact source
  // identities once, so nominal type queries do not fall back to type names.
  for(const source of program.documents.values())program.attachOriginal(source);
  function native(call,ctx) {
    const callee=un(call?.expression);if(call?.kind!==K.CallExpression||callee?.kind!==K.Identifier)return;
    if(program.getBinding(callee).status!=='BOUND')return;
    const declaration=program.declarationAt(callee);if(declaration?.kind!==K.FunctionDeclaration||declaration.body||
      declaration.parameters.length!==call.arguments.length||!(session.sourceNativeApis ? session.sourceNativeApis.declaration(call,ctx?.nativeLibrary?.id) : declaration.modifiers?.some(m=>m.kind===K.NativeKeyword)))return;
    let root=declaration;while(root.parent)root=root.parent;
    const input=program.verifiedInputIdentity(root.fileName);
    return input?.owned===false&&input.contentSha256?declaration:undefined;
  }
  return Object.freeze({catalog,
    registration(call,ctx) {
      const declaration=native(call,ctx);if(!declaration||declaredCarrier(declaration.parameters[0]?.type)!=='trigger')return;
      const event=session.resolveCall(call,ctx,'event');if(event.status!=='RESOLVED'||!event.definition.flags?.includes('Native'))return;
      const expression=un(call.arguments[0]),getter=expression?.kind===K.CallExpression?un(expression.expression):undefined;
      const getDeclaration=getter?.kind===K.Identifier&&getter.name==='TriggerGetCurrent'?native(expression,ctx):undefined;
      const alias=immediateCurrentTriggerAlias(program,call,ctx);
      const current=!!alias||ctx.containingTriggerBody===true&&getDeclaration&&declaredCarrier(getDeclaration.type)==='trigger';
      const target=current?{status:'CURRENT_TRIGGER',source:program.location(expression),...(alias?{aliasProof:alias}:{})}:resolveBoundStorage(program,expression);
      const container=catalog.implicitEventContainer(ctx.nativeLibrary?.id);
      const supported=!!current&&container.status==='RESOLVED'&&session.candidates.libraries.get(ctx.nativeLibrary?.id)===ctx.nativeLibrary;
      return {kind:'BOUND_EVENT_REGISTRATION',event:event.definition,arguments:[...call.arguments].slice(1),target,
        source:program.location(call),representation:supported?'EXISTING_CURRENT_TRIGGER_CONTAINER':'UNPROVEN_EXPLICIT_TARGET_GUI',
        recipe:supported?{event:event.definition,container:container.definition,role:ref(container.roles[0]),arguments:[...call.arguments].slice(1)}:undefined,
        newNative:0,newCustomScript:0,newRuntimeFunctions:0};
    }
  });
}
