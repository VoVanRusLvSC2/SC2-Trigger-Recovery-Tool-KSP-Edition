/**
 * Narrow SC2 rename-transaction values shared by the Data and Layout reference renames.
 *
 * The sc2-mod rename coordinator composes these per-codec transactions. The shapes are
 * structurally the same as codec-kit's section 5.5 edit plan, so the coordinator keeps working
 * while the domain modules no longer import legacy asset DTOs or the legacy error class.
 */
/** Invalid edit/export input or a misuse of a transaction; `code` keeps the historical value. */
export class Sc2EditInputError extends Error {
    name = 'Sc2EditInputError';
    code = 'CONFIG_INVALID';
    context;
    constructor(message, context = {}) {
        super(message);
        this.context = context;
    }
}
