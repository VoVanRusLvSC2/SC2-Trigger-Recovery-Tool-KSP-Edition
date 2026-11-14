/**
 * The editor's Custom AI document (`CustomAI`, root `<AIData>`): attack-wave AIs the SC2 Editor
 * turns into one generated script `ai<Id>.galaxy` per definition plus the `cai_*` dispatch in
 * MapScript (the generator and its inverse live with the Galaxy converter, `modules/triggers`).
 * The model follows the XML element for element. An element is read into typed fields only when the
 * model knows all of it — its attributes, its children and their values as the editor writes them;
 * anything else is kept whole in `unknown` at its place, and the writer uses the editor's layout, so
 * a read and a write give the same bytes and a typed edit loses nothing.
 */
import { canonicalInteger, escapeXmlAttribute as escapeAttribute, keptAt, knownElement as known, placeKept, readEditorXml, rootAttributes, rootOpenTag, xmlAttributes as attributes, } from './editor-xml.js';
/** `Value` of an element that holds nothing else, as the editor writes an integer. */
const integerValue = (element) => known(element, ['Value']) ? canonicalInteger(element.attributes['Value']) : undefined;
/** `<Count>`/`<Duration>` children, or undefined when any child is something else. */
function difficultyValues(element, tag) {
    const values = [];
    for (const child of element.children) {
        const level = canonicalInteger(child.attributes['DiffLevel']);
        const value = canonicalInteger(child.attributes['Value']);
        if (child.name !== tag || !known(child, ['DiffLevel', 'Value']) || level === undefined || value === undefined)
            return undefined;
        values.push({ level, value });
    }
    return values;
}
/** The text a document was read from, returned by the writer while the model still writes the same. */
const sourceText = new WeakMap();
/** Reads a `CustomAI` document. A document that is not `<AIData>` throws. */
export function readAIData(xml) {
    const root = readEditorXml(xml, 'AIData', 'CustomAI');
    const document = { definitions: [] };
    const own = rootAttributes(root);
    if (own !== undefined)
        document.root = own;
    const unknown = [];
    root.children.forEach((child, index) => {
        const repeatShow = child.name === 'RepeatShow' && document.repeatShow === undefined ? integerValue(child) : undefined;
        const definition = child.name === 'Definition' ? readDefinition(child) : undefined;
        if (repeatShow !== undefined)
            document.repeatShow = repeatShow;
        else if (definition !== undefined)
            document.definitions.push(definition);
        else
            unknown.push(keptAt(child, index));
    });
    if (unknown.length > 0)
        document.unknown = unknown;
    sourceText.set(document, { raw: xml, normalized: writeEditorLayout(document) });
    return document;
}
function readDefinition(element) {
    const id = element.attributes['Id'];
    if (id === undefined || !known(element, ['Id', 'Color'], true))
        return undefined;
    const definition = { id, targetPlayers: [], steps: [] };
    if (element.attributes['Color'] !== undefined)
        definition.color = element.attributes['Color'];
    const unknown = [];
    element.children.forEach((child, index) => {
        const value = integerValue(child);
        const step = child.name === 'Step' ? readStep(child) : undefined;
        const gather = child.name === 'GatherDefault' && known(child, ['Id']) ? child.attributes['Id'] : undefined;
        if (child.name === 'SourcePlayer' && value !== undefined && definition.sourcePlayer === undefined)
            definition.sourcePlayer = value;
        else if (child.name === 'TargetPlayer' && value !== undefined)
            definition.targetPlayers.push(value);
        else if (gather !== undefined && definition.gatherDefault === undefined)
            definition.gatherDefault = gather;
        else if (child.name === 'RepeatWaves' && value !== undefined && definition.repeatWaves === undefined)
            definition.repeatWaves = value;
        else if (step !== undefined)
            definition.steps.push(step);
        else
            unknown.push(keptAt(child, index));
    });
    if (unknown.length > 0)
        definition.unknown = unknown;
    return definition;
}
function readStep(element) {
    const type = element.attributes['Type'];
    const id = canonicalInteger(element.attributes['Id']);
    if (type === undefined || !known(element, ['Type', 'Id', 'Text'], true) || (element.attributes['Id'] !== undefined && id === undefined))
        return undefined;
    const step = { type, units: [], times: [], points: [] };
    if (id !== undefined)
        step.id = id;
    if (element.attributes['Text'] !== undefined)
        step.text = element.attributes['Text'];
    const unknown = [];
    element.children.forEach((child, index) => {
        const flag = known(child, []);
        const unit = child.name === 'Unit' ? readUnit(child) : undefined;
        const time = child.name === 'Time' ? readTime(child) : undefined;
        const point = child.name === 'Point' ? readPoint(child) : undefined;
        const config = child.name === 'ConfigTrigger' && known(child, ['Value']) ? child.attributes['Value'] : undefined;
        if (child.name === 'NoWait' && flag && !step.noWait)
            step.noWait = true;
        else if (child.name === 'InitOff' && flag && !step.initOff) step.initOff = true
        else if (child.name === 'OnceOnly' && flag && !step.onceOnly)
            step.onceOnly = true;
        else if (child.name === 'CreateUnits' && flag && !step.createUnits)
            step.createUnits = true;
        else if (config !== undefined && step.configTrigger === undefined)
            step.configTrigger = config;
        else if (unit !== undefined)
            step.units.push(unit);
        else if (time !== undefined)
            step.times.push(time);
        else if (point !== undefined)
            step.points.push(point);
        else
            unknown.push(keptAt(child, index));
    });
    if (unknown.length > 0)
        step.unknown = unknown;
    return step;
}
function readUnit(element) {
    const type = element.attributes['Type'];
    const counts = known(element, ['Type'], true) ? difficultyValues(element, 'Count') : undefined;
    return type === undefined || counts === undefined ? undefined : { type, counts };
}
function readTime(element) {
    const type = element.attributes['Type'];
    const runAtEnd = element.attributes['TriggerRunAtEnd'];
    const durations = known(element, ['Type', 'Trigger', 'TriggerRunAtEnd'], true) ? difficultyValues(element, 'Duration') : undefined;
    if (type === undefined || durations === undefined || (runAtEnd !== undefined && runAtEnd !== '1'))
        return undefined;
    const time = { type, durations };
    if (element.attributes['Trigger'] !== undefined)
        time.trigger = element.attributes['Trigger'];
    if (runAtEnd === '1')
        time.triggerRunAtEnd = true;
    return time;
}
function readPoint(element) {
    const type = element.attributes['Type'];
    const id = element.attributes['Id'];
    if (type === undefined || id === undefined || !known(element, ['Type', 'Id'], true))
        return undefined;
    const active = [];
    for (const child of element.children) {
        const level = canonicalInteger(child.attributes['DiffLevel']);
        if (child.name !== 'Active' || !known(child, ['DiffLevel']) || level === undefined)
            return undefined;
        active.push(level);
    }
    return active.length > 0 ? { type, id, active } : { type, id };
}
/** Writes the document: the text it was read from while nothing changed, else the editor's layout. */
export function writeAIData(document) {
    const normalized = writeEditorLayout(document);
    const source = sourceText.get(document);
    return source !== undefined && source.normalized === normalized ? source.raw : normalized;
}
/**
 * The editor's layout: four-space indent, CRLF line ends, a `<Time>` and a Wave `<Step>` always open, no final
 * line end; kept elements go back to the positions they were read at.
 */
export function writeEditorLayout(document) {
    const blocks = [];
    if (document.repeatShow !== undefined)
        blocks.push([`    <RepeatShow Value="${document.repeatShow}"/>`]);
    for (const definition of document.definitions)
        blocks.push(definitionLines(definition));
    return ['<?xml version="1.0" encoding="utf-8"?>', rootOpenTag('AIData', document.root), ...placeKept(blocks, document.unknown, 1), '</AIData>'].join('\r\n');
}
function definitionLines(definition) {
    const blocks = [];
    if (definition.sourcePlayer !== undefined)
        blocks.push([`        <SourcePlayer Value="${definition.sourcePlayer}"/>`]);
    for (const player of definition.targetPlayers)
        blocks.push([`        <TargetPlayer Value="${player}"/>`]);
    if (definition.gatherDefault !== undefined)
        blocks.push([`        <GatherDefault Id="${escapeAttribute(definition.gatherDefault)}"/>`]);
    if (definition.repeatWaves !== undefined)
        blocks.push([`        <RepeatWaves Value="${definition.repeatWaves}"/>`]);
    for (const step of definition.steps)
        blocks.push(stepLines(step));
    return [`    <Definition${attributes([['Id', definition.id], ['Color', definition.color]])}>`, ...placeKept(blocks, definition.unknown, 2), '    </Definition>'];
}
function stepLines(step) {
    const open = `        <Step${attributes([['Type', step.type], ['Id', step.id], ['Text', step.text]])}`;
    const blocks = [];
    if (step.noWait)
        blocks.push(['            <NoWait/>']);
    if (step.initOff) blocks.push(['            <InitOff/>'])
    if (step.onceOnly)
        blocks.push(['            <OnceOnly/>']);
    if (step.createUnits)
        blocks.push(['            <CreateUnits/>']);
    if (step.configTrigger !== undefined)
        blocks.push([`            <ConfigTrigger Value="${escapeAttribute(step.configTrigger)}"/>`]);
    for (const unit of step.units)
        blocks.push([
            `            <Unit Type="${escapeAttribute(unit.type)}">`,
            ...unit.counts.map(({ level, value }) => `                <Count DiffLevel="${level}" Value="${value}"/>`),
            '            </Unit>',
        ]);
    for (const time of step.times)
        blocks.push([
            `            <Time${attributes([['Type', time.type], ['Trigger', time.trigger], ['TriggerRunAtEnd', time.triggerRunAtEnd ? 1 : undefined]])}>`,
            ...time.durations.map(({ level, value }) => `                <Duration DiffLevel="${level}" Value="${value}"/>`),
            '            </Time>',
        ]);
    for (const point of step.points) {
        const head = `            <Point${attributes([['Type', point.type], ['Id', point.id]])}`;
        blocks.push(point.active === undefined ? [`${head}/>`] : [`${head}>`, ...point.active.map(level => `                <Active DiffLevel="${level}"/>`), '            </Point>']);
    }
    const body = placeKept(blocks, step.unknown, 3);
    // The editor closes an empty Comment or Link step inline but always opens a Wave.
    return body.length === 0 && step.type !== 'Wave' ? [`${open}/>`] : [`${open}>`, ...body, '        </Step>'];
}
//# sourceMappingURL=ai-data.js.map