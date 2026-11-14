import { deferLocalRetirement } from '../model/deferred-local-retirement.linear.mjs';

// Source occurrence counts permit unbinding only. A preserved GUI snapshot may
// still be referenced by a committed parameter, so final graph use decides removal.
export function deferredScaffoldingCleanup(nodes, ctx, scoped, symbolIndex) {
  const pending = new Map();
  return {
    stage(names) {
      for (const name of names) {
        const id = scoped.localVarByGalaxyName.get(name);
        if (id) pending.set(name, id);
      }
    },
    finish() {
      const whole = symbolIndex(ctx.structuredFunctionStatements ?? nodes),
        local = symbolIndex(nodes);
      for (const [name, id] of pending) {
        if (
          whole.uses.get(name) !== local.uses.get(name) ||
          ctx.localVarByGalaxyName.get(name) !== id
        )
          continue;
        deferLocalRetirement(id, ctx);
        scoped.localVarByGalaxyName.delete(name);
        ctx.localVarByGalaxyName.delete(name);
      }
    },
  };
}
