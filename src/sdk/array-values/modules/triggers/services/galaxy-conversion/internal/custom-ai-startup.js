/** Preserve Custom AI startup when the map legitimately has no InitGlobals.
 * Parse real syntax; never match comments/string contents or reorder actions.
 */
import {Parser,forEachChild,tokenToString} from '@modkit/blizzard-starcraft2/galaxy/language-core';
export function scheduleCustomAiStartup(script){
 const source=new Parser().parseFile('ai-startup.galaxy',script);
 if(source.parseDiagnostics?.length)throw Error('Custom AI startup requires valid Galaxy syntax');
 const roots=source.statements.filter(n=>n.kind===142&&n.name?.name==='InitMap'&&n.body);
 if(roots.length!==1||roots[0].parameters.length||tokenToString(roots[0].type.kind)!=='void')throw Error('Custom AI startup requires one void InitMap()');
 const root=roots[0],calls=[...root.body.statements];
 const directName=n=>n.kind===138&&n.expression?.kind===121&&n.expression.expression?.kind===113&&n.expression.arguments.length===0?n.expression.expression.name:undefined;
 const occurrences=[];const pending=[root.body];
 while(pending.length){const n=pending.pop();if(!n)continue;
  if(n.kind===121&&n.expression?.kind===113&&n.expression.name==='InitCustomAI')occurrences.push(n);
  forEachChild(n,c=>{pending.push(c);});
 }
 if(occurrences.length){
  if(occurrences.length!==1||!calls.some(n=>n.expression===occurrences[0]&&directName(n)==='InitCustomAI'))throw Error('Ambiguous or nested Custom AI startup cannot be silently changed');
  return script; // Already scheduled: do not duplicate or move an authored call.
 }
 if(directName(calls[0])!=='InitLibs')throw Error('Unknown Custom AI startup prefix');
 let index=1;
 if(directName(calls[index]??{})==='InitGlobals')index++;
 const suffix=calls.slice(index).map(directName);
 if(!suffix.every(name=>['InitCustomScript','InitTriggers'].includes(name))||new Set(suffix).size!==suffix.length||suffix.includes('InitCustomScript')&&suffix.includes('InitTriggers')&&suffix.indexOf('InitCustomScript')>suffix.indexOf('InitTriggers'))throw Error('Unknown Custom AI startup work/order');
 const anchor=calls[index-1],lineEnd=script.includes('\r\n')?'\r\n':'\n';
 return script.slice(0,anchor.end)+lineEnd+'    InitCustomAI();'+script.slice(anchor.end);
}
