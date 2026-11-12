import { XMLParser } from 'fast-xml-parser';
const XML_PARSER = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    parseTagValue: false,
    trimValues: true,
    allowBooleanAttributes: true,
});
export function parseBankList(xmlText) {
    const raw = XML_PARSER.parse(xmlText);
    const root = raw['BankList'];
    if (!isRecord(root))
        throw new Error('BankList XML must contain a <BankList> root');
    const banks = [];
    for (const item of toArray(root['Bank'])) {
        if (!isRecord(item))
            continue;
        const attrs = attrsOf(item);
        const name = attrs['Name'] ?? attrs['name'];
        const player = attrs['Player'] ?? attrs['player'];
        if (name === undefined || player === undefined)
            continue;
        banks.push({ name, player, attrs });
    }
    return { banks };
}
export function serializeBankList(list) {
    let out = '<?xml version="1.0" encoding="utf-8"?>\n<BankList>\n';
    for (const bank of list.banks) {
        const attrs = { ...bank.attrs, Name: bank.name, Player: bank.player };
        out += '    <Bank';
        for (const [name, value] of Object.entries(attrs))
            out += ` ${name}="${escapeAttr(value)}"`;
        out += '/>\n';
    }
    out += '</BankList>\n';
    return out;
}
export function getBankListNames(list) {
    return [...new Set(list.banks.map(bank => bank.name))];
}
export function matchBankListToDiscovered(list, discovered) {
    return list.banks.map(entry => ({
        entry,
        discovered: discovered.filter(file => file.info.bankName.toLowerCase() === entry.name.toLowerCase()),
    }));
}
function toArray(value) {
    if (value === undefined || value === null)
        return [];
    return Array.isArray(value) ? value : [value];
}
function attrsOf(node) {
    const out = {};
    for (const [key, value] of Object.entries(node)) {
        if (key.startsWith('@_'))
            out[key.slice(2)] = String(value);
    }
    return out;
}
function escapeAttr(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}
function isRecord(value) {
    return typeof value === 'object' && value !== null;
}
