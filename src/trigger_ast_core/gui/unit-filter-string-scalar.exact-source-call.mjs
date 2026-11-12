import {literalUnitFilterStringScalar as literal} from './unit-filter-string-scalar.typed.mjs';
import {recoverySessionFor} from '../../map_global_repair_v265_attribute_scalar_codec_2026-10-21/graph/4f328c3710a2b421-recovery-session.mjs';
import {resolveDirectSourceGuiCall} from '../bindings/direct-source-gui-call-precedence.mjs';

// A recognized filter spelling can be displayed as a GUI scalar, but that
// scalar emits UnitFilter instead of the original UnitFilterStr call. Prefer
// an exact source/stock binding when the normal, independently audited native
// description policy permits one. No new API implementation or wrapper exists.
export function literalUnitFilterStringScalar(call,context){
  const value=literal(call,context);
  if(value===undefined)return;
  const recovery=context.elements&&recoverySessionFor(context.elements);
  if(!recovery)return value;
  const result=resolveDirectSourceGuiCall(call,context,recovery,'value');
  if(['RESOLVED','AMBIGUOUS'].includes(result.status))return;
  return value;
}
