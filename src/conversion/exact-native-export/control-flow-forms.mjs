import {cloneGalaxySyntax} from "./semantic-forms.mjs";
/** Comparison-only proofs. No executable action is moved/reordered. */
export function normalizeControlFlowForms(source,K,forEachChild){
 const copy={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[];
 const walk=(n,fn)=>{if(!n)return;fn(n);forEachChild(n,c=>walk(c,fn));};
 for(const f of copy.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  walk(f.body,n=>{
   if(n.kind===K.IfStatement&&n.elseStatement?.kind===K.Block&&n.elseStatement.statements?.length===1&&n.elseStatement.statements[0].kind===K.IfStatement){n.elseStatement=n.elseStatement.statements[0];notes.push({function:f.name.name,rule:'SINGLE_IF_ELSE_BLOCK'});}
  });
  const ss=f.body.statements,index=ss.findIndex(n=>n.kind===K.ReturnStatement);
  if(index>=0&&index<ss.length-1){
   const suffix=ss.slice(index+1);let changesBinding=false;
   // A suffix declaration could participate in binding even though its value
   // initializer never executes. Such a case needs a stronger scope proof.
   for(const s of suffix)walk(s,n=>{if([K.VariableDeclaration,K.FunctionDeclaration].includes(n.kind))changesBinding=true;});
   if(!changesBinding){f.body.statements=ss.slice(0,index+1);notes.push({function:f.name.name,rule:'UNREACHABLE_SUFFIX_AFTER_DIRECT_FUNCTION_RETURN',removed:suffix.length});}
  }
 }
 return {source:copy,notes};
}
