import {test} from 'node:test';
import assert from 'node:assert/strict';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
test('unchanged oracle preserves exact code and rejects lost startup/event/argument effects',async()=>{
 const oracle=await openPinnedUserOracle();
 const before='native void Start();native void Register(int a);void InitMap(){Start();Register(7);}';
 assert((await oracle.compare(before,before)).exact);
 for(const after of [before.replace('Start();Register','Register'),before.replace('Register(7);',''),before.replace('Register(7);','Register(8);')])assert.equal((await oracle.compare(before,after)).exact,false);
 await oracle.verify();
});
