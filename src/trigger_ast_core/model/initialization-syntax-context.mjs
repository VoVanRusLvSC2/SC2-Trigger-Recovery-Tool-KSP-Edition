// One immutable syntax document per current file revision in this proof only.
// This shares input ASTs, never a previous validation result or runtime value.
import assert from 'node:assert/strict';
import {parseImmutableGalaxySyntax,hasImmutableGalaxyOrigin} from './immutable-galaxy-syntax.collections.mjs';

export function createInitializationSyntaxContext() {
  const documents = new Map();
  const metrics = {requests:0,parsed:0,reused:0,persistentCache:false};
  function parse(text,fileName) {
    assert.equal(typeof text,'string','INITIALIZATION_SOURCE_TEXT_REQUIRED');
    assert.equal(typeof fileName,'string','INITIALIZATION_SOURCE_NAME_REQUIRED');
    metrics.requests++;
    const document = documents.get(fileName);
    if (document?.text === text) {
      assert(hasImmutableGalaxyOrigin(document.ast,text,fileName),'UNTRUSTED_REUSED_INITIALIZATION_SYNTAX');
      metrics.reused++;
      return document.ast;
    }
    const ast = parseImmutableGalaxySyntax(text,fileName);
    assert.equal(ast.parseDiagnostics.length,0,'INITIALIZATION_SYNTAX_INVALID');
    documents.set(fileName,{text,ast});
    metrics.parsed++;
    return ast;
  }
  return Object.freeze({parse,metrics:()=>({...metrics,documents:documents.size})});
}
