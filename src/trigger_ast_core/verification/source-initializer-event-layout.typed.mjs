import assert from 'node:assert/strict';
import {planSourceEntryStartup,readSourceEntryStartup} from '../model/source-entry-startup-plan.mjs';
import {proveSourceInitializerWeaveLifetimes} from '../model/source-initializer-weave-lifetimes.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

/** Source-derived placement only; the typed verifier separately proves every
 * operator in ENTRY_SUFFIX. Placement never authorizes the operator itself. */
export function sourceInitializerEventLayout({program,groups,library,rows,fresh,resolve}){
 assert.equal(library,'Map','INITIALIZER_GUI_BOUND_MAP_ENTRY_REQUIRED');
 const root=groups.get('InitMap')?.body?.node;assert(root,'INITIALIZER_GUI_SOURCE_ENTRY_REQUIRED');
 const fileName=program.location(root).sourceFile,automaticNames=rows.map(r=>r.name);
 const planned=planSourceEntryStartup({program,fileName,automaticConstructors:automaticNames});
 const schedule=readSourceEntryStartup(planned.capability,program),phase=groups.get(schedule.phaseName)?.body;
 assert(phase,'INITIALIZER_GUI_SOURCE_PHASE_REQUIRED');
 const lifetime=proveSourceInitializerWeaveLifetimes({program,fileName:phase.fileName,phaseName:schedule.phaseName,automaticNames}).proof;
 const macroIds=new Set(fresh.filter(r=>r.library===library).map(r=>r.definition.id)),layouts=new Map();
 for(const row of rows){
  const regions=[],slot=lifetime.changedConstructors.find(c=>c.name===row.name);
  if(slot?.manualCalls.length)regions.push({kind:'PHASE_CALLS',calls:slot.manualCalls});
  if(row.name===automaticNames.at(-1)&&schedule.suffix.length){
   const statements=root.body.statements.slice(schedule.sourcePhaseAnchor+1);
   const calls=statements.flatMap(s=>s.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&
    s.expression.expression.kind===K.Identifier&&!s.expression.arguments.length?
    [{name:s.expression.expression.name,source:program.location(s.expression)}]:[]);
   regions.push({kind:'ENTRY_SUFFIX',calls,statements});
  }
  const events=row.trigger.events??[],macros=[];
  for(const [ordinal,r]of events.entries()){
   const call=resolve(r,library,'FunctionCall'),definition=resolve(call.functionDef,library,'FunctionDef');
   if(definition.library===library&&macroIds.has(definition.id))macros.push({ordinal,call,definition});
  }
  assert.equal(macros.length,regions.length,'INITIALIZER_GUI_SOURCE_REGION_MULTIPLICITY');
  assert(macros.every((e,i)=>e.ordinal===events.length-macros.length+i),'INITIALIZER_GUI_ADAPTER_NOT_LAST_EVENT');
  layouts.set(row.trigger.id,{phase:phase.node,fileName:phase.fileName,lifetime,schedule,regions,macros});
 }
 return layouts;
}
