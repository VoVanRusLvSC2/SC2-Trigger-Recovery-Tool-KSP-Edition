export function isValidNumber(value) {
    if (value === undefined || value === null || value === '')
        return false;
    if (typeof value === 'number')
        return isFinite(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed === '')
            return false;
        const n = Number(trimmed);
        return !isNaN(n) && isFinite(n);
    }
    return false;
}
export function isInteger(value) {
    if (typeof value === 'number')
        return Number.isInteger(value);
    const trimmed = value.trim();
    if (trimmed === '')
        return false;
    const n = Number(trimmed);
    return !isNaN(n) && Number.isInteger(n);
}
export function isNumeric(str) {
    if (typeof str !== 'string')
        return false;
    const trimmed = str.trim();
    if (trimmed === '')
        return false;
    return !isNaN(Number(trimmed)) && isFinite(Number(trimmed));
}
