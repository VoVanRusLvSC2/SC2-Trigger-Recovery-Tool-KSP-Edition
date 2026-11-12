import {remainderType} from './numeric-expression-contract.mjs';
// Preserve the actual % operator in typed GUI slots. No ModI substitution.
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {validateComposedGuiExpressionMarkers as validateGuiExpressionMarkers} from './composed-expression-contract.mjs';
const refusals=new WeakMap();
export const typedRemainderRefusals=elements=>refusals.get(elements)??[];
function record(ctx,node,detail){const list=refusals.get(ctx.elements)??[];if(list.length<100)list.push({source:ctx.sourceText?.slice(node.pos,node.end),line:node.line,detail});refusals.set(ctx.elements,list);}
export function typedNumericRemainderExpression(node,ctx,data,api){
 while(node?.kind===K.ParenthesizedExpression)node=node.expression;
 if(node?.kind!==K.BinaryExpression||node.operatorToken?.kind!==K.PercentToken)return;
 const leftType=api.expressionParameterType(node.left,ctx),rightType=api.expressionParameterType(node.right,ctx);
 const type=remainderType(leftType?.type,rightType?.type);
 if(!type||data.valueType&&data.valueType.type!==type){record(ctx,node,{reason:'OPERAND_TYPE',leftType,rightType});return;}
 const refs=[api.structuredParam(node.left,ctx,undefined,leftType.type),api.structuredParam(node.right,ctx,undefined,rightType.type)];
 const children=refs.map(ref=>api.element(ref,ctx));
 if(children.some(p=>!p)||children[0]===children[1])return;
 const old=children.map(p=>({present:Object.hasOwn(p,'expressionCode'),value:p.expressionCode}));
 children[0].expressionCode='left';children[1].expressionCode='right';
 const owner=api.mkParamRef({...data,expressionType:type,expressionText:'(~left~ % ~right~)',expressionParams:refs},ctx);
 const external=new Map(ctx.dependencyLibraries??[]);if(ctx.nativeLibrary)external.set(ctx.nativeLibrary.id,ctx.nativeLibrary);
 const proof=validateGuiExpressionMarkers(new Map([[ctx.libId,{id:ctx.libId,elements:ctx.elements}]]),external);
 if(proof.valid&&proof.expressions.some(p=>p.library===ctx.libId&&p.id===owner.id))return owner;
 record(ctx,node,{reason:'GUI_SLOT_CONTRACT',issues:proof.issues});
 for(let i=0;i<children.length;i++){
  if(old[i].present)children[i].expressionCode=old[i].value;else delete children[i].expressionCode;
 }
 for(const[key,p]of Object.entries(ctx.elements))if(p.type==='Param'&&p.id===owner.id)delete ctx.elements[key];
}
