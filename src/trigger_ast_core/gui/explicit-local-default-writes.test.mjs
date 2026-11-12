import test from 'node:test';import assert from 'node:assert/strict';
import {Parser,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {retainExplicitLocalDefaultWrites as retain} from './explicit-local-default-writes.mjs';
function fixture(text){const ast=new Parser().parseFile('f.galaxy',text);assert.equal(ast.parseDiagnostics.length,0);const statements=ast.statements[0].body.statements,declarations=statements.filter(n=>n.kind===K.VariableDeclaration);return {statements,prefix:{length:statements.length-1,declarations,initializers:statements.filter(n=>n.expression?.kind===K.BinaryExpression).map(n=>({name:n.expression.left.name,expression:n.expression.right}))}};}
test('Retains every original write in order, including effects following a zero',()=>{
 const {statements,prefix}=fixture('fixed f(){fixed a;int b;a=0.0;b=Effect();return a;}'),r=retain(prefix,statements);
 assert.equal(r.length,2);assert.deepEqual(r.initializers,[]);assert.deepEqual(statements.slice(r.length),statements.slice(2));assert.equal(r.explicitLocalDefaultWriteProof.newWrites,0);
});
test('Arrays, mixed carrier defaults, inline declarations and nonzero prefixes keep their old path',()=>{
 for(const text of ['int f(){string s;int a;s="";a=0;return a;}','int f(){int[2] a;int b;b=0;return b;}','int f(){int a=0;return a;}','int f(){int a;a=2;return a;}']){
  const {statements,prefix}=fixture(text);assert.equal(retain(prefix,statements),prefix);
 }
});
