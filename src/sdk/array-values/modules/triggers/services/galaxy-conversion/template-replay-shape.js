/** Compare statement replay while treating standalone semicolons as no-ops.
 * The existing syntax shaper supplies a fresh copy; caller ASTs are never edited.
 * Only statement arrays are filtered. Conditions, expressions, return/break/
 * continue and an empty statement used as a control-flow body remain intact.
 */
export function templateReplayShape(node, syntaxShape) {
    const copy = syntaxShape(node);
    if (Array.isArray(copy))
        for (let i = copy.length - 1; i >= 0; i--)
            if (copy[i]?.kind === 139)
                copy.splice(i, 1);
    const pending = [copy];
    while (pending.length) {
        const item = pending.pop();
        if (!item || typeof item !== 'object')
            continue;
        if (Array.isArray(item)) {
            for (const child of item)
                pending.push(child);
            continue;
        }
        if (item.kind === 128 && Array.isArray(item.statements))
            item.statements = item.statements.filter((n) => n?.kind !== 139);
        for (const child of Object.values(item))
            if (child && typeof child === 'object')
                pending.push(child);
    }
    return copy;
}
