// Galaxy global int storage starts at zero. An explicit literal zero in a
// mutable global declaration adds neither a value nor a side effect. Remove
// only that redundant header initializer, never an InitGlobals assignment.
// The variable remains mutable GUI data; no later reset is introduced here.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=t=>createHash('sha256').update(t).digest('hex');
export function lowerRedundantGlobalIntegerZeros(source,document){
 const ast=(document?document.input(source):new Parser().parseFile('global-zero-input.galaxy',source));assert.equal(ast.parseDiagnostics.length,0,'INVALID_SOURCE');
 const globals=ast.statements.filter(n=>n.kind===K.VariableDeclaration),counts=new Map();for(const n of globals)counts.set(n.name.name,(counts.get(n.name.name)??0)+1);
 const edits=[],records=[];
 for(const n of globals){
  if(n.type?.kind!==K.IntKeyword||n.initializer?.kind!==K.NumericLiteral||counts.get(n.name.name)!==1||(n.modifiers??[]).some(m=>m.kind===K.ConstKeyword))continue;
  const literal=String(n.initializer.text??n.initializer.value);if(literal.length>32||!/^(?:0[xX]0+|0+)$/u.test(literal))continue;
  const equals=(n.syntaxTokens??[]).filter(t=>t.kind===K.EqualsToken);assert.equal(equals.length,1,'GLOBAL_EQUALS_TOKEN_NOT_UNIQUE');
  assert.equal(source[equals[0].pos],'=','GLOBAL_EQUALS_TOKEN_CHANGED');
  assert.equal(source.slice(n.initializer.pos,n.initializer.pos+literal.length),literal,'GLOBAL_ZERO_LITERAL_CHANGED');
  edits.push({start:equals[0].pos,end:equals[0].pos+1,before:'=',replacement:' '},{start:n.initializer.pos,end:n.initializer.pos+literal.length,before:literal,replacement:' '.repeat(literal.length)});
  records.push({name:n.name.name,type:'int',declarationPosition:n.pos,originalInitializer:literal,implicitGlobalValue:0,explicitInitializerValue:0,initializerHasNoSideEffects:true,constantFlagAdded:false,variableRemainsMutable:true,executableAssignmentsUntouched:true,triviaPreserved:true});
 }
 edits.sort((a,b)=>a.start-b.start);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'OVERLAPPING_GLOBAL_ZERO_EDITS');
 let text=source;for(const e of [...edits].reverse()){assert.equal(text.slice(e.start,e.end),e.before);text=text.slice(0,e.start)+e.replacement+text.slice(e.end);}
 assert.equal(text.length,source.length,'GLOBAL_ZERO_POSITION_DRIFT');
 assert.equal((document?document.output(text):new Parser().parseFile('global-zero-output.galaxy',text)).parseDiagnostics.length,0,'INVALID_LOWERED_SOURCE');
 return{text,proof:{kind:'REDUNDANT_MUTABLE_GLOBAL_INT_LITERAL_ZERO',sourceSha256:sha(source),outputSha256:sha(text),changed:records.length>0,records,edits,sourcePositionsPreserved:true,originalArchiveChanged:false,persistentCache:false}};
}
