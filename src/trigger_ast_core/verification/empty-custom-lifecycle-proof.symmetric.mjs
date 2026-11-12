import {projectEmptyCustomLifecyclePair as oneWay} from './empty-custom-lifecycle-proof.typed-gui.mjs';

// Equality is symmetric; the existing ownership, dispatch and observer proof is
// unchanged. Remove an empty stock stage from whichever side actually owns it.
export function projectEmptyCustomLifecyclePair(before,after,context={}) {
  const forward=oneWay(before,after,context);
  if(forward.proof.applied)return {...forward,proof:{...forward.proof,projectedSide:'source'}};
  const reverse=oneWay(after,before,context);
  if(!reverse.proof.applied)return {...forward,proof:{...forward.proof,reverseRefusal:reverse.proof.reason}};
  return {before:reverse.after,after:reverse.before,proof:{...reverse.proof,projectedSide:'candidate'}};
}
