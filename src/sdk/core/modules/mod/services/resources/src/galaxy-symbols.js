// The Galaxy owner supplies parsing and the shared symbol projection. This JS boundary keeps the
// mod codec's narrow TypeScript project from compiling the separate Galaxy project as its source.
import { analyzeGalaxyLanguage, toGalaxySymbolTree, } from '@modkit/blizzard-starcraft2/galaxy/analysis/language-service.js';
export function galaxySymbols(text, path) {
    return toGalaxySymbolTree(analyzeGalaxyLanguage(text, path).symbols);
}
//# sourceMappingURL=galaxy-symbols.js.map