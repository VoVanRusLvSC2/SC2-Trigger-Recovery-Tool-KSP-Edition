import { getLogger } from '@modkit/codec-kit';
const resolveLog = getLogger(['blizzard', 'starcraft2', 'mod', 'resolve']);
/**
 * Game-neutral dependency resolver over an ordered collection of mounted sources.
 *
 * Package naming, installation paths, and remote-depot behavior belong to semantic/game codecs;
 * those codecs contribute {@link ResolverSource} instances instead of teaching this class about
 * their formats.
 */
export class ModResolver {
    sources;
    constructor(config = {}) {
        this.sources = config.sources ?? [];
    }
    async resolve(name, onProbe) {
        for (const source of this.sources) {
            const started = Date.now();
            const path = await source.resolve(name);
            const probe = {
                dependency: name,
                source: source.label,
                path,
                hit: path !== undefined,
                ms: Date.now() - started,
            };
            resolveLog.debug(`${probe.hit ? 'hit ' : 'miss'} ${probe.source} -> '${name}'`, {
                ...probe,
            });
            onProbe?.(probe);
            if (path !== undefined)
                return path;
        }
        return undefined;
    }
}
