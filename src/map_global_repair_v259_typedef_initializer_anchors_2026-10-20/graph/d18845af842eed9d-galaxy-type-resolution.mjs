import { appendSyntaxChildren } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/syntax-child-stream.js';
/** Resolve declared aliases structurally, retaining array and reference wrappers. */
import { SyntaxKind } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import { conversionError } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import { syntaxChildren, printNode } from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C++/map_global_repair_v259_typedef_initializer_anchors_2026-10-20/graph/0facdb3525fc37a5-script-template.mjs';
/** Resolve a type DAG iteratively, retaining shared wrappers. Counters include
 * the normalization walk, not just alias lookups. */
export function resolveGalaxyTypeAliases(statements) {
    const aliases = new Map();
    for (const node of statements)
        if (node.kind === SyntaxKind.TypedefDeclaration) {
            const previous = aliases.get(node.name.name);
            if (previous && printNode(previous) !== printNode(node.type))
                conversionError('TYPE_ALIAS_CONFLICT', 'Conflicting typedef declarations', { name: node.name.name });
            aliases.set(node.name.name, node.type);
        }
    const states = new Map();
    const resolvedAliases = new Map();
    const stats = { aliasLookups: 0, typeResolutions: 0, aliasesResolved: 0, syntaxNodesVisited: 0 };
    const resolvedTypes = new WeakMap();
    const resolve = (type) => {
        if (!type || typeof type !== 'object')
            return type;
        const stack = [{ type }];
        while (stack.length) {
            const frame = stack.pop(), current = frame.type;
            if (resolvedTypes.has(current))
                continue;
            if (frame.exit) {
                let value;
                if (frame.alias) {
                    value = resolvedTypes.get(aliases.get(frame.alias));
                    resolvedAliases.set(frame.alias, value);
                    states.set(frame.alias, 'resolved');
                    stats.aliasesResolved++;
                }
                else if (current.kind === SyntaxKind.ArrayType) {
                    value = { ...current, elementType: resolvedTypes.get(current.elementType) ?? current.elementType };
                }
                else {
                    value = { ...current, typeArguments: current.typeArguments.map((argument) => resolvedTypes.get(argument) ?? argument) };
                }
                resolvedTypes.set(current, value);
                resolvedTypes.set(value, value);
                continue;
            }
            stats.typeResolutions++;
            const name = current.kind === SyntaxKind.Identifier ? current.name : undefined;
            if (name && aliases.has(name)) {
                stats.aliasLookups++;
                if (states.get(name) === 'visiting')
                    conversionError('TYPE_ALIAS_CYCLE', 'Cyclic typedef declarations', { name });
                if (states.get(name) === 'resolved') {
                    resolvedTypes.set(current, resolvedAliases.get(name));
                }
                else {
                    states.set(name, 'visiting');
                    stack.push({ type: current, exit: true, alias: name }, { type: aliases.get(name) });
                }
            }
            else if (current.kind === SyntaxKind.ArrayType || current.typeArguments) {
                stack.push({ type: current, exit: true });
                const children = current.kind === SyntaxKind.ArrayType ? [current.elementType] : current.typeArguments;
                for (let index = children.length - 1; index >= 0; index--)
                    if (children[index] && typeof children[index] === 'object')
                        stack.push({ type: children[index] });
            }
            else {
                resolvedTypes.set(current, current);
            }
        }
        return resolvedTypes.get(type);
    };
    // Diagnose unused cycles too, rather than depending on which body is visited.
    for (const name of aliases.keys())
        resolve({ kind: SyntaxKind.Identifier, name });
    const visited = new WeakSet();
    const pending = [...statements];
    while (pending.length) {
        const node = pending.pop();
        if (!node || typeof node !== 'object' || visited.has(node))
            continue;
        visited.add(node);
        stats.syntaxNodesVisited++;
        if (node.type)
            node.type = resolve(node.type);
        appendSyntaxChildren(node, pending);
    }
    return stats;
}
