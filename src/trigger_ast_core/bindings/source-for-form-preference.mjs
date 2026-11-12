import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readCanonicalInt32Literal,inclusiveLiteralIntComparison} from '../types/inclusive-literal-int-comparison.mjs';
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,f)=>{f(n);forEachChild(n,c=>walk(c,f));};

/** A preprocessing preference, never GUI authorization or an equivalence
 * certificate. Leave representable original for syntax for the real typed
 * NativeLib binder. Mutable bounds/steps still require the existing exact
 * timing-preserving path; an original while is never reclassified here. */
export function sourceLiteralForCandidate(node){
 if(node?.kind!==K.ForStatement||node.statement?.kind!==K.Block)return;
 const init=un(node.initializer),condition=un(node.condition),increment=un(node.incrementor);
 if(init?.kind!==K.BinaryExpression||init.operatorToken?.kind!==K.EqualsToken||init.left?.kind!==K.Identifier||condition?.kind!==K.BinaryExpression||increment?.kind!==K.BinaryExpression||increment.operatorToken?.kind!==K.PlusEqualsToken)return;
 const name=init.left.name;if(un(condition.left)?.name!==name||un(condition.left)?.kind!==K.Identifier||un(increment.left)?.name!==name||un(increment.left)?.kind!==K.Identifier)return;
 const start=readCanonicalInt32Literal(init.right),end=readCanonicalInt32Literal(condition.right),step=readCanonicalInt32Literal(increment.right);
 if(start===undefined||end===undefined||step===undefined||step===0n)return;
 const op=condition.operatorToken.kind,positive=step>0n;
 if(positive?![K.LessThanToken,K.LessThanEqualsToken].includes(op):![K.GreaterThanToken,K.GreaterThanEqualsToken].includes(op))return;
 if([K.LessThanToken,K.GreaterThanToken].includes(op)&&!inclusiveLiteralIntComparison(condition))return;
 let owner=node.parent;while(owner&&owner.kind!==K.FunctionDeclaration)owner=owner.parent;if(!owner?.body)return;
 const declarations=[];walk(owner.body,n=>{if(n.kind===K.VariableDeclaration&&n.name.name===name)declarations.push(n);});
 if(declarations.length!==1)return;
 const variable=declarations[0];if(variable.type?.kind!==K.IntKeyword||variable.modifiers?.length||variable.pos>=node.pos)return;
 let scope=node.parent;while(scope&&scope!==variable.parent)scope=scope.parent;if(!scope)return;
 let unsupported=false;walk(node.statement,n=>{if([K.VariableDeclaration,K.ContinueStatement].includes(n.kind))unsupported=true;});if(unsupported)return;
 return {kind:'ORIGINAL_LITERAL_FOR_FORM_CANDIDATE',start:String(start),end:String(end),step:String(step),counter:name,sourceChanged:false,guiBindingAuthorized:false};
}

export function preferSourceForForms(previous){
 return {...previous,proof:{...previous?.proof,sourceForFormPreference:{literalCandidatesKept:true,originalWhileReclassified:false,guiBindingAuthorized:false}},
  shouldPreserve:(statements,index)=>!!sourceLiteralForCandidate(statements[index])||previous?.shouldPreserve(statements,index)===true};
}
