import {matchingRepeatedAiComposition} from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/custom-ai-composition.js";
import { generateCustomAiMapScriptSection, generateCustomAiScript } from "./custom-ai-script.source-profile.mjs";
export const CUSTOM_AI_SECTION_HEADER = '// Custom AI Functions';
const RULE = '//--------------------------------------------------------------------------------------------------';
const lf = (text) => text.replaceAll('\r\n', '\n');
/** Reads the section, from its rule to the end of `cai_runall`; undefined when the script has none. */
function sectionRange(script) {
    const header = script.indexOf(`${RULE}\n${CUSTOM_AI_SECTION_HEADER}\n${RULE}\n`);
    if (header < 0)
        return undefined;
    const runAll = script.indexOf('\nvoid cai_runall () {\n', header);
    if (runAll < 0)
        return undefined;
    const close = script.indexOf('\n}', runAll + 1);
    if (close < 0)
        return undefined;
    return { start: header, end: close + 2 };
}
const levels = (text, variable) => [...text.matchAll(new RegExp(`^    if \\(d == (\\d+)\\) \\{ ${variable} = (-?\\d+); \\}$`, 'gmu'))]
    .map(match => ({ level: Number(match[1]), value: Number(match[2]) }));
/** The lines of `text` between two marker lines (exclusive), or '' when a marker is missing. */
function between(text, from, to) {
    const start = text.indexOf(from);
    if (start < 0)
        return '';
    const end = text.indexOf(to, start + from.length);
    return end < 0 ? '' : text.slice(start + from.length, end);
}
const triggerCalls = (text) => [...text.matchAll(/^    TriggerExecute\(TriggerFind\("([^"]+)"\), true, false\);$/gmu)].map(match => match[1]);
/** One definition from its generated script; the trigger ids are placeholders `T<n>` resolved by the caller. */
function readDefinition(text, triggerId) {
    const id = /^point\[17\] ai([0-9A-F]{8})_defGather;$/mu.exec(text)?.[1];
    if (id === undefined)
        return undefined;
    const ai = `ai${id}`;
    const aiName = /^\/\/ AI Name: (.*)$/mu.exec(text)?.[1] ?? '';
    const definition = { id, targetPlayers: [], steps: [] };
    const blocks = text.split(`${RULE}\n// Attack Wave: `).slice(1);
    const waves = new Map();
    for (const block of blocks) {
        const body = block.split(`${RULE}\n// Attack Wave Wrappers`)[0];
        const number = new RegExp(`^bool\\[17\\] ${ai}_wave(\\d+)_enabled;$`, 'mu').exec(body)?.[1];
        if (number === undefined)
            return undefined;
        const wave = `${ai}_wave${number}`;
        const step = { type: 'Wave', id: Number(number), units: [], times: [], points: [] };
        const text = body.slice(0, body.indexOf('\n'));
        if (text !== '')
            step.text = text;
        // Read only the native canonical initializer. Whole-file regeneration below
        // still rejects edited or unsupported wave bodies and repeated sequences.
        const initial = body.match(new RegExp(`^        ${wave}_enabled\\[init_i\\] = (true|false);$`, 'gmu'))
        if (initial?.length !== 1) return undefined
        if (initial[0].endsWith('= false;')) step.initOff = true
        if (body.includes(`\nbool[17] ${wave}_hasRun;\n`))
            step.onceOnly = true;
        if (body.includes(`\nunitgroup[17] ${wave}_lastUnits;\n`))
            step.createUnits = true;
        const run = between(body, `\nbool ${wave}_runFunc (bool c, bool a) {\n`, `\n}\n`);
        // Where a trigger call stands tells which time it belongs to.
        const arrivalCalls = triggerCalls(between(run, '\n    ts = ta;\n', '\n    if (tg > 0 && tg < ta) {\n'));
        const gatherCalls = triggerCalls(between(run, '\n        ts = tg;\n    }\n', '\n    AIAttackWaveSetTargetPlayer(p, target);\n'));
        const endCalls = triggerCalls(between(run, '\n    Wait(ts, c_timeAI);\n', '\n    tf = 0;\n'));
        const beforeSend = run.includes('\n    AIAttackWaveSend(p, ts, false);\n')
            ? triggerCalls(between(run, '\n    AIAttackWaveClearWaypoints(p);\n', '\n    AIAttackWaveSend(p, ts, false);\n'))
            : step.createUnits ? triggerCalls(between(run, `\n    ${wave}_lastUnits[p] = UnitGroupEmpty();\n`, '\n    Wait(ts, c_timeAI);\n'))
                : triggerCalls(between(run, '\n    AIAttackWaveClearWaypoints(p);\n', '\n    Wait(ts, c_timeAI);\n'));
        if (arrivalCalls.length > 1 || gatherCalls.length > 1 || endCalls.length > 2 || beforeSend.length > 1)
            return undefined;
        if (beforeSend[0] !== undefined)
            step.configTrigger = triggerId(beforeSend[0]);
        const time = (type, durations, trigger, atEnd) => {
            if (durations.length === 0 && trigger === undefined)
                return;
            const item = { type, durations };
            if (trigger !== undefined)
                item.trigger = triggerId(trigger);
            if (atEnd)
                item.triggerRunAtEnd = true;
            step.times.push(item);
        };
        const arrivalAtEnd = arrivalCalls.length === 0 && endCalls.length > 0;
        const gatherAtEnd = gatherCalls.length === 0 && endCalls.length === (arrivalAtEnd ? 2 : 1);
        time('Arrival', levels(run, 'ta'), arrivalCalls[0] ?? (arrivalAtEnd ? endCalls[0] : undefined), arrivalAtEnd);
        time('GatherTime', levels(run, 'tg'), gatherCalls[0] ?? (gatherAtEnd ? endCalls.at(-1) : undefined), gatherAtEnd);
        time('FinalWait', levels(run, 'tf'), undefined, false);
        // Each type in the order written; the document lists them Create, Gather, Waypoint, TargetPoint.
        const creates = [...run.matchAll(/^    createPoint = PointFromId\((\d+)\);$/gmu)].map(match => match[1]);
        const gathers = [...run.matchAll(/^    gatherPoint = PointFromId\((\d+)\);$/gmu)].map(match => match[1]);
        const targets = [...run.matchAll(/^    AIAttackWaveSetTargetPoint\(p, PointFromId\((\d+)\)\);$/gmu)].map(match => match[1]);
        for (const point of creates)
            step.points.push({ type: 'Create', id: point });
        for (const point of gathers)
            step.points.push({ type: 'Gather', id: point });
        const waypoints = between(run, '\n    AIAttackWaveClearWaypoints(p);\n', '\n\n');
        for (const match of waypoints.matchAll(/^    (?:if \(((?:\(d == \d+\)(?: \|\| )?)+)\) \{\n        )?AIAttackWaveAddWaypoint\(p, PointFromId\((\d+)\), (true|false)\);$/gmu)) {
            const active = match[1] === undefined ? undefined : [...match[1].matchAll(/d == (\d+)/gu)].map(level => Number(level[1]));
            step.points.push(active === undefined ? { type: match[3] === 'true' ? 'Transport' : 'Waypoint', id: match[2] } : { type: match[3] === 'true' ? 'Transport' : 'Waypoint', id: match[2], active });
        }
        for (const point of targets)
            step.points.push({ type: 'TargetPoint', id: point });
        if (step.createUnits) {
            for (const match of run.matchAll(/^    createCount = 0;\n((?:    if \(d == \d+\) \{ createCount = -?\d+; \}\n)*)    if \(createCount > 0\) \{\n        UnitCreate\(createCount, "([^"]*)", 0, p, createPoint, PointGetFacing\(createPoint\)\);$/gmu)) {
                step.units.push({ type: match[2], counts: levels(match[1], 'createCount') });
            }
        }
        else {
            // Trained waves: one block of AIAttackWaveAddUnits per unit type, difficulty one higher.
            let unit;
            for (const line of run.split('\n')) {
                const match = /^    AIAttackWaveAddUnits\((\d+), (-?\d+), "([^"]*)"\);$/u.exec(line);
                if (!match) {
                    unit = undefined;
                    continue;
                }
                if (unit === undefined || unit.type !== match[3])
                    step.units.push(unit = { type: match[3], counts: [] });
                unit.counts.push({ level: Number(match[1]) - 1, value: Number(match[2]) });
            }
        }
        waves.set(step.id, step);
    }
    // The sequence gives the steps in document order: comments, the waves once each in their block
    // order, and links (a wave run again).
    const sequence = between(text, `\nbool ${ai}_waves_runFunc (bool c, bool a) {\n`, '\n    return true;\n}\n');
    const order = [...waves.values()];
    let next = 0;
    const loop = sequence.indexOf('\n    while (true) {\n');
    for (const line of (loop < 0 ? sequence : sequence.slice(0, loop)).split('\n')) {
        const comment = /^    \/\/ (.*)$/u.exec(line);
        if (comment) {
            definition.steps.push({ type: 'Comment', text: comment[1], units: [], times: [], points: [] });
            continue;
        }
        const call = new RegExp(`^    ${ai}_wave(\\d+)_run\\(p, target, (true|false)\\);$`, 'u').exec(line);
        if (!call)
            continue;
        const number = Number(call[1]);
        if (order[next]?.id === number) {
            const step = order[next++];
            if (call[2] === 'false')
                step.noWait = true;
            definition.steps.push(step);
        }
        else
            definition.steps.push({ type: 'Link', id: number, ...(call[2] === 'false' ? { noWait: true } : {}), units: [], times: [], points: [] });
    }
    if (next !== order.length)
        return undefined;
    if (loop >= 0) {
        const repeated = sequence.slice(loop).match(new RegExp(`^        ${ai}_wave\\d+_run\\(p, target, (?:true|false)\\);$`, 'gmu'))?.length ?? 0;
        definition.repeatWaves = repeated;
    }
    const gather = new RegExp(`^            ${ai}_defGather\\[init_i\\] = PointFromId\\((\\d+)\\);$`, 'mu').exec(text)?.[1];
    if (gather !== undefined && gather !== '0')
        definition.gatherDefault = gather;
    return { definition, aiName };
}
/**
 * Reads the Custom AI document from a map script and its `ai<Id>.galaxy` files. `none` — the script
 * has no Custom AI section; `kept` — it has one the generator does not write again as it stands.
 */
export function recoverCustomAi(mapScript, files, dependencyDocuments = []) {
    const script = lf(mapScript);
    const range = sectionRange(script);
    if (range === undefined)
        return { state: 'none' };
    const section = script.slice(range.start, range.end);
    const startAll = between(section, '\nvoid cai_startall () {\n', '\n}');
    const runAll = between(section, '\nvoid cai_runall () {\n', '\n}') + '\n';
    const ids = [...section.matchAll(/^    if \(ai == "ai([0-9A-F]{8})"\) \{ ai[0-9A-F]{8}_waves_stop\(\); \}$/gmu)].map(match => match[1]);
    // Repeated source branches may be observable; do not deduplicate them to
    // manufacture an AIData document the Editor cannot represent faithfully.
    if(new Set(ids).size!==ids.length && !matchingRepeatedAiComposition(ids,dependencyDocuments))
        return {state:'kept',reason:'duplicate-ai-definition-id',details:{ids}};
    const byName = new Map(files.map(file => [file.fileName.replace(/\.galaxy$/iu, '').toLowerCase(), file]));
    const triggerFunctions = new Map();
    const triggerId = (name) => {
        for (const [id, known] of triggerFunctions)
            if (known === name)
                return id;
        const id = `T${triggerFunctions.size}`;
        triggerFunctions.set(id, name);
        return id;
    };
    const document = { definitions: [] };
    const aiNames = new Map();
    const used = [];
    for (const id of ids) {
        const file = byName.get(`ai${id}`.toLowerCase());
        if (file === undefined)
            return { state: 'kept', reason: 'missing-ai-script', details: { file: `ai${id}.galaxy` } };
        const read = readDefinition(lf(file.text), triggerId);
        if (read === undefined || read.definition.id !== id)
            return { state: 'kept', reason: 'unreadable-ai-script', details: { file: file.fileName } };
        const source = new RegExp(`^    cai_start\\("ai${id}", (\\d+)\\);$`, 'mu').exec(startAll)?.[1];
        if (source !== undefined)
            read.definition.sourcePlayer = Number(source);
        const targets = new RegExp(`\\n    PlayerGroupClear\\(target\\);\\n((?:    PlayerGroupAdd\\(target, \\d+\\);\\n)+)    cai_waves_run\\(${source ?? '-'}, target\\);\\n`, 'u').exec(runAll)?.[1];
        if (targets !== undefined)
            read.definition.targetPlayers = [...targets.matchAll(/(\d+)\);/gu)].map(match => Number(match[1]));
        document.definitions.push(read.definition);
        aiNames.set(id, read.aiName);
        used.push(file);
    }
    const campaignPlayers = [...startAll.matchAll(/^    AICampaignStart\((\d+)\);$/gmu)].map(match => Number(match[1]));
    // Accepted only when the generator writes every file and the section as they are.
    const names = {
        aiName: definition => aiNames.get(definition.id) ?? '',
        triggerFunction: id => triggerFunctions.get(id) ?? id,
    };
    if (lf(generateCustomAiMapScriptSection(document, { campaignPlayers })) !== section) {
        return { state: 'kept', reason: 'section-differs' };
    }
    for (const [index, definition] of document.definitions.entries()) {
        if (lf(generateCustomAiScript(definition, names)) !== lf(used[index].text)) {
            return { state: 'kept', reason: 'ai-script-differs', details: { file: used[index].fileName } };
        }
    }
    const includes = new Set(document.definitions.map(definition => `include "ai${definition.id}"`));
    let rest = script.slice(0, range.start) + script.slice(range.end).replace(/^\n+/u, '\n');
    rest = rest.split('\n').filter(line => !includes.has(line.trim())).join('\n')
        .replace(/^(void InitMap \(\) \{\n(?:    .*\n)*?)    InitCustomAI\(\);\n/mu, '$1');
    const declarations = [...used, { fileName: 'CustomAIFunctions.galaxy', text: section }];
    return { state: 'recovered', value: { document, aiNames, campaignPlayers, triggerFunctions, script: rest, files: used, declarations } };
}
//# sourceMappingURL=custom-ai-recovery.js.map