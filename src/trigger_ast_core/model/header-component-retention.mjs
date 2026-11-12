// Apply only complete dependency components present in this frontend unit.
// Cross-unit ordering is not guessed; an incomplete component stays raw.
import assert from 'node:assert/strict';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
export function planHeaderComponentRetention(args,rule,shape){
 const expected=new Map(rule.variables.map(v=>[v.name,v]));
 assert.equal(expected.size,rule.variables.length,'HEADER_RETENTION_DUPLICATE_VARIABLE');
 const groups=rule.componentPlan?.components.filter(c=>c.selected).map(c=>c.names)??[[...expected.keys()]];
 const members=groups.flat();
 assert.equal(new Set(members).size,members.length,'HEADER_RETENTION_COMPONENT_OVERLAP');
 assert.equal(members.length,expected.size,'HEADER_RETENTION_COMPONENT_SET');
 assert(members.every(name=>expected.has(name)),'HEADER_RETENTION_UNKNOWN_COMPONENT_MEMBER');
 const declarations=new Map();
 for(const n of args.statements)if(n.kind===K.VariableDeclaration){
  const list=declarations.get(n.name.name)??[];list.push(n);declarations.set(n.name.name,list);
 }
 const applied=[],blocked=[];let notInThisUnit=0;
 for(const group of groups){
  if(!group.some(name=>declarations.has(name))){notInThisUnit++;continue;}
  const names=new Set(group),ordered=rule.variables.filter(v=>names.has(v.name)),matched=[];
  let refusal;
  for(const v of ordered){
   const ds=declarations.get(v.name)??[];
   if(ds.length!==1){refusal='COMPONENT_DECLARATION_NOT_UNIQUE_OR_MISSING';break;}
   const n=ds[0],ref=args.globalVars.get(v.name),slot=ref&&args.elements[ref.id];
   if(JSON.stringify(shape(n.initializer))!==JSON.stringify(v.initializerShape)||args.getTypeName(n.type)!==v.type){refusal='INITIALIZER_OR_TYPE_CHANGED';break;}
   if(ref?.library!==args.libId||slot?.type!=='Variable'||slot.isArray||slot.isConstant||slot.variableType?.type!==v.type){refusal='PLAIN_GUI_VARIABLE_NOT_PROVED';break;}
   matched.push({name:v.name,node:n,id:ref.id});
  }
  if(!refusal){
   const ids=Object.values(args.elements).filter(v=>matched.some(m=>m.id===v.id)).map(v=>v.id);
   if(JSON.stringify(ids)!==JSON.stringify(matched.map(m=>m.id)))refusal='COMPONENT_GUI_ORDER_CHANGED';
  }
  if(refusal)blocked.push({names:group,reason:refusal});else applied.push(...matched);
 }
 const removed=new Set(applied.map(v=>v.node));
 return {statements:args.statements.filter(n=>!removed.has(n)),proof:{
  kind:'COMPLETE_SOURCE_AND_GUI_HEADER_COMPONENTS_ONLY',applied:applied.map(({name,id})=>({name,id})),blocked,notInThisUnit,
  incompleteComponentsRetained:true,initializerExpressionsUnchanged:true,
  crossUnitOrderAssumed:false,sourceOrCandidateChanged:false,wholeProgramEquivalenceProved:false}};
}
