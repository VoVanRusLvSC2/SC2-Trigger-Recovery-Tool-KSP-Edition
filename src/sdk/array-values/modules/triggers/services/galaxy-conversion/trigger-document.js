import { parseTriggerXmlSync, readTriggerLibrariesFast } from '../../../../../../ast/authored-xml-parser.mjs';
import { serializeTriggerLibrary } from '../../../../../../ast/authored-xml-writer.mjs';
import { xmlTree } from '../../shared/trigger-document/lossless-xml.js';
/** Keep the author's original XML/CST beside the model. A reconstructed model
 * without that source is explicitly canonical, never described as lossless.
 */
export class TriggerDocument {
    raw;
    cst;
    libraries;
    constructor(raw, libraries) { this.raw = raw; this.cst = xmlTree(raw); this.libraries = libraries; }
    static async read(raw, triggerStrings) {
        const xml = parseTriggerXmlSync(raw), strings = new Map([...xml.keys()].map(id => [id, triggerStrings ?? '']));
        const libraries = await readTriggerLibrariesFast([xml], strings);
        return new TriggerDocument(raw, new Map([...libraries].map(([id, r]) => [id, r.library])));
    }
    writeLibrary(id) { const library = this.libraries.get(id); if (!library)
        throw new Error('Unknown authored library ' + id); return serializeTriggerLibrary(library); }
    editLeaf(libraryId, type, id, tag, value) {
        if (!['Identifier', 'Value', 'ScriptCode', 'ExpressionCode'].includes(tag))
            throw new Error('Unsupported surgical XML leaf');
        const found = [];
        const walk = (node) => { if (node.tag === 'Element' && node.attributes.Type === type && node.attributes.Id === id && (node.scope ?? 'Map') === libraryId)
            found.push(node); node.children.forEach(walk); };
        walk(this.cst);
        if (found.length !== 1)
            throw new Error('Surgical edit requires one exact authored owner');
        const children = found[0].children.filter((c) => c.tag === tag);
        if (children.length !== 1 || children[0].children.length || children[0].selfClosing)
            throw new Error('Surgical edit requires one existing scalar leaf');
        const leaf = children[0], escaped = value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
        const text = this.raw.slice(0, leaf.openEnd) + escaped + this.raw.slice(leaf.closeStart);
        parseTriggerXmlSync(text);
        return { text, proof: { owner: { library: libraryId, type, id }, tag, originalSpan: { start: leaf.openEnd, end: leaf.closeStart }, outsideBytesUnchanged: true, sourceMetadataPreserved: true, requiresNewLogicAndEditorCheck: true } };
    }
    validateReferences(externals = new Map()) {
        const issues = [];
        const all = new Map([...externals, ...this.libraries]);
        for (const [owner, library] of this.libraries)
            for (const element of Object.values(library.elements)) {
                const visit = (value, field) => {
                    if (!value || typeof value !== 'object')
                        return;
                    if (Array.isArray(value)) {
                        value.forEach(x => visit(x, field));
                        return;
                    }
                    if (value.id && value.type && value !== element && ['functionDef', 'parameterDef', 'variable', 'preset', 'typeElement', 'functionCall', 'subFunctionType', 'structMember'].includes(field ?? '')) {
                        const target = all.get(value.library ?? owner);
                        if (!target?.elementsByType?.[value.type]?.[value.id] && !target?.elements?.[value.id])
                            issues.push({ owner: element.id, field, reference: { ...value }, reason: 'UNRESOLVED_XML_REFERENCE' });
                    }
                    for (const [k, v] of Object.entries(value))
                        if (!['xmlSource', 'rawXml', 'parent'].includes(k))
                            visit(v, k);
                };
                visit(element);
            }
        return { valid: issues.length === 0, issues, losslessSourceRetained: true, guiAccepted: false };
    }
}
