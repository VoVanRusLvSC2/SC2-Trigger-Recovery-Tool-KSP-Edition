/**
 * `sc2-triggers` structural detection.
 *
 * The extension is close to useless here — SC2 mods store the trigger document as a bare
 * `Triggers` file with no extension, and `.xml` is claimed by a dozen unrelated formats — so this
 * detector leans almost entirely on the structural probe, exactly as pipeline rule 1 requires
 * ("a filename extension only selects candidates; it never proves a format").
 *
 * The markers are the element names `@modkitx/triggers`' own SAX reader consumes
 * (`TriggerData` -> `Library` -> `Root`/`Element`), so detection and loading cannot disagree about
 * what a Trigger XML document looks like.
 */
import { uint64 } from '@modkit/core';
import { SC2_GAME_ID, SC2_TRIGGERS_BARE_NAMES, SC2_TRIGGERS_EXTENSIONS, } from '../../../shared/scripts/identity.js';
const SC2_TRIGGERS_CODEC_ID = 'blizzard/sc2-triggers';
/** A trigger document is always one addressable payload. */
export const SC2_TRIGGERS_SOURCE_KINDS = ['file', 'archive-entry'];
/** Head budget for the structural sniff. Enough for the XML prolog plus the first elements. */
export const MAX_SNIFF_BYTES = 32 * 1024;
const XML_PROLOG_RE = /^\s*(?:\uFEFF)?<\?xml\b/;
const TRIGGER_DATA_RE = /<TriggerData\b/;
const LIBRARY_RE = /<Library\b[^>]*\bId\s*=/;
const ROOT_RE = /<Root\b/;
const ELEMENT_RE = /<Element\b[^>]*\bType\s*=/;
/** Any other XML root element proves this is not a trigger document. */
const FOREIGN_ROOT_RE = /<\s*(?:Catalog|Desc|CFrame|DocInfo|Assets|StringTable)\b/;
function looksBinary(bytes) {
    const limit = Math.min(bytes.length, 1024);
    for (let i = 0; i < limit; i++)
        if (bytes[i] === 0)
            return true;
    return false;
}
function clamp(value) {
    return Math.max(0, Math.min(0.98, Number(value.toFixed(4))));
}
/**
 * Bounded structural detection of an SC2 Trigger XML document.
 *
 * Confidence composition:
 *
 * - a recognized extension or the bare `Triggers` document name: +0.1 (`extension`/`path`
 *   evidence — candidate selection only, deliberately weak);
 * - `<?xml` prolog: +0.05 (`magic`);
 * - `<TriggerData>` root: +0.4, `<Library Id=...>`: +0.25, `<Root>`: +0.1,
 *   `<Element Type=...>`: +0.1 (`structure`);
 * - declared StarCraft II context: +0.05 (`context`, never sufficient alone);
 * - XML whose root is another known SC2 document (Catalog, Desc, layout, ...), or a payload with
 *   no `<TriggerData>` at all, emits negative `structure` evidence — which
 *   `rankDetectionCandidates` treats as an outright rejection even when `.xml` matched.
 */
export function detectTriggerBytes(header, options = {}) {
    options.signal?.throwIfAborted();
    const evidence = [];
    let confidence = 0;
    const uri = options.uri ?? '';
    const name = uri.replaceAll('\\', '/').split('/').at(-1) ?? '';
    const extension = name.match(/(\.[^.]+)$/u)?.[1] ?? '';
    const range = { byteOffset: uint64(0n), byteLength: uint64(BigInt(header.byteLength)) };
    const lowerExtension = extension.toLowerCase();
    const bareName = name.toLowerCase();
    if (SC2_TRIGGERS_EXTENSIONS.includes(lowerExtension)) {
        evidence.push({ kind: 'extension', weight: 0.1, note: `extension ${lowerExtension}` });
        confidence += 0.1;
    }
    else if (lowerExtension === '' && SC2_TRIGGERS_BARE_NAMES.includes(bareName)) {
        // SC2's own layout: `<Mod>.SC2Mod/Triggers`, no extension at all.
        evidence.push({ kind: 'extension', weight: 0.1, note: `extension-less SC2 document name '${name}'` });
        confidence += 0.1;
    }
    if (options.gameId === SC2_GAME_ID) {
        evidence.push({ kind: 'context', weight: 0.05, note: `declared game ${SC2_GAME_ID}` });
        confidence += 0.05;
    }
    if (looksBinary(header)) {
        return {
            codecId: SC2_TRIGGERS_CODEC_ID,
            confidence: 0,
            evidence: [
                ...evidence,
                {
                    kind: 'magic',
                    weight: -1,
                    note: 'NUL byte in head; not an XML source',
                },
            ],
            requiredRanges: [range],
        };
    }
    const head = new TextDecoder('utf-8', { fatal: false }).decode(header);
    if (XML_PROLOG_RE.test(head)) {
        evidence.push({ kind: 'magic', weight: 0.05, note: 'XML prolog' });
        confidence += 0.05;
    }
    if (!TRIGGER_DATA_RE.test(head)) {
        const detail = FOREIGN_ROOT_RE.test(head)
            ? 'XML root is another SC2 document type, not TriggerData'
            : 'no <TriggerData> element in the document head';
        return {
            codecId: SC2_TRIGGERS_CODEC_ID,
            confidence: 0,
            evidence: [...evidence, { kind: 'structure', weight: -1, note: detail }],
            requiredRanges: [range],
        };
    }
    evidence.push({ kind: 'structure', weight: 0.4, note: 'root element TriggerData' });
    confidence += 0.4;
    if (LIBRARY_RE.test(head)) {
        evidence.push({ kind: 'structure', weight: 0.25, note: 'Library element with an Id attribute' });
        confidence += 0.25;
    }
    if (ROOT_RE.test(head)) {
        evidence.push({ kind: 'structure', weight: 0.1, note: 'Root section' });
        confidence += 0.1;
    }
    if (ELEMENT_RE.test(head)) {
        evidence.push({ kind: 'structure', weight: 0.1, note: 'Element with a Type attribute' });
        confidence += 0.1;
    }
    return {
        codecId: SC2_TRIGGERS_CODEC_ID,
        confidence: clamp(confidence),
        evidence,
        requiredRanges: [range],
    };
}
/** Read only the bounded prefix allowed by this detector from an MK3 byte source. */
export async function detectTriggerSource(source, options = {}) {
    options.signal?.throwIfAborted();
    const length = source.size === undefined
        ? MAX_SNIFF_BYTES
        : Number(source.size < BigInt(MAX_SNIFF_BYTES) ? source.size : BigInt(MAX_SNIFF_BYTES));
    const header = await source.read(0n, length, options.signal);
    if (header.byteLength > length)
        throw new RangeError('TriggerData source returned bytes beyond the requested probe range');
    return detectTriggerBytes(header, { ...options, uri: source.ref.uri });
}
