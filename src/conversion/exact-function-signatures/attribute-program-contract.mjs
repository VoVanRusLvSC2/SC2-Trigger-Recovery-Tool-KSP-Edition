import {SyntaxKind as K} from "./index-alternate-3.js";
import {readStringLiteralValue} from "./string-literal-value.mjs";
import {createProgramEnvironment} from "./program-environment.mjs";
export function inspectAttributeProgram(scripts,apiNames) {
 const apis=new Set(apiNames),program=createProgramEnvironment(scripts,{identifierNames:apis});
 const calls=[];
 for(const {node,...scope}of program.calls) {
  if(node.expression?.kind!==K.Identifier||!apis.has(node.expression.name))continue;
  const literal=node.arguments?.[0]?.kind===K.StringLiteral?readStringLiteralValue(node.arguments[0].text):undefined;
  calls.push({...scope,api:node.expression.name,pos:node.pos,selector:literal?.value,indirect:!literal});
 }
 return {calls,references:program.references,issues:program.issues};
}

/** Whole supplied program identity covers indirect flows and references to an
 * attribute API used as a value. Unsupported differences remain REVIEW. */
export async function compareAttributePrograms(before,after,{apiNames,compare}) {
 const original=inspectAttributeProgram(before,apiNames),candidate=inspectAttributeProgram(after,apiNames);
 const issues=[...original.issues,...candidate.issues],checks=[];
 const applicable=original.calls.length+candidate.calls.length+original.references.length+candidate.references.length>0;
 if(applicable) {
  const left=new Map(before.map(f=>[f.fileName,f.text])),right=new Map(after.map(f=>[f.fileName,f.text]));
  for(const name of new Set([...left.keys(),...right.keys()])) {
   if(!left.has(name)||!right.has(name)){issues.push({kind:'ATTRIBUTE_PROGRAM_CLOSURE_CHANGED',file:name});continue;}
   const result=await compare(left.get(name),right.get(name));
   checks.push({file:name,exact:result.exact===true,syntaxValid:result.syntaxValid});
   if(result.exact!==true||result.syntaxValid===false)issues.push({kind:'ATTRIBUTE_PROGRAM_REQUIRES_PROOF',file:name});
  }
 }
 return {passed:issues.length===0,applicable,issues,checks,original,candidate,indirectFlowsCovered:applicable&&issues.length===0,
  namespaceRelocationAssumed:false,wholeMapAccepted:false};
}
