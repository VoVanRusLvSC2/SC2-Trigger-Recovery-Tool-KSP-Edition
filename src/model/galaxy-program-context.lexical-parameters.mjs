import {GalaxyProgramContext as Base} from "./galaxy-program-context.lazy-carriers.mjs";
import {indexSourceFunctionDeclarations} from "./source-function-declarations.mjs";
import {SyntaxKind as K,TypeFlags,isPartOfExpression} from "../sdk/array-values/modules/galaxy/language-core/index.js";
export {declaredCarrier,declarationTypeKey} from "./galaxy-program-context.lazy-carriers.mjs";

// The inherited binder merges a prototype's parameter members with its body.
// Resolve a body reference to that body's actual parameter/local declaration,
// while retaining the existing refusal for a name absent from the body scope.
export class GalaxyProgramContext extends Base{
 sourceFunctionGroups;
 lexicalDeclaration(node){
  this.assertOpen();const input=this.originals.get(node),semantic=input&&this.nodes.get(this.key(input.fileName,node));
  const declarationName=semantic?.parent?.name===semantic&&[K.ParameterDeclaration,K.VariableDeclaration].includes(semantic.parent.kind);
  if(semantic?.kind!==K.Identifier||!isPartOfExpression(semantic)&&!declarationName||
   semantic.parent?.kind===K.PropertyAccessExpression&&semantic.parent.name===semantic)return;
  let fn=semantic.parent;while(fn&&fn.kind!==K.FunctionDeclaration)fn=fn.parent;
  if(!fn?.body||fn.name===semantic||this.conflicts.has(fn.name.name))return;
  const own=this.functionLocals.get(fn)?.get(semantic.name);if(!own)return;
  const symbol=this.checker.getSymbolAtLocation(semantic);
  if(!symbol?.declarations.some(d=>d.kind===K.ParameterDeclaration&&d.parent?.kind===K.FunctionDeclaration&&d.parent.name.name===fn.name.name))return;
  this.sourceFunctionGroups??=indexSourceFunctionDeclarations(this.documents);
  const group=this.sourceFunctionGroups.get(fn.name.name);
  if(group?.status!=='UNIQUE_BODY_AND_COMPATIBLE_PROTOTYPES'||group.body.node!==fn)return;
  return own;
 }
 declarationAt(node){return this.lexicalDeclaration(node)??super.declarationAt(node);}
 carrierAt(node){
  const declaration=this.lexicalDeclaration(node);if(!declaration)return super.carrierAt(node);
  try{const type=this.checker.getTypeFromTypeNode(declaration.type);if(type.flags&TypeFlags.Unknown)return;
   return type.flags&TypeFlags.Integer?'int':type.flags&TypeFlags.Fixed?'fixed':type.flags&TypeFlags.Boolean?'bool':type.flags&TypeFlags.String?'string':type.getName();
  }catch{return;}
 }
 getBinding(node){
  const prior=super.getBinding(node),declaration=this.lexicalDeclaration(node);if(!declaration)return prior;
  let root=declaration;while(root.parent)root=root.parent;
  const input=this.inputs.get(root.fileName);if(!this.verifiedInputIdentity(root.fileName))return prior;
  const id=`${input.sourceId}|${input.contentSha256}|${root.fileName}|${declaration.pos}:${declaration.end}:${declaration.kind}`;
  const result={...prior,status:'BOUND',declarations:[id],symbolId:id,lexicalOwnerCorrected:true};
  delete result.type;Object.defineProperty(result,'carrier',{get:()=>this.carrierAt(node),enumerable:false});
  this.annotations.set(node,result);return result;
 }
 dispose(){this.sourceFunctionGroups=undefined;super.dispose();}
}
