// Carrier equivalence is a comparison view; the real GUI domain is preserved.
// Typed domains and fixed literals additionally require the actual emitter's
// initializer to match the original source expression.
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
import {planHeaderComponentRetention} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/321af74c50c9-header-component-retention.mjs';
const unparen=shape=>shape?.kind===K.ParenthesizedExpression?unparen(shape.expression):shape;
export function planTypedHeaderRetention(args,rule,shape){
 const elements={...args.elements},checks=[];
 for(const expected of rule.variables){
  const ref=args.globalVars.get(expected.name),slot=ref&&args.elements[ref.id];if(!slot)continue;
  if(slot.variableType?.type===expected.type&&expected.type!=='fixed')continue;
  let evidence;
  try{evidence=args.headerSlotEvidence?.(slot);}catch{}
  const sameInitializer=!!evidence?.initializerShape&&JSON.stringify(unparen(evidence.initializerShape))===JSON.stringify(unparen(expected.initializerShape));
  const proved=evidence?.carrier===expected.type&&sameInitializer;
  elements[slot.id]={...slot,variableType:{type:proved?expected.type:'__UNPROVED_HEADER_CARRIER_OR_VALUE__'}};
  checks.push({name:expected.name,sourceType:expected.type,guiType:slot.variableType,
   carrier:evidence?.carrier,initializerMatched:sameInitializer,proved});
 }
 const result=planHeaderComponentRetention({...args,elements},rule,shape);
 return {...result,proof:{...result.proof,typedSlotChecks:checks,guiDomainsPreserved:true,
  actualGuiElementsMutated:false,initializerValuesRecomputed:false}};
}
