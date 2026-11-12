/** Statement positions may expand to several statements; expression positions
 * must keep using the expression converter and its strict grammar. Dependencies
 * are supplied by the owning runtime graph so module-local state stays local. */
export function emitFunctionCallStatements(call, context, {inline, template, expression, statement}) {
  if (inline(call, context)) {
    const nodes = template(call, context);
    return Array.isArray(nodes) ? nodes : nodes === undefined ? [] : [nodes];
  }
  const node = expression(call, context);
  return node === undefined ? [] : [statement(node)];
}
