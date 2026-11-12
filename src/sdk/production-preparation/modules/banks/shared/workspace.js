import { bankIdentity, bankNameFromPath, parseSc2Bank, parseSc2BankList, scanGalaxyBankLoads, } from "./model.js";
import { bankKeyId, bankSectionId, createRelationGraphSource, fact, provenance } from "./sources.js";
const MAX_SEMANTIC_FILE_BYTES = 1_048_576;
const MAX_SEMANTIC_TOTAL_BYTES = 16_777_216;
const MAX_SEMANTIC_FILES = 2_048;
const utf8 = new TextDecoder('utf-8', { fatal: true });
function abort(signal) {
    if (signal?.aborted)
        throw new DOMException('operation cancelled', 'AbortError');
}
function basename(path) {
    return String(path).replaceAll('\\', '/').split('/').at(-1) ?? '';
}
function fileId(path) {
    return `sc2-entry:${encodeURIComponent(String(path).toLowerCase())}`;
}
function boundedNumber(value, maximum) {
    const number = Number(value);
    return Number.isSafeInteger(number) ? Math.max(0, Math.min(number, maximum)) : maximum;
}
/**
 * Inspect Banks, BankList and literal Galaxy BankLoad calls only through an already-mounted SC2
 * namespace. Optional malformed or over-budget documents make the semantic graph partial without
 * making the package itself unreadable.
 */
export async function inspectSc2BankWorkspace(options) {
    const files = options.entries.filter(entry => entry.kind === 'file');
    const bankListEntries = files.filter(entry => /^(?:banklist|banklist\.xml)$/iu.test(basename(entry.path)));
    const bankEntries = files.filter(entry => /\.sc2bank$/iu.test(entry.path));
    const galaxyEntries = files.filter(entry => /\.galaxy$/iu.test(entry.path));
    const candidates = [...bankListEntries, ...bankEntries, ...galaxyEntries];
    const maximumDiagnostics = boundedNumber(options.budget.maxDiagnostics, 10_000);
    const diagnostics = [];
    const partialReasons = new Set();
    let readBytes = 0;
    let readFiles = 0;
    let remainingNodes = Math.max(0, boundedNumber(options.budget.maxNodes, Number.MAX_SAFE_INTEGER) - options.entries.length);
    const diagnostic = (code, message) => {
        partialReasons.add(code);
        if (diagnostics.length >= maximumDiagnostics)
            return;
        diagnostics.push(Object.freeze({
            id: `sc2-bank-workspace-${code}-${diagnostics.length}`,
            code: `blizzard/${code}`,
            category: 'structure',
            severity: 'warning',
            message,
        }));
    };
    const readText = async (entry) => {
        abort(options.signal);
        if (readFiles >= MAX_SEMANTIC_FILES) {
            diagnostic('sc2-bank-workspace-file-cap', `Bank semantics stopped after ${MAX_SEMANTIC_FILES} candidate files`);
            return undefined;
        }
        const remainingBytes = MAX_SEMANTIC_TOTAL_BYTES - readBytes;
        if (remainingBytes <= 0) {
            diagnostic('sc2-bank-workspace-byte-cap', `Bank semantics stopped after ${MAX_SEMANTIC_TOTAL_BYTES} decoded bytes`);
            return undefined;
        }
        const declaredSize = entry.size === undefined ? undefined : Number(entry.size);
        if (declaredSize !== undefined &&
            (!Number.isSafeInteger(declaredSize) ||
                declaredSize > MAX_SEMANTIC_FILE_BYTES ||
                declaredSize > remainingBytes)) {
            diagnostic('sc2-bank-workspace-entry-over-budget', `${entry.path} exceeds the bounded bank semantic read budget`);
            return undefined;
        }
        try {
            const bytes = await options.readEntry(entry.path, Math.min(MAX_SEMANTIC_FILE_BYTES, remainingBytes), options.signal);
            readFiles += 1;
            readBytes += bytes.byteLength;
            return utf8.decode(bytes);
        }
        catch (error) {
            diagnostic('sc2-bank-workspace-entry-unreadable', `${entry.path} could not be read as bounded UTF-8: ${error instanceof Error ? error.message : String(error)}`);
            return undefined;
        }
    };
    const parseBudget = () => Object.freeze({ ...options.budget, maxNodes: remainingNodes });
    const consumeNodes = count => {
        remainingNodes = Math.max(0, remainingNodes - count);
    };
    const bankLists = [];
    const bankFiles = [];
    const galaxyFiles = [];
    for (const entry of candidates.slice(0, MAX_SEMANTIC_FILES)) {
        abort(options.signal);
        if (remainingNodes <= 0) {
            diagnostic('sc2-bank-workspace-node-cap', 'Bank semantics exhausted the package node budget');
            break;
        }
        const text = await readText(entry);
        if (text === undefined)
            continue;
        try {
            if (bankListEntries.includes(entry)) {
                const bankList = parseSc2BankList(text, parseBudget());
                consumeNodes(bankList.elementCount);
                bankLists.push(Object.freeze({ path: entry.path, bankList }));
            }
            else if (bankEntries.includes(entry)) {
                const bank = parseSc2Bank(text, parseBudget());
                consumeNodes(bank.elementCount);
                bankFiles.push(Object.freeze({ path: entry.path, name: bankNameFromPath(entry.path), bank }));
            }
            else {
                const scan = scanGalaxyBankLoads(text, parseBudget());
                consumeNodes(scan.calls.length);
                galaxyFiles.push(Object.freeze({ path: entry.path, scan }));
                if (scan.dynamicCalls > 0)
                    partialReasons.add('dynamic-galaxy-bank-loads');
            }
        }
        catch (error) {
            diagnostic('sc2-bank-workspace-document-invalid', `${entry.path} bank semantics were skipped: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    if (candidates.length > MAX_SEMANTIC_FILES) {
        diagnostic('sc2-bank-workspace-file-cap', `${candidates.length - MAX_SEMANTIC_FILES} candidate file(s) exceeded the semantic file cap`);
    }
    const nodes = [];
    const edges = [];
    const nodeIds = new Set();
    const addNode = (id, label, type) => {
        if (nodeIds.has(id))
            return;
        nodeIds.add(id);
        nodes.push(Object.freeze({ id, label, type }));
    };
    const addFile = (path, type) => {
        const id = fileId(path);
        addNode(id, path, type);
        edges.push(Object.freeze({ from: options.root.id, to: id, role: 'contains-document' }));
        return id;
    };
    addNode(options.root.id, options.label, `sc2-${options.kind}-package`);
    const declaredNames = new Set();
    for (const item of bankLists) {
        const listId = addFile(item.path, 'sc2-bank-list');
        for (const bank of item.bankList.banks) {
            const id = bankIdentity(bank.name);
            declaredNames.add(bank.name.toLowerCase());
            addNode(id, bank.name, 'sc2-bank');
            edges.push(Object.freeze({ from: listId, to: id, role: 'declares-bank' }));
        }
    }
    for (const item of bankFiles) {
        const bankFileId = addFile(item.path, 'sc2-bank-file');
        const logicalBankId = bankIdentity(item.name);
        addNode(logicalBankId, item.name, 'sc2-bank');
        edges.push(Object.freeze({ from: logicalBankId, to: bankFileId, role: 'has-bank-file' }));
        for (const [sectionIndex, section] of item.bank.sections.entries()) {
            const sectionId = bankSectionId(bankFileId, sectionIndex);
            addNode(sectionId, section.name, 'sc2-bank-section');
            edges.push(Object.freeze({ from: bankFileId, to: sectionId, role: 'contains-section' }));
            for (const [keyIndex, key] of section.keys.entries()) {
                const keyId = bankKeyId(bankFileId, sectionIndex, keyIndex);
                addNode(keyId, key.name, 'sc2-bank-key');
                edges.push(Object.freeze({ from: sectionId, to: keyId, role: 'contains-key' }));
            }
        }
    }
    for (const item of galaxyFiles) {
        const galaxyId = addFile(item.path, 'galaxy-script');
        for (const call of item.scan.calls) {
            const id = bankIdentity(call.name);
            addNode(id, call.name, 'sc2-bank');
            edges.push(Object.freeze({ from: galaxyId, to: id, role: 'loads-bank' }));
        }
    }
    const allBankNames = new Map();
    for (const item of bankLists) {
        for (const bank of item.bankList.banks)
            allBankNames.set(bank.name.toLowerCase(), bank.name);
    }
    for (const item of bankFiles)
        allBankNames.set(item.name.toLowerCase(), item.name);
    for (const item of galaxyFiles) {
        for (const call of item.scan.calls)
            allBankNames.set(call.name.toLowerCase(), call.name);
    }
    const bankNames = Object.freeze([...allBankNames.values()].sort((left, right) => left.localeCompare(right)));
    const declaredBanks = bankLists.reduce((sum, item) => sum + item.bankList.banks.length, 0);
    const sections = bankFiles.reduce((sum, item) => sum + item.bank.sections.length, 0);
    const keys = bankFiles.reduce((sum, item) => sum + item.bank.sections.reduce((count, section) => count + section.keys.length, 0), 0);
    const staticGalaxyLoads = galaxyFiles.reduce((sum, item) => sum + item.scan.calls.length, 0);
    const dynamicGalaxyLoads = galaxyFiles.reduce((sum, item) => sum + item.scan.dynamicCalls, 0);
    const summary = Object.freeze({
        bankLists: bankLists.length,
        declaredBanks,
        bankFiles: bankEntries.length,
        parsedBankFiles: bankFiles.length,
        bankSections: sections,
        bankKeys: keys,
        bankNames,
        galaxyBankLoads: staticGalaxyLoads,
        dynamicGalaxyBankLoads: dynamicGalaxyLoads,
        semanticFilesRead: readFiles,
        semanticBytesRead: readBytes,
    });
    const facts = Object.freeze([
        fact(options.root, 'bank-lists', 'BankList documents', summary.bankLists, ['banks', 'lists']),
        fact(options.root, 'declared-banks', 'Declared banks', summary.declaredBanks, [
            'banks',
            'declared',
        ]),
        fact(options.root, 'bank-files', 'Bank files', summary.bankFiles, ['banks', 'files']),
        fact(options.root, 'bank-sections', 'Bank sections', summary.bankSections, [
            'banks',
            'sections',
        ]),
        fact(options.root, 'bank-keys', 'Bank keys', summary.bankKeys, ['banks', 'keys']),
        fact(options.root, 'bank-names', 'Bank names', summary.bankNames, ['banks', 'names']),
        fact(options.root, 'galaxy-bank-loads', 'Literal Galaxy BankLoad calls', staticGalaxyLoads, [
            'banks',
            'galaxyLoads',
        ]),
        fact(options.root, 'dynamic-bank-loads', 'Dynamic Galaxy BankLoad calls', dynamicGalaxyLoads, [
            'banks',
            'dynamicGalaxyLoads',
        ]),
    ]);
    const relations = Object.freeze(bankNames.map(name => Object.freeze({
        role: declaredNames.has(name.toLowerCase()) ? 'declares-bank' : 'references-bank',
        subjectId: bankIdentity(name),
        label: name,
        kind: 'sc2-bank',
        provenance: provenance(options.root, ['banks', name]),
    })));
    const tableRows = Object.freeze(bankFiles.flatMap(item => item.bank.sections.flatMap(section => section.keys.map(key => [
        item.path,
        item.name,
        section.name,
        key.name,
        key.value?.type ?? '',
        key.value?.value ?? '',
    ]))));
    const treeNode = Object.freeze({
        kind: 'banks',
        label: 'Banks',
        preview: `${bankNames.length} bank(s), ${keys} key(s)`,
        children: bankFiles.map(item => ({
            kind: 'bank',
            label: item.name,
            preview: `${item.bank.sections.length} section(s)`,
            children: item.bank.sections.map(section => ({
                kind: 'section',
                label: section.name,
                preview: `${section.keys.length} key(s)`,
                children: section.keys.map(key => ({
                    kind: 'key',
                    label: key.name,
                    preview: key.value === undefined ? undefined : `${key.value.type}: ${key.value.value}`,
                })),
            })),
        })),
    });
    const reasons = [...partialReasons].sort();
    return Object.freeze({
        summary,
        facts,
        relations,
        tableRows,
        treeNode,
        diagnostics: Object.freeze(diagnostics),
        nodes: Object.freeze(nodes),
        edges: Object.freeze(edges),
        completeness: reasons.length === 0 ? 'complete' : 'partial',
        ...(reasons.length === 0 ? {} : { reason: reasons.join(', ') }),
        relationGraphSource: createRelationGraphSource({
            snapshotId: options.revision,
            nodes,
            edges,
            completeness: reasons.length === 0 ? 'complete' : 'partial',
            ...(reasons.length === 0 ? {} : { reason: reasons.join(', ') }),
        }),
    });
}
//# sourceMappingURL=workspace.js.map