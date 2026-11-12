import test from 'node:test';import assert from 'node:assert/strict';
import {planInheritedStandardBases as plan} from './dependency-inherited-standard-bases.mjs';
const standard=r=>r.startsWith('std:'),edge=(reference,child)=>({reference,child});
test('an already dominating direct parent base does not change host layer order',()=>{
 const r=plan({root:'host',isStandard:standard,nodes:[{id:'host',dependencies:[edge('std:base'),edge('file:child','child')]},{id:'child',metadataGap:true,dependencies:[]}]});assert.deepEqual(r.additions,[{node:'child',references:['std:base']}]);assert.deepEqual(r.beforeOrder,r.afterOrder);
});
test('later bases, ordinary complete documents and non-direct ancestors are not invented',()=>{
 const r=plan({root:'host',isStandard:standard,nodes:[{id:'host',dependencies:[edge('file:child','child'),edge('std:late')]},{id:'child',metadataGap:true,dependencies:[]}]});assert.deepEqual(r.additions,[]);
 const q=plan({root:'host',isStandard:standard,nodes:[{id:'host',dependencies:[edge('std:base'),edge('file:child','child')]},{id:'child',dependencies:[]}]});assert.deepEqual(q.additions,[]);
});
test('cycles, missing owners and ambiguous node identities refuse',()=>{
 for(const nodes of [[{id:'h',dependencies:[edge('file:h','h')]}],[{id:'h',dependencies:[edge('file:missing','x')]}],[{id:'h',dependencies:[]},{id:'h',dependencies:[]}]])assert.throws(()=>plan({root:'h',nodes,isStandard:standard}));
});
test('repeated references retain the same single-emission order',()=>{
 const r=plan({root:'h',isStandard:standard,nodes:[{id:'h',dependencies:[edge('std:a'),edge('std:a'),edge('file:c','c'),edge('file:c','c')]},{id:'c',metadataGap:true,dependencies:[]}]});assert.equal(r.additions[0].references.length,1);assert.equal(r.afterOrder.length,3);
});
