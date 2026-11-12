import { parseGalaxySource } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v548_partition_declaration_identity_2026-10-29/graph/0b160ad329af-d83e8d2def-811635a7772277-74610374c2838123-bc62bf7a2557-08712ad196f2-galaxy-to-trigger.mjs";
import { getTypeName } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v487_native_expression_identity_2026-10-27/graph/39db0c9c9123-ae8e39bac3e6-0131c278e7d7-3449b17ca5f9-174ab517065c-g2t-core.generated-call-provenance.mjs";
import { SyntaxKind as K, forEachChild } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js";
/** Evidence authorizes an equality operation; its ABI comes exclusively from
 * the unique actual current native prototype and loaded legacy GUI owner.
 * No alias suffix rule or generic API signature catalog is used.
 */
export function deriveVerifiedGetterHeader(input) {
    if (input.hashText(input.proofText) !== input.expectedProofContentSha256 || input.proofContentSha256 !== input.expectedProofContentSha256)
        throw new Error('Exact operation evidence bytes changed');
    const operationEvidence = JSON.parse(input.proofText);
    if (input.actualEditorSha256 !== operationEvidence.identity.sha256 || operationEvidence.identity.version.build !== 98310 || operationEvidence.implementationEqualityProved !== true)
        throw new Error('Exact existing getter-operation evidence or Editor identity changed');
    const source = parseGalaxySource(input.sourceText, 'MapScript.galaxy'), ownedNames = new Set(), calls = new Map();
    const isNamed = (node) => [K.FunctionDeclaration, K.VariableDeclaration, K.ParameterDeclaration, K.StructDeclaration, K.TypedefDeclaration].includes(node.kind);
    const isCall = (node) => node.kind === K.CallExpression;
    const isIdentifier = (node) => node.kind === K.Identifier;
    const isFunction = (node) => node.kind === K.FunctionDeclaration;
    const visit = (node) => {
        if (isNamed(node) && node.name?.name)
            ownedNames.add(node.name.name);
        if (isCall(node) && isIdentifier(node.expression)) {
            const group = calls.get(node.expression.name) ?? [];
            group.push(node.arguments.length);
            calls.set(node.expression.name, group);
        }
        forEachChild(node, visit);
    };
    for (const node of source.statements)
        visit(node);
    const prototypes = new Map();
    for (const declarationSource of input.declarations) {
        if (input.hashText(declarationSource.text) !== declarationSource.contentSha256)
            throw new Error('Actual declaration source SHA changed');
        const parsed = parseGalaxySource(declarationSource.text, declarationSource.fileName);
        for (const node of parsed.statements)
            if (isFunction(node)) {
                const group = prototypes.get(node.name.name) ?? [];
                group.push({ declaration: node, source: declarationSource });
                prototypes.set(node.name.name, group);
            }
    }
    const declarations = [], evidence = [];
    for (const name of new Set(input.missingSymbols)) {
        const facts = operationEvidence.pairs.filter(pair => pair.names.some(alias => alias.name === name));
        if (facts.length !== 1)
            throw new Error('Unproved or ambiguous native alias: ' + name);
        const fact = facts[0];
        if (fact.names.length !== 2 || fact.argCount !== 0 || fact.sameCanonicalReturnPath !== true || fact.equivalentNativeOperation !== true || JSON.stringify(fact.names[0].canonicalPath) !== JSON.stringify(fact.names[1].canonicalPath))
            throw new Error('Nullary operation equality is incomplete');
        if (ownedNames.has(name) || prototypes.has(name) || !calls.has(name) || calls.get(name).some(count => count !== 0))
            throw new Error('Alias is declared/shadowed or its original call signature differs');
        const currentNames = fact.names.filter(alias => alias.name !== name && prototypes.has(alias.name));
        if (currentNames.length !== 1)
            throw new Error('Unique actual current native prototype is absent');
        const current = currentNames[0], owners = prototypes.get(current.name);
        if (owners.length !== 1)
            throw new Error('Current native source owner is ambiguous');
        const { declaration: fn, source: owner } = owners[0];
        if (fn.body || fn.parameters.length !== 0 || !fn.modifiers?.some(m => m.kind === K.NativeKeyword))
            throw new Error('Actual current prototype is not the proved nullary native');
        const candidates = [];
        for (const library of input.libraries.values())
            for (const candidate of Object.values(library.elementsByType.FunctionDef ?? {}))
                if (candidate.name === name)
                    candidates.push(candidate);
        const gui = candidates[0], returnType = getTypeName(fn.type);
        if (candidates.length !== 1 || !gui.library || !gui.flags?.includes('Native') || !gui.flags.includes('Call') || gui.parameters?.length !== 0 || gui.returnType?.type !== returnType)
            throw new Error('Unique actual legacy GUI getter/return owner is absent or incompatible');
        if (!/^[A-Za-z_][A-Za-z0-9_]*$/u.test(name) || !['int', 'unit'].includes(returnType))
            throw new Error('Unsupported actual getter carrier');
        const text = `native ${returnType} ${name} ();`;
        declarations.push(text);
        evidence.push({ alias: name, current: current.name, prototypeSource: owner.fileName, prototypeSourceSha256: owner.contentSha256, returnType, parameters: [], guiOwner: `${gui.library}:FunctionDef:${gui.id}`, proofSha256: input.proofContentSha256, editorSha256: input.actualEditorSha256, originalCallNamePreserved: true });
    }
    return { text: declarations.join('\n') + '\n', evidence };
}
