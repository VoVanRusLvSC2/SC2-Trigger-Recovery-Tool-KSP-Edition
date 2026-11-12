import { writeDocumentInfo } from './core/document-info.js';
const encoder = new TextEncoder();
export function buildSc2DocumentInfoDependencies(dependencies) {
    if (!Array.isArray(dependencies) || dependencies.some((value) => typeof value !== 'string')) {
        throw new TypeError('DocumentInfo dependencies must be an ordered string array');
    }
    return {
        root: {
            name: 'DocInfo',
            values: [],
            children: [{
                    name: 'Dependencies',
                    values: [],
                    children: dependencies.map(value => ({ name: 'Value', values: [value], children: [] })),
                }],
        },
    };
}
export function writeSc2DocumentInfoDependencies(dependencies) {
    return encoder.encode(writeDocumentInfo(buildSc2DocumentInfoDependencies(dependencies)));
}
//# sourceMappingURL=dependencies.js.map