import { Parser } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import { shapeText } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/0facdb3525fc37a5-script-template.mjs';
import { presetIdentifierFunctionName, presetValueConstantName, sanitizeName } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/types/189652cc1dc7-core.mjs';
import { declaredCarrier } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/galaxy-program-context.js';
/** A narrow contextual inverse. A spelling alone never proves a generated
 * identifier function; the exact enum metadata, source body and const binding
 * are mandatory. Unknown/literal/variable enum identities keep the fallback.
 */
export function presetIdentifierInverse(call, ctx, session, makeParam, makeCall) {
    if (call?.kind !== 121 || call.expression?.kind !== 113 || call.arguments?.length !== 1 || call.arguments[0]?.kind !== 113 || !session)
        return undefined;
    const sourceFunction = session.program.declarationAt(call.expression);
    if (!sourceFunction?.body || sourceFunction.parameters?.length !== 1 || declaredCarrier(sourceFunction.type) !== 'string' || declaredCarrier(sourceFunction.parameters[0].type) !== 'int')
        return undefined;
    const valueRef = ctx.galaxyConstToPreset.get(call.arguments[0].name);
    if (!valueRef)
        return undefined;
    const matches = [];
    for (const library of session.candidates.libraries.values())
        for (const preset of Object.values(library.elementsByType?.Preset ?? {})) {
            if (!preset.generateIdentifier || preset.disabled || presetIdentifierFunctionName(preset, ctx.libId) !== call.expression.name)
                continue;
            if (!preset.values.some((r) => (r.library ?? library.id) === (valueRef.library ?? ctx.libId) && r.id === valueRef.id))
                continue;
            const parameter = sourceFunction.parameters[0].name.name;
            let statements = '';
            let complete = true;
            for (const ref of preset.values) {
                const owner = session.candidates.libraries.get(ref.library ?? library.id), value = owner?.elementsByType?.PresetValue?.[ref.id];
                if (!value) {
                    complete = false;
                    break;
                }
                statements += `if (${parameter} == ${presetValueConstantName(preset, value)}) {return ${JSON.stringify(sanitizeName(value.name ?? value.id))};}\n`;
            }
            if (!complete)
                continue;
            const expected = new Parser().parseFile('generated-preset-identity.galaxy', `string expected(int ${parameter}){${statements}return null;}`);
            const expectedFunction = expected.statements[0];
            if (expected.parseDiagnostics.length || shapeText(expectedFunction.body) !== shapeText(sourceFunction.body))
                continue;
            matches.push({ library, preset });
        }
    if (matches.length !== 1)
        return undefined;
    const macros = [...session.candidates.libraries.values()].flatMap((l) => Object.values(l.elementsByType?.FunctionDef ?? {})).filter((d) => /^\s*#PRESETIDENT\(\s*[^()]+\s*\)\s*$/u.test(d.scriptCode ?? '') && d.parameters?.length === 1 && d.returnType?.type === 'string');
    if (macros.length !== 1)
        return undefined;
    const definition = macros[0];
    const parameter = makeParam({ parameterDef: { ...definition.parameters[0], type: 'ParamDef' }, preset: { ...valueRef, type: 'PresetValue' }, valueType: { type: 'preset', typeElement: { library: matches[0].library.id, id: matches[0].preset.id, type: 'Preset' } } }, ctx);
    const result = makeCall({ functionDef: { type: 'FunctionDef', library: definition.library, id: definition.id }, parameters: [parameter] }, ctx);
    session.record(call, ctx, 'LIBRARY_GUI_TEMPLATE', 'proved-contextual-PRESETIDENT', [`${definition.library}:FunctionDef:${definition.id}`], result);
    return result;
}
