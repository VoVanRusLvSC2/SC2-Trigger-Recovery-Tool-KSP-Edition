import {formalPresetRefs,presetDomain} from "../../bindings/formal-preset-domain.mjs";
import {parseImmutableGalaxySyntax} from "./immutable-galaxy-syntax.mjs";
import {SyntaxKind as K} from "./index-alternate-3.js";

// Compare complete expressions, not substrings or calculated values. Numeric
// spelling and argument order are retained; no algebraic rewrites are allowed.
export function expressionShape(node, nativeCall) {
  if (!node) return undefined;
  if (node.kind===K.ParenthesizedExpression) return expressionShape(node.expression,nativeCall);
  if ([K.NumericLiteral,K.StringLiteral].includes(node.kind)) return [node.kind,node.text??node.value];
  if ([K.TrueKeyword,K.FalseKeyword,K.NullKeyword].includes(node.kind)) return [node.kind];
  if (node.kind===K.PrefixUnaryExpression && [K.PlusToken,K.MinusToken,K.ExclamationToken,K.TildeToken].includes(node.operator?.kind)) {
    const operand=expressionShape(node.operand,nativeCall);
    return operand&&[node.kind,node.operator.kind,operand];
  }
  if (node.kind===K.BinaryExpression && [K.PlusToken,K.MinusToken,K.AsteriskToken,K.SlashToken,K.PercentToken,K.CaretToken,K.AmpersandToken,K.BarToken,K.LessThanLessThanToken,K.GreaterThanGreaterThanToken].includes(node.operatorToken?.kind)) {
    const left=expressionShape(node.left,nativeCall),right=expressionShape(node.right,nativeCall);
    return left&&right&&[node.kind,node.operatorToken.kind,left,right];
  }
  if (node.kind!==K.CallExpression||node.expression?.kind!==K.Identifier||!nativeCall(node.expression.name)) return undefined;
  const args=Array.from(node.arguments??[],arg=>expressionShape(arg,nativeCall));
  return args.every(Boolean)?[node.kind,node.expression.name,args]:undefined;
}

/** Prefer a declared preset for an exact, closed native expression. Unknown
 * symbols, scope shadowing, missing domains and ambiguous identities fall back
 * to ordinary expression recovery, never to an arbitrary preset. */
export function resolveFormalExpressionPreset(node,formal,owner,{resolve,nativeCall}) {
  const shape=expressionShape(node,nativeCall);
  if (!shape||shape[0]!==K.CallExpression) return undefined;
  const wanted=JSON.stringify(shape),matches=new Map();
  for (const ref of formalPresetRefs(formal,owner)) {
    const domain=presetDomain(ref,resolve);
    if (!domain.valid) return undefined;
    for (const value of domain.values) {
      const text=value.element.value;
      if (typeof text!=='string'||!text.includes('(')) continue;
      const tree=parseImmutableGalaxySyntax(`void PresetProbe(){${text};}`,'preset-expression.galaxy');
      const statements=tree.statements?.[0]?.body?.statements;
      if (tree.parseDiagnostics.length||tree.statements?.length!==1||statements?.length!==1||statements[0].kind!==K.ExpressionStatement) continue;
      const candidate=expressionShape(statements[0].expression,nativeCall);
      if (candidate&&JSON.stringify(candidate)===wanted) matches.set(JSON.stringify([value.ref.library,value.ref.type,value.ref.id]),value.ref);
    }
  }
  return matches.size===1?[...matches.values()][0]:undefined;
}

export function formalExpressionPreset(node,formalRef,ctx) {
  if (!formalRef) return undefined;
  const libraries=new Map(ctx.dependencyLibraries);
  if (ctx.nativeLibrary) libraries.set(ctx.nativeLibrary.id,ctx.nativeLibrary);
  libraries.set(ctx.libId,{elements:ctx.elements});
  const resolve=(ref,owner,type)=>{
    const library=ref.library??owner,es=libraries.get(library)?.elements;
    const found=es?.[type+':'+ref.id]??es?.[ref.id];
    return found?.type===type&&(found.library??library)===library?found:undefined;
  };
  const formal=resolve(formalRef,ctx.libId,'ParamDef');
  if (!formal) return undefined;
  const nativeCall=name=>![ctx.paramRefByGalaxyName,ctx.localVarByGalaxyName,ctx.globalVarByGalaxyName,ctx.structuredAutoAccessors]
    .some(scope=>scope?.has(name))&&ctx.funcNameToFuncDef?.get(name)?.flags?.includes('Native')===true;
  return resolveFormalExpressionPreset(node,formal,formal.library??formalRef.library??ctx.libId,{resolve,nativeCall});
}
