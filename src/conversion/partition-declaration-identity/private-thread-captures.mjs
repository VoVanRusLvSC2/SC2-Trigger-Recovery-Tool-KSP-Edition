import {createHash} from 'node:crypto';
import {cloneGalaxySyntax} from "../exact-native-export/semantic-forms.mjs";
import {recognizeThreadedFunctions} from "./galaxy-to-trigger-alternate-3.mjs";
/** Comparison only: private compiler capture cells can be renamed consistently
 * by parameter position. Every use must stay in the EXACT recognized wrapper /
 * callback and declaration. Any foreign code, other function, literal reference
 * or colliding target refuses the proof. Calls/order/types stay strictly checked.
 */
export function normalizePrivateThreadCaptures(original,generated,K,forEachChild,{foreignCode}={}){
 if(!Array.isArray(foreignCode)||!foreignCode.length)return {original,generated,notes:[],refused:'Actual dependency source proof omitted'};
 const left=recognizeThreadedFunctions(original.statements,'Map'),right=recognizeThreadedFunctions(generated.statements,'Map');
 const globals=s=>new Map(s.statements.filter(n=>n.kind===K.VariableDeclaration).map(n=>[n.name.name,n]));
 const declarations=[globals(original),globals(generated)],mapping=new Map(),notes=[];
 const walk=(n,fn,parent)=>{if(!n)return;fn(n,parent);forEachChild(n,c=>walk(c,fn,n));};
 function mentioned(source,name){let found=false;walk(source,(n,parent)=>{if(n.kind===K.Identifier&&n.name===name&&!(parent?.kind===K.PropertyAccessExpression&&parent.name===n))found=true;});return found;}
 function closed(source,name,pattern){
  let okay=true;
  for(const statement of source.statements){
   const allowed=statement.kind===K.FunctionDeclaration&&[pattern.wrapperName,pattern.callbackName].includes(statement.name.name);
   walk(statement,(n,parent)=>{
    if(n.kind===K.StringLiteral&&String(n.value).includes(name))okay=false;
    if(n.kind!==K.Identifier||n.name!==name)return;
    if(parent?.kind===K.PropertyAccessExpression&&parent.name===n)return;
    if(statement.kind===K.VariableDeclaration&&statement.name===n)return;
    if([K.VariableDeclaration,K.ParameterDeclaration,K.FunctionDeclaration].includes(parent?.kind)&&parent.name===n)okay=false;
    if(!allowed)okay=false;
   });
  }
  return okay;
 }
 for(const [name,a] of left){const b=right.get(name);if(!b||a.callbackName!==b.callbackName)continue;
  const oldCells=[...a.machineryGlobals].slice(1),newCells=[...b.machineryGlobals].slice(1);if(oldCells.length!==newCells.length)continue;
  let okay=true;
  for(let i=0;i<oldCells.length;i++){
   const x=oldCells[i],y=newCells[i];if(x===y)continue;
   if(declarations[0].has(y)||declarations[1].has(x)||mentioned(original,y)||mentioned(generated,x)||!closed(original,x,a)||!closed(generated,y,b)||foreignCode.some(d=>d.text.includes(x)||d.text.includes(y))){okay=false;break;}
  }
  if(!okay)continue;
  for(let i=0;i<oldCells.length;i++)if(oldCells[i]!==newCells[i]){mapping.set(oldCells[i],newCells[i]);notes.push({function:name,parameter:i,rule:'CLOSED_PRIVATE_THREAD_CAPTURE_BINDING',original:oldCells[i],generated:newCells[i]});}
 }
 if(!mapping.size)return {original,generated,notes};
 if(new Set(mapping.values()).size!==mapping.size)return {original,generated,notes:[],refused:'Noninjective binding mapping'};
 const copy={...original,statements:original.statements.map(cloneGalaxySyntax)};
 walk(copy,(n,parent)=>{if(n.kind===K.Identifier&&mapping.has(n.name)&&!(parent?.kind===K.PropertyAccessExpression&&parent.name===n))n.name=mapping.get(n.name);});
 return {original:copy,generated,notes,foreignSourceProof:foreignCode.map(d=>({fileName:d.fileName,sha256:createHash('sha256').update(d.text).digest('hex')}))};
}
