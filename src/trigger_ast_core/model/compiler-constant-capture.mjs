// The entry pass may already have indexed a const initializer. That is not a
// second assignment. Require the very same source AST node before consuming it.
export function matchesConstLoopCapture({initializer,pendingExpression,isConst,assignments,uses,loopUses,unwrap}) {
 if (!initializer || !isConst || assignments !== 0 || uses !== loopUses) return false;
 return pendingExpression === undefined || unwrap(pendingExpression) === initializer;
}
