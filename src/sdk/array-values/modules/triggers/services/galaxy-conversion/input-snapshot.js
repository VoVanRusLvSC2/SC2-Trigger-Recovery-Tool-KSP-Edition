/** Track the existing embedded-library split as a derived source view. Never
 * reuse the whole-map content hash for the reduced map or a library fragment.
 */
export function deriveProgramSnapshot(parent, wholeMap, script, libraryId, declarations, hashText) {
    if (!parent || !hashText)
        return undefined;
    const root = parent.files.find(f => f.sourceId === 'owned:script' || f.owned && f.fileName.endsWith('Map.galaxy'));
    if (!root?.contentSha256 || hashText(wholeMap) !== root.contentSha256)
        throw new Error('Original map content SHA failed before embedded split');
    const files = [{ fileName: `Lib${libraryId}.galaxy`, text: script, sourceId: `derived:${root.sourceId}:${libraryId}`, owned: true, contentSha256: hashText(script) }, { fileName: `Lib${libraryId}_h.galaxy`, text: '', sourceId: `derived-header:${root.sourceId}:${libraryId}`, owned: true, contentSha256: hashText('') }];
    for (const d of declarations) {
        const original = parent.files.find(f => f.fileName === d.fileName && f.contentSha256 === hashText(d.text));
        files.push(original ? { ...original } : { ...d, sourceId: `derived-declaration:${root.sourceId}:${d.fileName}`, contentSha256: hashText(d.text), owned: false });
    }
    return { ...parent, files, derivation: { kind: 'EXISTING_EMBEDDED_LIBRARY_SPLIT', parentSourceId: root.sourceId, parentContentSha256: root.contentSha256, libraryId, derivedScriptSha256: hashText(script) } };
}
