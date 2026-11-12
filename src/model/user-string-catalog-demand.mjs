import assert from 'node:assert/strict';
import {Parser,SyntaxKind as K,forEachChild} from "../sdk/array-values/modules/galaxy/language-core/index.js";
import {readReadonlyUserCatalog} from "./readonly-user-catalog.mjs";

// Load data only for an actual source call, never because the SDK declares it.
// Without a resolved context the existing closed-flow analysis still refuses.
export function sourceNeedsUserStringCatalog(sources){
 let needed=false;
 for(const source of sources){
  const ast=new Parser().parseFile(source.fileName,source.text);
  assert.equal(ast.parseDiagnostics.length,0,'USER_CATALOG_DEMAND_SOURCE_SYNTAX');
  const visit=n=>{if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&n.expression.name==='UserDataGetString')needed=true;forEachChild(n,visit);};visit(ast);
 }
 return needed;
}
export async function readUserStringCatalogOnDemand(context,sources){
 if(!context)return;
 return sourceNeedsUserStringCatalog(sources)?readReadonlyUserCatalog(context):undefined;
}
