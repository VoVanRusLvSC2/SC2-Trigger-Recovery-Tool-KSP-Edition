import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canonicalOverwrittenLocalInitializations as project} from './overwritten-local-array-fill.mjs';
const header='native void Observe(abilcmd a); native abilcmd Make(int index);';
const source=(writes,reads='Observe(a[1]);Observe(a[2]);')=>header+'void F(){int i;abilcmd[3] a;int j;for(i=0;i<=2;i+=1){a[i]=null;}'+writes+reads+'}';
test('null fill is dead when every observed cell is overwritten, without VM defaults',()=>{
 const s=source('for(j=1;j<=2;j+=1){a[j]=Make(j);}'),r=project(s);assert.equal(r.proof.records.length,1);assert(!r.text.includes('a[i]=null'));assert(r.text.includes('a[j]=Make(j)'));assert.equal(r.proof.defaultsAssumed,false);
});
test('explicit counted while with a terminal break proves the same cells',()=>{
 const r=project(source('j=1;while(j<=2){a[j]=Make(j);if(j==2){break;}j=j+1;}'));assert.equal(r.proof.records.length,1);
});
test('unwritten cell, prior read, and dynamic index retain the fill',()=>{
 for(const s of [source('a[1]=Make(1);'),source('Observe(a[1]);a[1]=Make(1);a[2]=Make(2);'),source('a[1]=Make(1);a[2]=Make(2);j=Unknown();','Observe(a[j]);')]){const r=project(s);assert.equal(r.proof.records.length,0);assert.equal(r.text,s);}
});
test('both paths must overwrite a cell before an observed read',()=>{
 const yes=source('if(Unknown()){a[1]=Make(1);}else{a[1]=Make(2);}a[2]=Make(2);');assert.equal(project(yes).proof.records.length,1);
 const no=source('if(Unknown()){a[1]=Make(1);}a[2]=Make(2);');assert.equal(project(no).proof.records.length,0);
});
test('counter use outside fill, incomplete fill, escapes and nontermination refuse',()=>{
 const s=source('a[1]=Make(1);a[2]=Make(2);');for(const changed of [s.replace('a[1]=Make(1);','j=i;a[1]=Make(1);'),s.replace('i<=2','i<=1'),s.replace('a[1]=Make(1);','Escape(a);a[1]=Make(1);'),s.replace('a[1]=Make(1);','while(true){}a[1]=Make(1);')])assert.equal(project(changed).proof.records.length,0);
});
test('no-op null fill values are not inferred for nominal arrays or globals',()=>{
 for(const s of ['abilcmd[3] a;'+source('a[1]=Make(1);a[2]=Make(2);').replace('abilcmd[3] a;',''),source('a[1]=Make(1);a[2]=Make(2);').replaceAll('abilcmd[3]','Opaque[3]')])assert.equal(project(s).proof.records.length,0);
});
test('short-circuit writes and unmodelled index mutations cannot establish dominance',()=>{
 for(const writes of ['Unknown()&&(a[1]=Make(1));a[2]=Make(2);','j=1;j++;a[j]=Make(1);a[2]=Make(2);','j=1;j*=2;a[j]=Make(1);a[2]=Make(2);','j=1;Make(j=2);a[j]=Make(1);a[2]=Make(2);']){
  const s=source(writes);assert.equal(project(s).text,s);
 }
});
test('scalar literal stores need the same must-overwrite proof inside counted loops',()=>{
 const s='native void ObserveText(string s);void F(){string s;int i;s=null;for(i=1;i<=2;i+=1){s="new";ObserveText(s);}}';
 const r=project(s);assert.equal(r.proof.records.length,1);assert(!r.text.includes('s=null'));assert(r.text.includes('s="new"'));
 for(const bad of [s.replace('i=1;i<=2','i=3;i<=2').replace('}}','}ObserveText(s);}'),s.replace('s="new";ObserveText(s);','ObserveText(s);s="new";')])assert.equal(project(bad).proof.records.length,0,JSON.stringify({bad,proof:project(bad).proof.records}));
});
