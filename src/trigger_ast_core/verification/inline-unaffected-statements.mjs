import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {assertExactAstShape} from './exact-ast-shape.mjs';
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens']);
const sha=s=>createHash('sha256').update(s).digest('hex');
const parse=text=>{const a=new Parser().parseFile('inline-proof.galaxy',text);assert.equal(a.parseDiagnostics.length,0,'INLINE_PROOF_PARSE');return a;};

/** Independent, deliberately partial obligation: no statement outside the
 * source-bound helper/caller set changed. This does not prove an arbitrary
 * replacement caller body, and must never be used as a whole-map PASS gate. */
export function verifyInlineUnaffectedStatements(before,after,records){
  assert(Array.isArray(records)&&records.length>0,'INLINE_RECORDS_REQUIRED');
  const left=parse(before),right=parse(after),helpers=new Set(),callers=new Set();
  for(const record of records){
    assert.equal(record.source.contentSha256,sha(before),'INLINE_ORIGINAL_IDENTITY_CHANGED');
    const helper=left.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.pos===record.source.start&&n.end===record.source.end);
    assert.equal(helper.length,1,'INLINE_HELPER_SPAN_NOT_UNIQUE');helpers.add(helper[0].name.name);
    for(const instance of record.instances){
      assert.equal(instance.caller.contentSha256,sha(before),'INLINE_CALLER_IDENTITY_CHANGED');
      const caller=left.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.pos===instance.caller.start&&n.end===instance.caller.end);
      assert.equal(caller.length,1,'INLINE_CALLER_SPAN_NOT_UNIQUE');callers.add(caller[0].name.name);
    }
  }
  assert([...helpers].every(n=>!callers.has(n)),'INLINE_OWNER_SETS_OVERLAP');
  assert(!right.statements.some(n=>n.kind===K.FunctionDeclaration&&helpers.has(n.name.name)),'INLINE_HELPER_NOT_REMOVED');
  for(const name of callers){
    const a=left.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===name);
    const b=right.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body&&n.name.name===name);
    assert.equal(a.length,1);assert.equal(b.length,1);
    assertExactAstShape({...a[0],body:undefined},{...b[0],body:undefined},{ignoredFields:ignored,label:'INLINE_CALLER_SIGNATURE_CHANGED'});
  }
  const retain=n=>n.kind!==K.FunctionDeclaration||!helpers.has(n.name.name)&&!(n.body&&callers.has(n.name.name));
  const a=left.statements.filter(retain),b=right.statements.filter(retain);
  const exact=assertExactAstShape(a,b,{ignoredFields:ignored,label:'INLINE_UNRELATED_STATEMENT_CHANGED'});
  return {kind:'INLINE_UNAFFECTED_STATEMENTS',exactOutsideInlineOwners:true,examinedPairs:exact.examinedPairs,
    unchangedStatements:a.length,unchangedFunctions:a.filter(n=>n.kind===K.FunctionDeclaration&&n.body).length,
    changedCallers:[...callers],removedHelpers:[...helpers],callerBusinessEquivalenceProved:false,wholeMapAccepted:false};
}
