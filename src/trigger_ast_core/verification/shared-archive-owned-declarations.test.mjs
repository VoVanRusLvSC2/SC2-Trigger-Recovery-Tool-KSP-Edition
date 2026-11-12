import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {proveSharedArchiveOwnedDeclarations as prove} from './shared-archive-owned-declarations.mjs';
const body=Buffer.from('int retained = 17;'),digest=createHash('sha256').update(body).digest('hex');
function input(){return {bindings:{archiveLayerId:'map',sides:[0,1].map(()=>({ownedTargets:['nested.galaxy'],records:[{owned:true,path:'nested.galaxy',layerId:'map',sha256:digest}]}))},composed:[{files:[]},{files:[]}],declarations:[{fileName:'Nested.galaxy',text:body.toString()}],readOwned:async()=>body};}
test('exact owned body remains in the shared complete declaration context',async()=>{const r=await prove(input());assert.equal(r.records.length,1);assert.equal(r.wholeProgramEquivalenceProved,false);});
test('different archive body cannot use a shared declaration',async()=>{const p=input();p.readOwned=async i=>i?Buffer.from('int retained=18;'):body;await assert.rejects(prove(p),/ARCHIVE_BODY_CHANGED/);});
test('missing or changed declaration cannot satisfy coverage',async()=>{for(const declarations of [[],[{fileName:'nested.galaxy',text:'native int retained();'}]])await assert.rejects(prove({...input(),declarations}),/DECLARATION_(MISSING|BODY_CHANGED)/);});
test('different reachability and wrong layer remain errors',async()=>{let p=input();p.bindings.sides[1].ownedTargets=[];await assert.rejects(prove(p),/REACHABILITY_CHANGED/);p=input();p.bindings.sides[1].records[0].layerId='dependency';await assert.rejects(prove(p),/LAYER_OR_BODY_CHANGED/);});
test('fully composed targets need no shared exception and extra targets fail',async()=>{const p=input();p.composed=[0,1].map(()=>({files:[{fileName:'nested.galaxy'}]}));const r=await prove(p);assert.equal(r.records.length,0);p.composed[1].files.push({fileName:'unreachable.galaxy'});await assert.rejects(prove(p),/OWNED_TARGET_CHANGED/);});
