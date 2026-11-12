import {Parser,SyntaxKind as K,forEachChild} from "./index-alternate-3.js";

/** One analysis model for root, owned includes and CustomAI Galaxy. Each input
 * is parsed once in this model. Roles are metadata, never separate parsers.
 * The caller owns the environment; no state survives a conversion. */
export function createProgramEnvironment(scripts,{identifierNames}={}) {
 const documents=new Map(),calls=[],references=[],issues=[];
 const parser=new Parser();
 for(const source of scripts) {
  if(documents.has(source.fileName)){issues.push({kind:'DUPLICATE_PROGRAM_FILE',file:source.fileName});continue;}
  const ast=parser.parseFile(source.fileName,source.text);
  documents.set(source.fileName,{source,ast});
  if(ast.parseDiagnostics.length){issues.push({kind:'ATTRIBUTE_PROGRAM_PARSE_ERROR',file:source.fileName});continue;}
  const visit=(node,owner,parent)=>{
   if(node.kind===K.FunctionDeclaration)owner=node.name?.name;
   if(node.kind===K.CallExpression)calls.push({file:source.fileName,function:owner,node});
   if(node.kind===K.Identifier&&(!identifierNames||identifierNames.has(node.name))) {
    const declaration=parent?.name===node&&[K.FunctionDeclaration,K.VariableDeclaration,K.ParameterDeclaration].includes(parent.kind);
    const callee=parent?.kind===K.CallExpression&&parent.expression===node;
    if(!declaration&&!callee)references.push({file:source.fileName,function:owner,name:node.name,pos:node.pos});
   }
   forEachChild(node,child=>{visit(child,owner,node);});
  };
  visit(ast,undefined,undefined);
 }
 return {documents,calls,references,issues};
}
