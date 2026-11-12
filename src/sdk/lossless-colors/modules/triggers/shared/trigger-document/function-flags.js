/**
 * Return the XML flag set represented by a FunctionDef.
 *
 * Function flags belong to the TriggerData document model: both XML serialization and Galaxy
 * conversion need this normalization, but neither owns it. Preserve authored flags while adding
 * the structured aliases exposed by the reader.
 */
export function functionFlags(definition) {
    return [...new Set([
            ...(definition.flags ?? []),
            ...(definition.isFuncAction ? ['Action'] : []),
            ...(definition.isFuncCall ? ['Call'] : []),
            ...(definition.isSubFunction ? ['SubFunctions'] : []),
        ])];
}
//# sourceMappingURL=function-flags.js.map