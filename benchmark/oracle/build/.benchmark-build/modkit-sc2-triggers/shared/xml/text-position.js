/**
 * Text-offset helpers for locating declarations in SC2 XML sources (catalogs, font styles):
 * line tables, LSP-style positions and `<!-- -->` comment spans.
 */
/** Offsets of the first character of each line (index 0 = line 0). */
export function lineStartOffsets(text) {
    const starts = [0];
    for (let i = 0; i < text.length; i++) {
        if (text.charCodeAt(i) === 10 /* \n */)
            starts.push(i + 1);
    }
    return starts;
}
/** Translate an absolute `index` into `{ line, character }` via a `lineStartOffsets` table. */
export function positionAt(starts, index) {
    // greatest line-start offset <= index
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
        const mid = (lo + hi + 1) >> 1;
        if (starts[mid] <= index)
            lo = mid;
        else
            hi = mid - 1;
    }
    return { line: lo, character: index - starts[lo] };
}
/** Byte spans of `<!-- … -->` comments, in ascending, non-overlapping document order. */
export function commentSpans(text) {
    const spans = [];
    for (const m of text.matchAll(/<!--[\s\S]*?-->/g)) {
        spans.push([m.index, m.index + m[0].length]);
    }
    return spans;
}
/** Whether `index` falls inside any comment span. `spans` must be sorted & non-overlapping
 *  (as produced by `commentSpans`), enabling a binary search. */
export function insideComment(spans, index) {
    let lo = 0;
    let hi = spans.length - 1;
    while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        const [s, e] = spans[mid];
        if (index < s)
            hi = mid - 1;
        else if (index >= e)
            lo = mid + 1;
        else
            return true;
    }
    return false;
}
