import test from 'node:test';import assert from 'node:assert/strict';
import {Parser} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {proveCatalogNamespaceNotWritten as prove} from './catalog-mutation-scope.mjs';
const header='const int c_kind=9; native bool CatalogFieldValueSet(int c,string e,string f,int p,string v); native bool CatalogReferenceSet(string r,int p,string v);';
const check=text=>prove([new Parser().parseFile('catalog.galaxy',header+text)],{namespace:'User',constantName:'c_kind'});
test('Literal and readonly direct-parameter writers preserve namespace exclusion',()=>{
 const result=check('void write(int c){CatalogFieldValueSet(c,"A","B",1,"C");} void run(){write(2);}');
 assert.equal(result.writers[0].namespaces[0],'2');assert.equal(result.relays.length,1);
 assert.throws(()=>check('void f(){CatalogFieldValueSet(c_kind,"A","B",1,"C");}'),/MAY_BE_WRITTEN/);
});
test('Mutable, uninitialized and shadowing locals cannot borrow a global identity',()=>{
 for(const body of ['int c_kind;','int c_kind=9;c_kind=2;','int c_kind=Read();'])assert.throws(()=>check('void f(){'+body+'CatalogFieldValueSet(c_kind,"A","B",1,"C");}'),/CATALOG_SCOPE_/);
});
test('Reference writes and all relay call sites are checked',()=>{
 assert.equal(check('void f(){CatalogReferenceSet("Unit,A,B",1,"C");}').writers.length,1);
 assert.throws(()=>check('void w(int c){CatalogFieldValueSet(c,"A","B",1,"C");} void f(){w(2);w(c_kind);}'),/MAY_BE_WRITTEN/);
 assert.throws(()=>check('void f(){CatalogReferenceSet("User,A,B",1,"C");}'),/MAY_WRITE_NAMESPACE/);
});
test('New catalog APIs and unknown namespace expressions refuse',()=>{
 assert.throws(()=>check('void f(){CatalogUnexpectedMutation(1);}'),/UNCLASSIFIED/);
 assert.throws(()=>check('void f(){CatalogFieldValueSet(Read(),"A","B",1,"C");}'),/UNKNOWN_ARGUMENT/);
});
test('Native ABI, lexical call ownership and reference encoding are mandatory',()=>{
 assert.throws(()=>prove([new Parser().parseFile('bad.galaxy','const int c_kind=9; native bool CatalogFieldValueSet(string c,string e,string f,int p,string v); void f(){CatalogFieldValueSet("Unit","A","B",1,"C");}')],{namespace:'User',constantName:'c_kind'}),/NATIVE_ABI/);
 assert.throws(()=>check('void f(){int CatalogFieldValueSet=2;CatalogFieldValueSet(2,"A","B",1,"C");}'),/LOCAL_SHADOW/);
 assert.throws(()=>check('void f(){CatalogReferenceSet("User\\x00,A,B",1,"C");}'),/STRING_ENCODING/);
 assert.throws(()=>check('void f(){CatalogReferenceSet("User:A:B",1,"C");}'),/FORMAT_UNPROVED/);
 assert.throws(()=>check('void f(){Unknown(CatalogFieldValueSet);}'),/INDIRECT_WRITER/);
});
