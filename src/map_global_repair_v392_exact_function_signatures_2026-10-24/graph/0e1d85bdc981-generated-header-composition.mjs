// Expand only the SDK-issued header document, at its actual include position.
// Prefixing the header to the script silently changes module initialization order.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax as parse} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/7fa3255fd104-immutable-galaxy-syntax.mjs';
import {readStringLiteralValue} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/c08bba33eae3-string-literal-value.mjs';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function composeGeneratedHeader({script,header='',libraryId}){
  assert(/^[A-Za-z0-9_]+$/u.test(libraryId),'GENERATED_HEADER_LIBRARY_ID_REQUIRED');
  const path=`Lib${libraryId}_h`,ast=parse(script,'generated-script'),headerAst=parse(header,'generated-header');
  assert.equal(ast.parseDiagnostics.length,0);assert.equal(headerAst.parseDiagnostics.length,0);
  const matches=nodes=>nodes.filter(node=>node.kind===K.IncludeStatement&&readStringLiteralValue(node.path.text)?.value===path);
  const references=matches(ast.statements);assert(references.length<=1,'DUPLICATE_GENERATED_HEADER_REFERENCE');
  assert.equal(matches(headerAst.statements).length,0,'RECURSIVE_GENERATED_HEADER_REFERENCE');
  const reference=references[0];
  const text=reference?script.slice(0,reference.pos)+header+'\n'+script.slice(reference.end):script;
  assert.equal(parse(text,'generated-composition').parseDiagnostics.length,0);
  return {text,proof:{kind:'SDK_HEADER_AT_ISSUED_INCLUDE_SLOT',libraryId,headerPath:path,
    scriptSha256:sha(script),headerSha256:sha(header),outputSha256:sha(text),headerLoaded:!!reference,
    ...(reference?{reference:{start:reference.pos,end:reference.end,source:script.slice(reference.pos,reference.end)}}:{}),
    allScriptBytesOutsideTheHeaderReferenceRetained:true,headerBytesRetainedExactlyOnce:!!reference,
    unreferencedHeaderNotInvented:!reference,sourceOrArchiveChanged:false}};
}
