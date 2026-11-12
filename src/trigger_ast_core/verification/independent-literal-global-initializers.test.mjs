import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizeIndependentLiteralGlobalInitializers as project} from './independent-literal-global-initializers.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
const a='trigger t=null;const int n=2;bool b=false;void InitMap(){}',b='bool b=false;const int n=2;trigger t=null;void InitMap(){}';
test('independent primitive literal initialization order canonicalizes as one whole program',async()=>{
 const p=project(a,b),o=await openPinnedUserOracle();assert(!p.proof.refused);assert((await o.compare(p.before,p.after)).exact);await o.verify();
});
test('changed value or missing declaration remains unequal after canonicalization',async()=>{
 const o=await openPinnedUserOracle();for(const t of [b.replace('n=2','n=3'),b.replace('bool b=false;','')]){const p=project(a,t);assert(!(await o.compare(p.before,p.after)).exact);}await o.verify();
});
test('runtime calls, mutable reads and updates in any intervening external initializer forbid reordering',()=>{
 for(const text of ['int seen=Read();','int seen=n;','int seen=(n=4);','int seen=n++;']){
  const p=project(a,b,[{fileName:'External.galaxy',text}]);
  // Reading n is permitted only if n is const, which this fixture declares.
  if(text==='int seen=n;')assert(!p.proof.refused);else{assert.match(p.proof.refused,/EXTERNAL|SOURCE_SYNTAX/);assert.equal(p.before,a);}
 }
 const p=project('int n=2;'+a.replace('const int n=2;',''),'int n=2;'+b.replace('const int n=2;',''),[{fileName:'External.galaxy',text:'int seen=n;'}]);assert.match(p.proof.refused,/MUTABLE_READ/);
});
test('root nonliteral initialization and cyclic or unknown constant references remain unproved',()=>{
 for(const text of [a.replace('n=2','n=Other'),a.replace('t=null','t=Create()')])assert(project(text,b).proof.refused);
 for(const text of ['const int x=y;const int y=x;int z=x;','const int x=Unknown;int z=x;'])assert(project(a,b,[{fileName:'External.galaxy',text}]).proof.refused);
 const p=project(a,b,[{fileName:'External.galaxy',text:'const int bits=1;const int flags=bits << 2;int z=flags;'}]);assert(!p.proof.refused);
 assert(!project(a,b,[{fileName:'External.galaxy',text:'const int bits=-1;const bool yes=!false;int z=bits;bool okay=yes;'}]).proof.refused);
});
