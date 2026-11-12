// Prepare only the body of a for->while lowering. Continue targets an enclosing
// loop, not an enclosing switch. Keep nested loops' continues untouched.
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readCanonicalInt32Literal,inclusiveLiteralIntComparison} from '../types/inclusive-literal-int-comparison.mjs';
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function walk(n,f,parent){if(n){f(n,parent);forEachChild(n,c=>walk(c,f,n));}}
function ownContinues(root){const out=[];function visit(n,p){
 if(!n||[K.ForStatement,K.WhileStatement,K.DoStatement].includes(n.kind))return;
 if(n.kind===K.ContinueStatement)out.push({node:n,parent:p});else forEachChild(n,c=>visit(c,n));
}visit(root);return out;}
export function prepareContinuePreservingForBody(loop,owner,source,closingPosition){
 const body=source.slice(loop.statement.pos+1,closingPosition),targets=ownContinues(loop.statement);
 const refusal=reason=>({safe:false,proof:{reason,targetContinues:targets.length}});
 const incrementNames=new Set();walk(loop.incrementor,n=>{if(n.kind===K.Identifier)incrementNames.add(n.name);});
 let shadow=false;walk(loop.statement,n=>{if([K.VariableDeclaration,K.FunctionDeclaration].includes(n.kind)&&incrementNames.has(n.name?.name))shadow=true;});
 // The increment will execute in the while body. A new lexical binding there
 // must not capture a name which the original for increment resolved outside.
 if(shadow)return refusal('FOR_INCREMENT_BINDING_SHADOWED_BY_BODY_DECLARATION');
 if(!targets.length)return {safe:true,body,proof:{targetContinues:0,nestedLoopContinuesRetained:true,incrementBindingsNotCaptured:true}};
 if(!owner)return refusal('FOR_OWNER_UNPROVED');
 const inc=unwrap(loop.incrementor),left=unwrap(inc?.left),step=readCanonicalInt32Literal(inc?.right);
 if(inc?.kind!==K.BinaryExpression||![K.PlusEqualsToken,K.MinusEqualsToken].includes(inc.operatorToken?.kind)||left?.kind!==K.Identifier||step===undefined||step===0n)return refusal('CONTINUE_REQUIRES_LOCAL_INT_LITERAL_STEP');
 const declarations=[];walk(owner,n=>{if([K.VariableDeclaration,K.ParameterDeclaration].includes(n.kind)&&n.name.name===left.name)declarations.push(n);});
 const entry=[];for(const d of owner.body.statements){if(d.kind!==K.VariableDeclaration)break;entry.push(d);}
 if(declarations.length!==1||!entry.includes(declarations[0])||declarations[0].type?.kind!==K.IntKeyword||declarations[0].modifiers?.length)return refusal('CONTINUE_COUNTER_BINDING_UNPROVED');
 let bodyDeclaration=false;walk(loop.statement,n=>{if([K.VariableDeclaration,K.FunctionDeclaration].includes(n.kind))bodyDeclaration=true;});
 if(bodyDeclaration)return refusal('CONTINUE_BODY_LEXICAL_DECLARATION');
 // Leave the already supported literal ranges to the installed GUI range
 // binder. Preserving bytes is conservative even if a later SDK refuses it.
 const init=unwrap(loop.initializer),condition=unwrap(loop.condition),bound=readCanonicalInt32Literal(condition?.right);
 const effectiveStep=inc.operatorToken.kind===K.PlusEqualsToken?step:-step;
 if(init?.kind===K.BinaryExpression&&init.operatorToken?.kind===K.EqualsToken&&init.left?.name===left.name&&
    readCanonicalInt32Literal(init.right)!==undefined&&condition?.left?.name===left.name&&bound!==undefined&&
    inc.operatorToken.kind===K.PlusEqualsToken){
  const op=condition.operatorToken?.kind,strict=inclusiveLiteralIntComparison(condition);
  if(op===(effectiveStep>0n?K.LessThanEqualsToken:K.GreaterThanEqualsToken)||
     strict&&op===(effectiveStep>0n?K.LessThanToken:K.GreaterThanToken))return refusal('LITERAL_RANGE_RETAINED_FOR_EXISTING_GUI_BINDER');
 }
 const increment=source.slice(loop.incrementor.pos,loop.incrementor.end),edits=[];
 for(const {node,parent} of targets){
  const semicolons=node.syntaxTokens?.filter(t=>t.kind===K.SemicolonToken);
  if(semicolons?.length!==1)return refusal('CONTINUE_SEMICOLON_BOUNDARY_UNPROVED');
  const end=semicolons[0].pos+1;
  if(node.pos<=loop.statement.pos||end>closingPosition||source[end-1]!==';')return refusal('CONTINUE_SOURCE_BOUNDARY_UNPROVED');
  const original=source.slice(node.pos,end),inList=parent?.statements?.includes(node);
  edits.push({start:node.pos,end,text:inList?increment+';\n'+original:'{ '+increment+'; '+original+' }'});
 }
 let rewritten=body;
 for(const edit of edits.sort((a,b)=>b.start-a.start)){
  const offset=loop.statement.pos+1;
  rewritten=rewritten.slice(0,edit.start-offset)+edit.text+rewritten.slice(edit.end-offset);
 }
 return {safe:true,body:rewritten,proof:{targetContinues:targets.length,incrementBeforeEachTargetContinue:true,
  incrementSource:increment,incrementBindingsNotCaptured:true,nestedLoopContinuesRetained:true,
  switchDoesNotChangeContinueTarget:true,bodyDeclarationsAbsent:true,originalSourceWritten:false}};
}
