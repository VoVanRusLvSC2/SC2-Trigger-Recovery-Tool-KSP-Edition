import {canonicalLocalInitializerSequence} from './local-initializer-sequence.shared-passive-storage.mjs';
import {canonicalIndependentLocalDeclarations} from './local-declaration-order.passive-storage.mjs';
import {canonicalBoundPrivateLexicalNames} from './bound-private-lexical-alpha.first-use.mjs';
import {canonicalExpressionGrouping} from './expression-grouping-proof.typedef-terminators.mjs';

// A comparison view: separate passive entry storage from ordered executable
// initializers, then alpha-convert bound local/formal cells. Every operation,
// type, member, global, value and caller ABI remains for the complete oracle.
export function canonicalPrivateFunctionEntryFrame(source,context={}){
  const initializers=canonicalLocalInitializerSequence(source);
  const order=canonicalIndependentLocalDeclarations(initializers.text);
  const alpha=canonicalBoundPrivateLexicalNames(order.text,context);
  const grouping=canonicalExpressionGrouping(alpha.text);
  return {text:grouping.text,proof:{kind:'PASSIVE_FUNCTION_ENTRY_STORAGE_AND_BOUND_LEXICAL_IDENTITIES',
    initializers:initializers.proof,order:order.proof,alpha:alpha.proof,grouping:grouping.proof,
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false}};
}
