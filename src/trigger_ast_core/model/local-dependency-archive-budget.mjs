import assert from 'node:assert/strict';
import {LocalDependencySources} from '../../map_local_dependencies_2026-10-04/local_dependency_sources.mjs';
import {Sc2FolderSource} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-private-switch-v26-2026-10-04/dist/modules/game/battlenet/content-sources/local-files.js';
import {BudgetedLocalArchives,archiveReadBudget} from './budgeted-local-archives.mjs';

export async function createBudgetedLocalDependencySources(options,budget) {
  const checked=archiveReadBudget(budget),sources=new LocalDependencySources(options);
  assert(sources.locals instanceof Map,'Actual folder-source inventory unavailable');
  // Called before any mount. Change only configured physical mod readers; the
  // existing confinement, identity mapping, entry bounds and CASC are retained.
  for(const [id,source] of sources.locals) {
    if(!/^local:mods:\d+$/u.test(id))continue;
    assert(source instanceof Sc2FolderSource,'Configured mod source is not a local folder');
    await source.archives.dispose();source.archives=new BudgetedLocalArchives(checked);
  }
  return sources;
}
