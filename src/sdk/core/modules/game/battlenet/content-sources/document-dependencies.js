const BNET = 'bnet:';
/** Read the `bnet:` dependencies out of a `DocumentHeader`, in the order the document lists them. */
export function readDeclaredDependencies(documentHeader) {
    const text = Buffer.from(documentHeader);
    const found = [];
    let at = 0;
    while ((at = text.indexOf(BNET, at)) >= 0) {
        const end = text.indexOf(0, at);
        if (end < 0)
            break;
        const entry = text.subarray(at, end).toString('utf8');
        at = end + 1;
        if (entry.length > 512)
            continue;
        const [reference = '', ...rest] = entry.split(',');
        const slash = reference.indexOf('/', BNET.length);
        const name = slash < 0 ? reference.slice(BNET.length) : reference.slice(BNET.length, slash);
        if (!name)
            continue;
        const file = rest.find(item => item.startsWith('file:'))?.slice('file:'.length);
        found.push(Object.freeze({
            name,
            version: slash < 0 ? '' : reference.slice(slash + 1),
            ...(file === undefined ? {} : { file }),
        }));
    }
    return Object.freeze(found);
}
//# sourceMappingURL=document-dependencies.js.map