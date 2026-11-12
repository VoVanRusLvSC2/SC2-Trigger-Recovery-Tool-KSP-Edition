// Failure diagnostics only. This cannot approve a reorder or change a verdict.
import {createHash} from 'node:crypto';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {createInitializationOrder} from '../model/initialization-order.include-once.mjs';
import {logicalSourcePath} from '../model/source-ownership.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex');
const stamp=n=>JSON.stringify([logicalSourcePath(n.fileName),n.name,n.start,n.end,n.sourceSha256]);
export function diagnoseInitializerOrder(before,after,externalSources,includeEvidence,{parseGalaxy=parseImmutableGalaxySyntax}={}){
 const result={observationalOnly:true,equivalenceProved:false,sourceSha256:sha(before),generatedSha256:sha(after),calls:[]};
 try{
  const options={rootAliases:['LibMap_h.galaxy','Base.SC2Data/MapScript.galaxy','Base.SC2Data/LibMap_h.galaxy'],parseGalaxy};
  const a=createInitializationOrder(before,externalSources,includeEvidence,options),b=createInitializationOrder(after,externalSources,includeEvidence,options);
  result.sourceOrder=a.initializers;result.generatedOrder=b.initializers;
  const activeA=new Set(a.initializers.map(stamp)),activeB=new Set(b.initializers.map(stamp));
  for(const file of externalSources){
   const ast=parseGalaxy(file.text,file.fileName),sourceSha256=sha(file.text);
   for(const variable of ast.statements.filter(n=>n.kind===K.VariableDeclaration&&n.initializer)){
    const identity={fileName:file.fileName,name:variable.name.name,start:variable.pos,end:variable.end,sourceSha256};
    const pending=[variable.initializer];
    while(pending.length){const n=pending.pop();if(n.kind===K.CallExpression)result.calls.push({...identity,
      call:n.expression.kind===K.Identifier?n.expression.name:'<computed>',argumentCount:n.arguments.length,
      activeInSource:activeA.has(stamp(identity)),activeInGenerated:activeB.has(stamp(identity))});
     forEachChild(n,c=>{pending.push(c);});}
   }
  }
  result.sourceFiles=a.files;result.generatedFiles=b.files;
  result.activeCalls=result.calls.filter(c=>c.activeInSource||c.activeInGenerated).length;
  result.declarationOnlyCalls=result.calls.length-result.activeCalls;
 }catch(error){result.diagnosticError=String(error?.message||error);}
 return result;
}
