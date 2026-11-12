import test from 'node:test';
import assert from 'node:assert/strict';
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {sourceLiteralForCandidate as candidate,preferSourceForForms} from './source-for-form-preference.mjs';
import {lowerStructuralForLoops} from '../passes/structural-for-loops.shared-ast.mjs';
function loops(text){const ast=new Parser().parseFile('source-loop-shape.galaxy',text);assert.equal(ast.parseDiagnostics.length,0);const result=[];const walk=n=>{if([K.ForStatement,K.WhileStatement].includes(n.kind))result.push(n);forEachChild(n,walk);};walk(ast);return result;}
test('a plain original literal for is retained as a candidate without editing its AST',()=>{
 const [loop]=loops('void Work(){int i;for(i=0;i<=10;i+=1){Use(i);}}'),before=[loop.initializer,loop.condition,loop.incrementor,loop.statement];
 const proof=candidate(loop);assert(proof);assert.equal(proof.guiBindingAuthorized,false);assert.deepEqual([loop.initializer,loop.condition,loop.incrementor,loop.statement],before);
});
test('an original while is never treated as a for, including assignment/while/step spelling',()=>{
 const [loop]=loops('void Work(){int i;i=0;while(i<=10){Use(i);i+=1;}}');assert.equal(candidate(loop),undefined);
});
test('a dynamic bound or a side-effecting increment cannot be captured by this preference',()=>{
 for(const source of ['void Work(){int i;int end;for(i=0;i<=end;i+=1){Use(i);}}','void Work(){int i;for(i=0;i<=10;i+=Next()){Use(i);}}'])assert.equal(candidate(loops(source)[0]),undefined);
});
test('wrong direction, zero step and strict-bound overflow stay on the old conservative path',()=>{
 for(const header of ['i=0;i<=10;i+=0','i=0;i<=10;i+=-1','i=0;i< -2147483648;i+=1'])assert.equal(candidate(loops('void Work(){int i;for('+header+'){Use(i);}}')[0]),undefined);
});
test('a descending literal for is a candidate while continue remains on the conservative path',()=>{
 assert(candidate(loops('void Work(){int i;for(i=10;i>=0;i+=-1){Use(i);}}')[0]));
 assert.equal(candidate(loops('void Work(){int i;for(i=0;i<=10;i+=1){continue;}}')[0]),undefined);
});
test('ambiguous/shadowed or out-of-scope counters are not inferred by name',()=>{
 for(const source of ['void Work(){int i;int i;for(i=0;i<=10;i+=1){Use(i);}}','int i;void Work(){for(i=0;i<=10;i+=1){Use(i);}}'])assert.equal(candidate(loops(source)[0]),undefined);
});

test('the real structural preprocessing keeps the original literal for and leaves its sibling while byte-exact',()=>{
 const source='void Work(){int i;for(i=0;i<=2;i+=1){Use(i);}while(i<6){i+=1;}}';
 const result=lowerStructuralForLoops(source,{nativeTemplateLoopPreserver:preferSourceForForms({proof:{},shouldPreserve:()=>false})});
 assert.equal(result.text,source);assert.equal(loops(result.text).filter(n=>n.kind===K.ForStatement).length,1);assert.equal(loops(result.text).filter(n=>n.kind===K.WhileStatement).length,1);
});

test('the preprocessing preference preserves existing qualified template decisions',()=>{
 const [loop]=loops('void Work(){int i;for(i=0;i<=10;i+=Next()){Use(i);}}'),old=preferSourceForForms({proof:{oldProfile:true},shouldPreserve:()=>true});
 assert(old.shouldPreserve([loop],0));assert.equal(old.proof.oldProfile,true);assert.equal(old.proof.sourceForFormPreference.guiBindingAuthorized,false);
});
