/** Match historical native Begin/while/Step/End expansions against the loaded
 * library's Begin/for/End template. Never rewrites the source AST. Emission uses
 * the original library definition. A continue anywhere in the matched body is
 * conservatively refused: moving the step into a for increment changes it.
 */
export function legacyNativeWhileTemplate(template, nativeLibraryId) {
  if (template.definition.library !== nativeLibraryId || template.nodes.length !== 3)
    return undefined;
  const [begin, loop, end] = template.nodes;
  const call = n => n?.kind === 138 && n.expression?.kind === 121 &&
    n.expression.expression?.kind === 113;
  if (!call(begin) || !call(end) || loop?.kind !== 132 || loop.initializer ||
      !loop.condition || loop.incrementor?.kind !== 121 ||
      loop.incrementor.expression?.kind !== 113 || loop.statement?.kind !== 128)
    return undefined;
  return {...template, nodes: [begin, {...loop, kind: 131,
    incrementor: undefined, condition: undefined, expression: loop.condition,
    statement: {...loop.statement, statements: [...loop.statement.statements,
      {kind: 138, expression: loop.incrementor}]}}, end]};
}

export function legacyMatchedForNodes(nodes) {
  const loop = nodes[1], body = loop.statement.statements;
  return [nodes[0], {...loop, kind: 132, expression: undefined,
    condition: loop.expression, incrementor: body.at(-1).expression,
    statement: {...loop.statement, statements: body.slice(0,-1)}}, ...nodes.slice(2)];
}

export function hasContinueStatement(nodes) {
  const pending = [...nodes];
  while (pending.length) {
    const n = pending.pop();
    if (!n || typeof n !== 'object') continue;
    if (n.kind === 134) return true;
    for (const [key, value] of Object.entries(n)) {
      if (['parent', 'symbol', 'locals', 'flowNode', 'syntaxTokens'].includes(key)) continue;
      if (Array.isArray(value)) pending.push(...value);
      else if (value && typeof value === 'object') pending.push(value);
    }
  }
  return false;
}

/** A continue in a nested loop targets that loop, not the transformed outer body. */
export function hasContinueTargetingBody(body) {
 const skip=new Set(['parent','symbol','locals','flowNode','syntaxTokens']);
 const pending=[{node:body,depth:0}];
 while(pending.length){const {node,depth}=pending.pop();if(!node||typeof node!=='object')continue;
  if(node.kind===134&&depth===0)return true;
  const childDepth=depth+([130,131,132].includes(node.kind)?1:0);
  for(const[key,value]of Object.entries(node)){if(skip.has(key))continue;
   if(Array.isArray(value))for(const n of value)pending.push({node:n,depth:childDepth});
   else if(value&&typeof value==='object')pending.push({node:value,depth:childDepth});
  }
 }
 return false;
}
