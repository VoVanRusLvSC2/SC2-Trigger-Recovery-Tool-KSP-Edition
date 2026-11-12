/**
 * Custom AI in the conversion. Galaxy → Triggers: the code the editor generated from the Custom AI
 * document is read back into the document (`custom-ai-recovery.ts`) instead of becoming triggers.
 * Triggers → Galaxy: the document generates that code again (`custom-ai-script.ts`), as the editor does.
 */
import { readAIData, writeAIData } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/map/shared/format/formats/ai-data.js';
import { withImplicitLibrary } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import { triggerFuncName } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/78e2c7a105b4-06b6407a2245-39006703de6e-core.mjs';
import { generateCustomAiMapScriptSection, generateCustomAiScript } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-production-preparation-v32-2026-10-04/dist/modules/triggers/services/galaxy-conversion/internal/custom-ai-script.js';
const AI_SCRIPT_NAME = /^ai[0-9A-F]{8}\.galaxy$/iu;
/** The map's `ai<Id>.galaxy` files the caller offers; anything else is refused. */
export function customAiScriptFiles(value, maximumBytes) {
    if (value === undefined)
        return [];
    if (!Array.isArray(value))
        throw new TypeError('customAiScripts must be an array of { fileName, text }');
    return value.map((file, index) => {
        const fileName = file?.fileName;
        const text = file?.text;
        if (typeof fileName !== 'string' || !AI_SCRIPT_NAME.test(fileName.split(/[\\/]/u).at(-1) ?? '')) {
            throw new TypeError(`customAiScripts[${index}].fileName must name an ai<Id>.galaxy file`);
        }
        if (typeof text !== 'string' || text.length > maximumBytes)
            throw new TypeError(`customAiScripts[${index}].text must be a bounded string`);
        return { fileName: fileName.split(/[\\/]/u).at(-1), text };
    });
}
function triggerFunctionName(library, libraryId, implicit, trigger) {
    return withImplicitLibrary(implicit ? libraryId : undefined, () => triggerFuncName(libraryId, trigger));
}
/**
 * The recovered document with its trigger references as element ids of the converted library.
 * `missing` — trigger functions the library has no trigger for; their references are dropped.
 */
export function recoveredCustomAiOutput(recovered, library, libraryId, implicit) {
    const idByFunction = new Map();
    for (const [id, trigger] of Object.entries(library.elementsByType?.Trigger ?? {})) {
        idByFunction.set(triggerFunctionName(library, libraryId, implicit, trigger), id);
    }
    const missing = [];
    const resolve = (placeholder) => {
        if (placeholder === undefined)
            return undefined;
        const name = recovered.triggerFunctions.get(placeholder);
        const id = name === undefined ? undefined : idByFunction.get(name);
        if (id === undefined && name !== undefined && !missing.includes(name))
            missing.push(name);
        return id;
    };
    const document = structuredClone(recovered.document);
    for (const definition of document.definitions) {
        for (const step of definition.steps) {
            if (step.configTrigger !== undefined) {
                const id = resolve(step.configTrigger);
                if (id === undefined)
                    delete step.configTrigger;
                else
                    step.configTrigger = id;
            }
            for (const time of step.times) {
                const id = resolve(time.trigger);
                if (id === undefined)
                    delete time.trigger;
                else
                    time.trigger = id;
            }
        }
    }
    return {
        conversion: {
            document: writeAIData(document),
            ...(recovered.aiNames.size > 0 ? { aiNames: Object.fromEntries(recovered.aiNames) } : {}),
            ...(recovered.campaignPlayers.length > 0 ? { campaignPlayers: recovered.campaignPlayers } : {}),
        },
        missing,
    };
}
function customAiConversion(value) {
    if (value === undefined)
        return undefined;
    const item = value;
    if (typeof item?.document !== 'string')
        throw new TypeError('customAi.document must be the CustomAI document text');
    if (item.aiNames !== undefined && (typeof item.aiNames !== 'object' || item.aiNames === null))
        throw new TypeError('customAi.aiNames must map definition ids to names');
    if (item.campaignPlayers !== undefined && (!Array.isArray(item.campaignPlayers) || !item.campaignPlayers.every(player => Number.isInteger(player) && player >= 0 && player <= 16))) {
        throw new TypeError('customAi.campaignPlayers must be player numbers');
    }
    return item;
}
/** A line after the file's includes; the Galaxy text keeps its own line ends. */
function afterIncludes(script, insert) {
    const lines = script.split('\n');
    let last = -1;
    for (let index = 0; index < lines.length; index++) {
        const line = lines[index].trim();
        if (/^include\s+"/u.test(line))
            last = index;
        else if (line !== '' && !line.startsWith('//'))
            break;
    }
    lines.splice(last + 1, 0, insert);
    return lines.join('\n');
}
/**
 * The map script with the Galaxy the editor generates from its Custom AI document: `include "ai<Id>"`
 * after the includes, the section "Custom AI Functions" before the first function (it uses only the
 * AI scripts), and `InitCustomAI();` after `InitGlobals();` in `InitMap`. `files` — the `ai<Id>.galaxy`
 * files; `missing` — trigger ids the library has no trigger for.
 */
export function emitCustomAi(script, value, library, libraryId, implicit) {
    const input = customAiConversion(value);
    if (input === undefined)
        return undefined;
    const document = readAIData(input.document);
    if (document.definitions.length === 0)
        return { script, files: [], missing: [] };
    const missing = [];
    const names = {
        aiName: (definition) => input.aiNames?.[definition.id] ?? '',
        triggerFunction: (id) => {
            const trigger = library.elementsByType?.Trigger?.[id];
            // The editor writes no call for a trigger the document does not have.
            if (trigger === undefined) {
                if (!missing.includes(id))
                    missing.push(id);
                return undefined;
            }
            return triggerFunctionName(library, libraryId, implicit, trigger);
        },
    };
    const lineEnd = script.includes('\r\n') ? '\r\n' : '\n';
    const text = (galaxy) => galaxy.replaceAll('\r\n', lineEnd);
    const files = document.definitions.map(definition => ({ fileName: `ai${definition.id}.galaxy`, text: generateCustomAiScript(definition, names) }));
    const section = text(generateCustomAiMapScriptSection(document, { campaignPlayers: input.campaignPlayers ?? [] }));
    let result = afterIncludes(script, document.definitions.map(definition => `include "ai${definition.id}"${lineEnd === '\r\n' ? '\r' : ''}`).join('\n'));
    const firstFunction = /^[A-Za-z_][\w[\]]*\s+[A-Za-z_]\w*\s*\([^)]*\)\s*\{/mu.exec(result);
    const at = firstFunction?.index ?? result.length;
    result = `${result.slice(0, at)}${section}${lineEnd}${lineEnd}${result.slice(at)}`;
    result = result.replace(/^(void InitMap \(\) \{\r?\n(?:[ \t]+.*\r?\n)*?[ \t]+InitGlobals\(\);\r?\n)/mu, `$1    InitCustomAI();${lineEnd}`);
    return { script: result, files, missing };
}
//# sourceMappingURL=custom-ai.js.map