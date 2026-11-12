import test from 'node:test';import assert from 'node:assert/strict';
import {canonicalClosedLiteralLoopSnapshots as canonical} from './closed-literal-loop-snapshots.mjs';
import {openPinnedUserOracle} from './pinned-user-oracle.mjs';
test('the unchanged whole-program oracle accepts the proved capture and rejects changed bounds, steps and calls',async()=>{
 const prefix='native void Use(int value);void F(){',suffix='}',a=prefix+'int n;int i;if(true){n=2;for(i=0;i<n;i+=1){Use(i);}}'+suffix;
 const before=canonical(a).text,make=(count=2,step=1,extra='')=>canonical(prefix+`const int n=${count};int i;if(true){for(i=0;i<n;i+=${step}){Use(i);}}${extra}`+suffix).text;
 const oracle=await openPinnedUserOracle();
 const equal=await oracle.compare(before,make());assert(equal.syntaxValid&&equal.exact);
 for(const mutant of [make(3),make(2,2),make(2,1,'Use(99);')]){const result=await oracle.compare(before,mutant);assert(result.syntaxValid&&!result.exact);}
 await oracle.verify();assert.equal(oracle.assets,304);
});
