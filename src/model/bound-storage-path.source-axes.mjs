import {resolveBoundStorage as qualify} from "./bound-storage-path.type-aliases.mjs";
import {boundStorageShape} from "./bound-storage-shape.source-axes.mjs";
import {resolveBoundStructref} from "../types/bound-type-alias.mjs";
import {SyntaxKind as K} from "../sdk/array-values/modules/galaxy/language-core/index.js";
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const fail=reason=>({status:'UNPROVEN',reason,guiBindingAuthorized:false});

// Reuse the existing lexical, readonly, index-carrier and nominal-owner gates.
// Only the access-axis cursor differs from the parser's reversed ArrayType
// chain; no synthetic AST node or unchecked declaration enters the binder.
export function resolveBoundStorage(program,node,options){
 const proved=qualify(program,node,options);if(proved.status!=='BOUND_STORAGE')return proved;
 let base=un(node);const path=[];while([K.PropertyAccessExpression,K.ElementAccessExpression].includes(base?.kind)){path.unshift(base);base=un(base.expression);}
 const shape=type=>{const ref=resolveBoundStructref(program,type);return boundStorageShape(program,ref.status==='RESOLVED_STRUCTREF'?ref.node:type);};
 let cursor=shape(program.declarationAt(base).type),axis=0;const steps=[];
 for(const [position,access]of path.entries()){
  if(cursor.status!=='RESOLVED')return fail(cursor.reason);
  if(access.kind===K.ElementAccessExpression){
   if(axis>=cursor.dimensions.length)return fail('SOURCE_ARRAY_AXIS_NOT_PROVED');
   steps.push({...proved.steps[position],extent:cursor.dimensions[axis++]});
  }else{
   const field=program.declarationAt(access);
   if(axis!==cursor.dimensions.length||field?.parent!==cursor.nominal)return fail('SOURCE_MEMBER_AXIS_OR_OWNER_NOT_PROVED');
   steps.push(proved.steps[position]);cursor=shape(field.type);axis=0;
  }
 }
 if(cursor.status!=='RESOLVED')return fail(cursor.reason);
 const remaining=cursor.dimensions.slice(axis),type=cursor.elementType+remaining.map(n=>'['+n+']').join('');
 return {...proved,steps,type,structure:cursor.nominal?program.location(cursor.nominal):undefined,
  remainingDimensions:remaining,dimensionOrder:'SOURCE_ACCESS'};
}
