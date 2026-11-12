// Explain undeclared literal comparisons without editing the original program,
// adding definitions, suppressing a failed check, or declaring equivalence.
import {Parser,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {attributeCatalog} from './attribute-contract.mjs';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
const literal=n=>{n=unwrap(n);return n?.kind===K.StringLiteral?readStringLiteralValue(n.text)?.value:undefined;};
export function explainUndeclaredAttributeTokens({before,after,model,ownedOwners,apiNames}) {
 const catalog=attributeCatalog(model),apis=new Set(apiNames);
 const inspect=text=>{
  const tree=new Parser().parseFile('attribute-source-diagnostics',text),records=[];
  if(tree.parseDiagnostics.length)return {parsed:false,records};
  const walk=(node,fn)=>{
   if(node.kind===K.FunctionDeclaration)fn=node.name?.name;
   if(node.kind===K.BinaryExpression&&[K.EqualsEqualsToken,K.ExclamationEqualsToken].includes(node.operatorToken?.kind)) {
    for(const [call,value]of [[unwrap(node.left),literal(node.right)],[unwrap(node.right),literal(node.left)]]) {
     if(call?.kind!==K.CallExpression||!apis.has(call.expression?.name)||value===undefined)continue;
     const selector=literal(call.arguments?.[0]);if(selector===undefined)continue;
     const match=/^\[([^\]]+)\](\d+)$/u.exec(selector);
     const id=/^\d+$/u.test(selector)?selector:match&&ownedOwners.includes(match[1])?match[2]:undefined;
     const attribute=id!==undefined&&catalog.definitions.get(id);
     if(attribute&&!attribute.tokens.has(value))records.push({function:fn,api:call.expression.name,selector,id,token:value,
       operator:node.operatorToken.kind===K.EqualsEqualsToken?'==':'!=',position:node.pos});
    }
   }
   forEachChild(node,child=>{walk(child,fn);});
  };
  walk(tree,undefined);return {parsed:true,records};
 };
 const source=inspect(before),candidate=inspect(after);
 const counts=records=>{
  const result=new Map();for(const {position,...record}of records){const key=JSON.stringify(record);result.set(key,(result.get(key)??0)+1);}
  return [...result].sort(([a],[b])=>a.localeCompare(b));
 };
 return {source,candidate,sameRecordedComparisons:source.parsed&&candidate.parsed&&JSON.stringify(counts(source.records))===JSON.stringify(counts(candidate.records)),
  scope:'Direct literal comparisons only; explains source provenance, does not certify whole-program behavior or bypass GUI/benchmark failures',verdictUnchanged:true};
}
