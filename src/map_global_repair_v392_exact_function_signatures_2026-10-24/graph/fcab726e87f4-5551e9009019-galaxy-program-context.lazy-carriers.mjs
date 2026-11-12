import {GalaxyProgramContext as BindingProgram} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/913bdaf9de58-8ab2cc20737b-galaxy-program-context.binding-mode.mjs';
import {TypeFlags,isPartOfExpression} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
export {declaredCarrier,declarationTypeKey} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/913bdaf9de58-8ab2cc20737b-galaxy-program-context.binding-mode.mjs';

// Binding-only indexing still skips whole-program type checking. A consumer
// that explicitly needs an expression carrier can query the existing checker
// lazily against the same verified AST, without parsing or guessing it again.
export class GalaxyProgramContext extends BindingProgram{
 carrierAt(node){
  this.assertOpen();
  const input=this.originals.get(node),semantic=input&&this.nodes.get(this.key(input.fileName,node));
  if(!semantic||!this.verifiedInputIdentity(input.fileName)||!isPartOfExpression(semantic))return undefined;
  try{
   const type=this.checker.getTypeOfNode(semantic,true);
   if(type.flags&TypeFlags.Unknown)return undefined;
   return type.flags&TypeFlags.Integer?'int':type.flags&TypeFlags.Fixed?'fixed':type.flags&TypeFlags.Boolean?'bool':type.flags&TypeFlags.String?'string':type.getName();
  }catch{return undefined;}
 }
 getBinding(node){
  const binding=super.getBinding(node);
  if(this.bindingOnly&&!Object.hasOwn(binding,'carrier'))Object.defineProperty(binding,'carrier',{get:()=>this.carrierAt(node),enumerable:false});
  return binding;
 }
}
