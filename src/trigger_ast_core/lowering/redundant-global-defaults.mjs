// Conversion-input normalization only. Galaxy global bool/trigger storage
// already has false/null respectively. Erase only that literal header value;
// preserve executable assignments, mutability, trivia and source positions.
import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {getTypeName,unwrapArrayType} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
const sha=t=>createHash('sha256').update(t).digest('hex');
export function lowerRedundantGlobalDefaults(source){
 const parse=t=>{const a=new Parser().parseFile('global-defaults',t);assert.equal(a.parseDiagnostics.length,0,'INVALID_GLOBAL_DEFAULT_SOURCE');return a;},ast=parse(source),declarations=ast.statements.filter(n=>n.kind===K.VariableDeclaration),counts=new Map(),edits=[],records=[];
 for(const n of declarations)counts.set(n.name.name,(counts.get(n.name.name)??0)+1);
 for(const n of declarations){
  if(!n.initializer||n.modifiers?.length||counts.get(n.name.name)!==1||unwrapArrayType(n.type).sizes.length)continue;
  const type=getTypeName(n.type),literal=type==='bool'&&n.initializer.kind===K.FalseKeyword?'false':type==='trigger'&&n.initializer.kind===K.NullKeyword?'null':undefined;
  if(!literal)continue;const equals=n.syntaxTokens?.filter(t=>t.kind===K.EqualsToken);assert.equal(equals?.length,1);assert.equal(source[equals[0].pos],'=');assert.equal(source.slice(n.initializer.pos,n.initializer.pos+literal.length),literal);
  edits.push({start:equals[0].pos,end:equals[0].pos+1,before:'=',replacement:' '},{start:n.initializer.pos,end:n.initializer.pos+literal.length,before:literal,replacement:' '.repeat(literal.length)});
  records.push({name:n.name.name,type,explicitLiteral:literal,implicitGlobalDefault:literal,headerExpressionHasNoEffects:true,executableAssignmentsUnchanged:true,variableRemainsMutable:true});
 }
 edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start);let text=source;
 for(const e of [...edits].reverse()){assert.equal(text.slice(e.start,e.end),e.before);text=text.slice(0,e.start)+e.replacement+text.slice(e.end);}
 assert.equal(text.length,source.length);parse(text);return{text,proof:{kind:'REDUNDANT_GLOBAL_BOOL_FALSE_TRIGGER_NULL',sourceSha256:sha(source),outputSha256:sha(text),records,sourcePositionsPreserved:true,originalSourceOrArchiveWritten:false,persistentCache:false}};
}
