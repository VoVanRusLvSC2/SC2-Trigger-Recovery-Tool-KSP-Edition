/** Streaming traversal from the pinned template grammar; no cache. */
const semanticKeys = [
    'kind', 'name', 'type', 'modifiers', 'statements', 'parameters', 'initializer', 'expression',
    'arguments', 'left', 'right', 'operatorToken', 'operator', 'operand', 'thenStatement',
    'elseStatement', 'statement', 'condition', 'incrementor', 'body', 'properties', 'members',
    'argumentExpression', 'typeArguments', 'size', 'elementType', 'returnType',
];
export function appendSyntaxChildren(node, pending) {
    if (!node || typeof node !== 'object')
        return;
    if (Array.isArray(node)) {
        for (let i = 0; i < node.length; i++)
            pending.push(node[i]);
        return;
    }
    for (const key of semanticKeys) {
        const child = node[key];
        if (child && typeof child === 'object')
            pending.push(child);
    }
}
