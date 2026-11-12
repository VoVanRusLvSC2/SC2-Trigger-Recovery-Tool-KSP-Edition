import assert from 'node:assert/strict';
// Canonical XML adds Condition to boolean value calls. It changes the GUI
// placement role, not the source ABI or invocation. The full ABI/template
// checker still runs after this metadata-only normalization.
export function sourceInlineRoleFlags(definition){
 const flags=new Set([...(definition.flags??[]),...(definition.isFuncAction?['Action']:[]),...(definition.isFuncCall?['Call']:[])]);
 if(flags.has('Condition')){
  assert(definition.returnType?.type==='bool'&&flags.has('Call')&&!flags.has('Action'),'SOURCE_CONDITION_REQUIRES_BOOLEAN_CALL');
  flags.delete('Condition');
 }
 return flags;
}
