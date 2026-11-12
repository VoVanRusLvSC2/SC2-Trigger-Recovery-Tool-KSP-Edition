import test from'node:test';import assert from'node:assert/strict';import{canonicalConstantRangeSnapshots as view}from'./constant-range-snapshot.closed-proof.mjs';import{openPinnedUserOracle}from'./pinned-user-oracle.mjs';
const source='const int Limit=2;int out;void Work(){int i;for(i=0;i<=Limit;i+=1){out+=i;}}';
const capture='const int Limit=2;int out;void Work(){int j;const int e=Limit;const int d=1;j=0;for(;((d>=0&&j<=e)||(d<0&&j>=e));j+=d){out+=j;}}';
test('closes exact immutable snapshot without changing source and preserves whole loop',()=>{const r=view(capture);assert.equal(r.proof.records.length,1);assert(r.proof.byteInverseVerified);assert(r.text.includes('j <= Limit'));assert(r.text.includes('j += 1'));assert(r.text.includes('out += j'));assert.equal(r.proof.wholeMapAccepted,false)});
test('different bound, mutated/unknown bound, zero step or extra snapshot observations never qualify',()=>{for(const x of [capture.replace('const int Limit=2','int Limit=2'),capture.replace('e=Limit','e=Unknown'),capture.replace('d=1','d=0'),capture.replace('out+=j','out+=e'),capture.replace('out+=j','out+=d'),capture.replace('j<=e','j<e'),capture.replace('j+=d','j+=2')])assert.equal(view(x).proof.records.length,0,x)});
test('unclosed includes and non-literal reset refuse',()=>{assert.equal(view('include "missing"\n'+capture).proof.reason,'INCOMPLETE_INCLUDE_CLOSURE');assert.equal(view(capture.replace('j=0','j=Next()')).proof.records.length,0)});
test('continue and break remain inside the same for body without rewriting a while',()=>{for(const extra of ['if(j==1){continue;}','if(j==1){break;}']){const text=capture.replace('out+=j;',extra+'out+=j;')+'void More(){int k;k=0;while(k<2){k+=1;}}';const r=view(text);assert.equal(r.proof.records.length,1);assert(r.text.includes(extra.includes('continue')?'continue;':'break;'));assert(r.text.includes('while(k<2){k+=1;}'))}});
test('the unchanged oracle still rejects a changed step, bound or body',async()=>{const oracle=await openPinnedUserOracle();const normalized=view(capture).text;for(const changed of [normalized.replace('Limit=2','Limit=3'),normalized.replace('out += j','out += j+1')])assert.equal((await oracle.compare(source,changed)).exact,false);assert.equal(oracle.assets,304);await oracle.verify()});
test('local source constants are refused because declaration order can matter',()=>{
 const local='int out;void Work(){int j;const int e=Limit;const int Limit=2;const int d=1;j=0;for(;((d>=0&&j<=e)||(d<0&&j>=e));j+=d){out+=j;}}';assert.equal(view(local).proof.records.length,0);
});
test('shadowed bound name is refused before moving a read to a loop condition',()=>{
 const s='const int Limit=2;int out;void Work(){int j;const int e=Limit;const int d=1;{int Limit;}j=0;for(;((d>=0&&j<=e)||(d<0&&j>=e));j+=d){out+=j;}}';assert.equal(view(s).proof.records.length,0);
});
test('assignment-form counter increment is accepted only for the same counter and step',()=>{
 const s=capture.replace('j+=d','j=j+d');assert.equal(view(s).proof.records.length,1);assert.equal(view(s.replace('j=j+d','j=out+d')).proof.records.length,0);
});
test('bound global writes and unknown reference-taking uses fail closed',()=>{
 assert.equal(view(capture+'void Mutate(){Limit=4;}').proof.records.length,0);
 assert.equal(view(capture+'void Call(){Mystery(Limit);}').proof.records.length,0);
});
test('an included constant requires exact reachable ownership and rejects writes in that source',()=>{
 const root=capture.replace('const int Limit=2;','include "dep"\n');const context=dep=>({ownedSources:[{fileName:'dep.galaxy',text:dep}],includeEvidence:[{from:'MapScript.galaxy',include:'dep',path:'dep.galaxy',layerId:'fixture'}]});
 const yes=view(root,context('const int Limit=2;'));assert.equal(yes.proof.records.length,1);assert.equal(yes.proof.records[0].boundDeclaration.sourceFile,'dep.galaxy');
 const no=view(root,context('const int Limit=2;void Change(){Limit=3;}'));assert.equal(no.proof.records.length,0);
});
