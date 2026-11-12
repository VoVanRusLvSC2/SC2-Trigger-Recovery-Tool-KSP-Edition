/**
 * Local placeholder types for the Trigger→Engine lowering.
 *
 * These decouple `to-engine.ts` from the `@modkitx/engine` package, which is
 * referenced across the workspace but is not currently committed to the repo
 * (see sc2-arcade-watcher/modkit#3). The original `Engine*` AST types lived in
 * `@modkitx/engine`'s `src/types.ts`; the lowering only ever used them as
 * `import type`, so these permissive structural shims are enough to keep the
 * code compiling with full behavior intact.
 *
 * When `@modkitx/engine` is restored, replace the imports in `to-engine.ts`
 * with `import type { … } from '@modkitx/engine'` and delete this file.
 */
export {};
