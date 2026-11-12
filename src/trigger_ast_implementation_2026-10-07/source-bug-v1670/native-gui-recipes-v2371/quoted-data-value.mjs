const invalidXml = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/u;
/** Native String Value stores semantic data, including authored quote characters.
 * Verified current Editor picker/save/export; do not add delimiters or escapes.
 */
export function quotedDataStringParam(value) {
    if (value.length < 2 || !value.startsWith('"') || !value.endsWith('"') || invalidXml.test(value))
        return undefined;
    for (const character of value) {
        const code = character.codePointAt(0);
        if (code >= 0xd800 && code <= 0xdfff)
            return undefined;
    }
    return { value, valueType: { type: 'string' } };
}
/** Domain encoders receive raw semantic string contents. */
export function editorScalarContents(value) { return value; }
