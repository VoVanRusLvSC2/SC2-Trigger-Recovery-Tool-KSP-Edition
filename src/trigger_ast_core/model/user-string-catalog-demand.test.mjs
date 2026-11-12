import test from 'node:test';import assert from 'node:assert/strict';
import {readUserStringCatalogOnDemand as read} from './user-string-catalog-demand.mjs';
test('Native declarations and comments do not trigger any data reads',async()=>{
 const context=new Proxy({},{get(){throw Error('unnecessary data read');}});
 assert.equal(await read(context,[{fileName:'a',text:'native string UserDataGetString(string a,string b,string c,int d); // UserDataGetString()'}]),undefined);
});
test('Only an actual call loads the full resolved catalog; absent context grants nothing',async()=>{
 let reads=0;const context={layers:[{id:'0'}],unresolved:[],files:async()=>{reads++;return {items:[]};}};
 const sources=[{fileName:'a',text:'void f(){UserDataGetString("T","I","F",1);}'}];
 assert.equal(await read(undefined,sources),undefined);assert(await read(context,sources));assert.equal(reads,1);
});
test('Calls in a dependency body demand the catalog even when the map has no direct getter call',async()=>{
 let reads=0;const context={layers:[{id:'0'}],unresolved:[],files:async()=>{reads++;return {items:[]};}};
 const sources=[{fileName:'MapScript.galaxy',text:'void InitMap(){LibraryRoutine();}'},
  {fileName:'Library.galaxy',text:'void LibraryRoutine(){UserDataGetString("Commands","A","Callback",1);}'}];
 assert(await read(context,sources));assert.equal(reads,1);
});
