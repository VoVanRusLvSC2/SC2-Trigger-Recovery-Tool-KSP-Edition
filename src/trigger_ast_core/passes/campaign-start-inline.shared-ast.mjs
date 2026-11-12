import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const excluded=new Set(['parent','symbol','flowNode','syntaxTokens','locals']);
function walk(n,visit,ancestors=[]){if(!n||typeof n!=='object')return;if(Array.isArray(n)){for(const v of n)walk(v,visit,ancestors);return;}visit(n,ancestors);for(const[k,v]of Object.entries(n))if(!excluded.has(k)&&v&&typeof v==='object')walk(v,visit,[...ancestors,n]);}
const call=n=>n?.kind===K.ExpressionStatement&&n.expression?.kind===K.CallExpression?n.expression:undefined;
const integer=n=>n?.kind===K.NumericLiteral&&/^\d+$/u.test(n.value??n.text)&&Number(n.value??n.text)<=16?Number(n.value??n.text):undefined;
function parse(text,label){const ast=new Parser().parseFile(label,text);assert.equal(ast.parseDiagnostics.length,0,'INVALID_GALAXY '+label);return ast;}
/** Move the generated cai_startall's exact trailing campaign-start calls to
 * every static statement call site. No new functions or Native definitions.
 * A closed source set is mandatory: function references or shadowing refuse.
 * Input source is immutable; callers decide whether to use the proven result. */
export function inlineGeneratedCampaignStartup(source,{closedSources=[],closureVerified=false}={},document){
 const ast=document?document.input(source):parse(source,'campaign-source.galaxy');
 const definitions=ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name==='cai_startall');
 if(!definitions.length)return {changed:false,script:source,reason:'NO_GENERATED_CUSTOM_AI_START'};
 assert.equal(definitions.length,1,'AMBIGUOUS_CAI_STARTALL');const definition=definitions[0];
 assert(definition.body&&definition.parameters.length===0&&definition.type.kind===K.VoidKeyword,'CAI_SIGNATURE');
 const statements=Array.from(definition.body.statements),first=statements.findIndex(n=>call(n)?.expression?.name==='AICampaignStart');
 if(first<0)return {changed:false,script:source,reason:'NO_CAMPAIGN_TAIL'};
 assert(closureVerified&&closedSources.length>0,'VERIFIED_CLOSED_SOURCE_SET_REQUIRED');
 assert(first>0,'NO_CUSTOM_AI_PREFIX');
 for(const n of statements.slice(0,first)){const c=call(n);assert(c?.expression?.kind===K.Identifier&&c.expression.name==='cai_start'&&c.arguments.length===2&&c.arguments[0].kind===K.StringLiteral&&integer(c.arguments[1])!==undefined,'NON_GENERATED_AI_PREFIX');}
 const tail=statements.slice(first),players=[];
 for(const n of tail){const c=call(n);assert(c?.expression?.kind===K.Identifier&&c.expression.name==='AICampaignStart'&&c.arguments.length===1&&integer(c.arguments[0])!==undefined,'NON_CONSTANT_CAMPAIGN_TAIL');players.push(integer(c.arguments[0]));}
 assert.equal(new Set(players).size,players.length,'DUPLICATE_CAMPAIGN_PLAYER');
 const references=new Set([definition.name]),sites=[];
 walk(ast,(n,ancestors)=>{
  if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&n.expression.name==='cai_startall'){
   const parent=ancestors.at(-1),block=ancestors.at(-2);
   assert.equal(n.arguments.length,0,'CALL_ARGUMENTS');assert(parent?.kind===K.ExpressionStatement&&parent.expression===n&&block?.kind===K.Block,'CALL_NOT_BLOCK_STATEMENT');
   references.add(n.expression);sites.push(parent);
  }
 });
 walk(ast,n=>{if(n.kind===K.Identifier&&n.name==='cai_startall')assert(references.has(n),'FUNCTION_REFERENCE_OR_SHADOW');if(n.kind===K.StringLiteral)assert(!/\bcai_startall\b/u.test(n.value??n.text??''),'DYNAMIC_NAME_STRING');});
 assert(sites.length>0,'NO_STATIC_CALLS');
 const closure=[];
 for(const input of closedSources){assert(typeof input.text==='string'&&input.sha256===sha(input.text),'UNBOUND_CLOSURE_SOURCE');const external=parse(input.text,input.label??'closure.galaxy');walk(external,n=>{if(n.kind===K.Identifier)assert(n.name!=='cai_startall','EXTERNAL_CAI_REFERENCE');if(n.kind===K.StringLiteral)assert(!/\bcai_startall\b/u.test(n.value??n.text??''),'EXTERNAL_DYNAMIC_CAI_REFERENCE');});closure.push({label:input.label,sha256:input.sha256});}
 const bodyText=statements.map(n=>source.slice(n.pos,n.end)).join('\n');
 const edits=sites.map(n=>({start:n.pos,end:n.end,text:bodyText})).sort((a,b)=>b.start-a.start);
 for(let i=1;i<edits.length;i++)assert(edits[i].end<=edits[i-1].start,'OVERLAPPING_EDITS');
 let script=source;for(const edit of edits)script=script.slice(0,edit.start)+edit.text+script.slice(edit.end);
 const output=document?document.output(script):parse(script,'lowered-campaign.galaxy');
 assert.equal(output.statements.length,ast.statements.length,'NEW_TOP_LEVEL_DECLARATION');
 const after=output.statements.find(n=>n.kind===K.FunctionDeclaration&&n.name.name==='cai_startall');assert.equal(after.body.statements.length,statements.length);
 let remainingCalls=0;walk(output,n=>{if(n.kind===K.CallExpression&&n.expression?.name==='cai_startall')remainingCalls++;});assert.equal(remainingCalls,0);
 const proof={kind:'STATIC_GENERATED_CAI_FULL_BODY_EXPANSION',sourceSha256:sha(source),loweredSha256:sha(script),players,callSites:sites.map(n=>({start:n.pos,end:n.end})),prefixCalls:first,tailCalls:tail.length,insertedCalls:statements.length*sites.length,closedSources:closure,noNewFunctions:true,noCustomScriptOrNativeIntroduced:true,rule:'Exact void zero-argument generated function; unchanged private helper definition; complete constant startup body expanded at every static block-statement call; all non-call references and closed-source references rejected; same call sequence at each invocation',editorVerified:false,wholeMapAccepted:false};
 return {changed:true,script,proof};
}
