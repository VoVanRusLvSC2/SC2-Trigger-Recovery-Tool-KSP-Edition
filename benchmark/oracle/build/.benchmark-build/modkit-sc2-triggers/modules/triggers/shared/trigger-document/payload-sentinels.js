/**
 * Sentinel strings used by the reversible payload transport.
 *
 * When trigger-to-galaxy encounters a FunctionCall whose FunctionDef has
 * sub-functions but no explicit structural converter, it encodes the entire
 * subtree as a JSON blob carried in trailing call arguments.  The sentinels
 * mark the start of that tail so galaxy-to-trigger can strip it back out.
 *
 * Format appended to the normal arg list:
 *   func(normalArgs..., "__MKX_SF__", N,
 *        roleToken₁, subExpr₁,
 *        roleToken₂, subExpr₂, ...)
 *
 * roleToken is either a role name ("Actions", "Conditions", …) or a
 * "__MKX_SFT__:lib:id" string encoding the raw SubFuncType reference.
 * subExpr is either a direct Galaxy expression or a
 * "__MKX_FCJSON__:<base64-json>" string carrying a fully serialised
 * FunctionCall tree that cannot be expressed as a plain expression.
 */
export const UNKNOWN_SUBFUNC_SENTINEL = '__MKX_SF__';
export const UNKNOWN_SUBFUNC_TYPE_SENTINEL = '__MKX_SFT__';
export const UNKNOWN_SUBFUNC_JSON_SENTINEL = '__MKX_FCJSON__';
