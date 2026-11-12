import { parseXmlElements } from "../../../shared/inspection/structured-text.js";
function attribute(source, name) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&');
    const match = new RegExp(`\\b${escaped}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'iu').exec(source);
    return match?.[1] ?? match?.[2];
}
export function decodeXmlValue(value) {
    return value
        .replace(/&quot;/gu, '"')
        .replace(/&apos;/gu, "'")
        .replace(/&lt;/gu, '<')
        .replace(/&gt;/gu, '>')
        .replace(/&#(?:x([0-9a-f]+)|(\d+));/giu, (match, hexadecimal, decimal) => {
        const codePoint = Number.parseInt(hexadecimal ?? decimal, hexadecimal === undefined ? 10 : 16);
        return Number.isSafeInteger(codePoint) && codePoint <= 0x10ffff
            ? String.fromCodePoint(codePoint)
            : match;
    })
        .replace(/&amp;/gu, '&');
}
export function coerceSc2BankValue(value) {
    if (value.type === 'int' && /^[-+]?\d+$/u.test(value.value)) {
        const integer = Number(value.value);
        if (Number.isSafeInteger(integer))
            return integer;
    }
    if (value.type === 'fixed') {
        const fixed = Number(value.value);
        if (Number.isFinite(fixed))
            return fixed;
    }
    if (value.type === 'flag') {
        const normalized = value.value.toLowerCase();
        if (normalized === '1' || normalized === 'true')
            return true;
        if (normalized === '0' || normalized === 'false')
            return false;
    }
    if (value.type === 'point') {
        const parts = value.value.split(',');
        if (parts.length === 2) {
            const x = Number(parts[0]);
            const y = Number(parts[1]);
            if (Number.isFinite(x) && Number.isFinite(y))
                return Object.freeze({ x, y });
        }
    }
    return value.value;
}
function attributes(source) {
    const values = {};
    for (const match of source.matchAll(/([A-Za-z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/gu)) {
        values[match[1]] = decodeXmlValue(match[2] ?? match[3] ?? '');
    }
    return Object.freeze(values);
}
/** Parse one authored SC2Bank without normalizing or mutating its source text. */
export function parseSc2Bank(text, budget) {
    const elements = parseXmlElements(text, budget, 'Bank', 'SC2 bank');
    const root = /<Bank\b([^>]*)>/iu.exec(text);
    const sections = [];
    for (const sectionMatch of text.matchAll(/<Section\b([^>]*)>([\s\S]*?)<\/Section\s*>/giu)) {
        const sectionAttributes = attributes(sectionMatch[1]);
        const keys = [];
        for (const keyMatch of sectionMatch[2].matchAll(/<Key\b([^>]*)>([\s\S]*?)<\/Key\s*>/giu)) {
            const keyAttributes = attributes(keyMatch[1]);
            const valueMatch = /<Value\b([^>]*)\/?\s*>/iu.exec(keyMatch[2]);
            let value;
            if (valueMatch !== null) {
                const typed = /([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/u.exec(valueMatch[1]);
                if (typed !== null) {
                    const raw = Object.freeze({
                        type: typed[1],
                        value: decodeXmlValue(typed[2] ?? typed[3] ?? ''),
                    });
                    value = Object.freeze({ ...raw, semantic: coerceSc2BankValue(raw) });
                }
            }
            keys.push(Object.freeze({
                name: keyAttributes.name ?? keyAttributes.Name ?? '',
                attributes: keyAttributes,
                ...(value === undefined ? {} : { value }),
            }));
        }
        sections.push(Object.freeze({
            name: sectionAttributes.name ?? sectionAttributes.Name ?? '',
            attributes: sectionAttributes,
            keys: Object.freeze(keys),
        }));
    }
    const signature = /<Signature\b([^>]*)\/?\s*>/iu.exec(text);
    const rootAttributes = root === null ? Object.freeze({}) : attributes(root[1]);
    return Object.freeze({
        version: rootAttributes.version ?? rootAttributes.Version ?? '',
        attributes: rootAttributes,
        sections: Object.freeze(sections),
        signature: signature === null
            ? ''
            : decodeXmlValue(attribute(signature[1], 'value') ?? attribute(signature[1], 'Value') ?? ''),
        elementCount: elements.length,
    });
}
/** Parse BankList/BankList.xml metadata. Player is optional for shared banks. */
export function parseSc2BankList(text, budget) {
    const elements = parseXmlElements(text, budget, 'BankList', 'SC2 BankList');
    const banks = [];
    for (const match of text.matchAll(/<Bank\b([^>]*)\/?\s*>/giu)) {
        const values = attributes(match[1]);
        const name = values.Name ?? values.name;
        if (name === undefined || name === '')
            continue;
        const player = values.Player ?? values.player;
        banks.push(Object.freeze({
            name,
            ...(player === undefined ? {} : { player }),
            attributes: values,
        }));
    }
    return Object.freeze({ banks: Object.freeze(banks), elementCount: elements.length });
}
function galaxyWithoutComments(text) {
    let output = '';
    let index = 0;
    let quoted = false;
    while (index < text.length) {
        const character = text[index];
        if (quoted) {
            output += character;
            if (character === '\\' && index + 1 < text.length) {
                output += text[index + 1];
                index += 2;
                continue;
            }
            if (character === '"')
                quoted = false;
            index += 1;
            continue;
        }
        if (character === '"') {
            quoted = true;
            output += character;
            index += 1;
            continue;
        }
        if (character === '/' && text[index + 1] === '/') {
            while (index < text.length && text[index] !== '\n' && text[index] !== '\r')
                index += 1;
            continue;
        }
        if (character === '/' && text[index + 1] === '*') {
            index += 2;
            while (index < text.length && !(text[index] === '*' && text[index + 1] === '/')) {
                if (text[index] === '\n' || text[index] === '\r')
                    output += text[index];
                index += 1;
            }
            index = Math.min(text.length, index + 2);
            continue;
        }
        output += character;
        index += 1;
    }
    return output;
}
function decodeGalaxyString(value) {
    return value.replace(/\\([\\"nrt])/gu, (_match, escape) => {
        if (escape === 'n')
            return '\n';
        if (escape === 'r')
            return '\r';
        if (escape === 't')
            return '\t';
        return escape;
    });
}
/**
 * Resolve only literal BankLoad("name", player) calls. Dynamic names remain an explicit count;
 * they are never guessed from identifiers or nearby BankList entries.
 */
export function scanGalaxyBankLoads(text, budget) {
    const source = galaxyWithoutComments(text);
    const calls = [];
    const allCalls = [...source.matchAll(/\bBankLoad\s*\(/gu)].length;
    for (const match of source.matchAll(/\bBankLoad\s*\(\s*"((?:\\.|[^"\\])*)"\s*,\s*([^),]+)\s*\)/gu)) {
        if (calls.length >= budget.maxNodes) {
            throw new RangeError('Galaxy BankLoad calls exceed maxNodes budget');
        }
        const playerExpression = match[2].trim();
        calls.push(Object.freeze({
            name: decodeGalaxyString(match[1]),
            playerExpression,
            ...(/^[-+]?\d+$/u.test(playerExpression) ? { player: Number(playerExpression) } : {}),
            offset: match.index,
        }));
    }
    return Object.freeze({
        calls: Object.freeze(calls),
        dynamicCalls: Math.max(0, allCalls - calls.length),
    });
}
export function bankNameFromPath(path) {
    const name = String(path).replaceAll('\\', '/').split('/').at(-1) ?? '';
    return name.replace(/\.sc2bank$/iu, '');
}
export function bankIdentity(name) {
    return `sc2-bank:${encodeURIComponent(String(name).toLowerCase())}`;
}
//# sourceMappingURL=model.js.map