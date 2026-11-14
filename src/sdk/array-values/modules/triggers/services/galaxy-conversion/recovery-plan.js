/** Observations are separate from TriggerData, including on conversion failure. */
export class RecoveryPlan {
    decisions = [];
    closed = false;
    record(decision) { if (this.closed)
        throw new Error('RecoveryPlan closed'); if (!Number.isSafeInteger(decision.start) || !Number.isSafeInteger(decision.end) || decision.start < 0 || decision.end < decision.start)
        throw new Error('Invalid recovery source span'); this.decisions.push(structuredClone(decision)); }
    report() {
        const counts = {};
        for (const d of this.decisions)
            counts[d.classification] = (counts[d.classification] ?? 0) + 1;
        const ranges = new Map();
        for (const d of this.decisions)
            if (d.recoverable) {
                const k = d.sourceFile + '\0' + d.owner;
                const group = ranges.get(k) ?? [];
                group.push([d.start, d.end]);
                ranges.set(k, group);
            }
        let sourceSpanCharacters = 0;
        for (const group of ranges.values()) {
            group.sort((a, b) => a[0] - b[0]);
            let end = -1;
            for (const [a, b] of group) {
                sourceSpanCharacters += Math.max(0, b - Math.max(a, end));
                end = Math.max(end, b);
            }
        }
        return { decisions: structuredClone(this.decisions), counts, recoverableOwnerSpans: sourceSpanCharacters, guiAccepted: false, coverageDenominator: 'Recoverable owner spans; not Galaxy line count', sourceMetadataRecoverableFromGalaxy: false };
    }
    dispose() { this.decisions = []; this.closed = true; }
}
