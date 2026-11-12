// Converter-input representation only. A branch selecting two literal bounds
// can store them in fresh private locals before the original Begin call. The
// original condition, loop, End, arguments and all other AST nodes are retained.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const skip=new Set(['parent','pos','end','line','char','symbol','locals','flowNode','syntaxTokens']);
function shape(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(shape);return Object.fromEntries(Object.entries(n).filter(([k])=>!skip.has(k)).map(([k,v])=>[k,shape(v)]));}
function walk(n,f){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(x=>walk(x,f));return;}if(typeof n.kind!=='number')return;f(n);for(const[k,v]of Object.entries(n))if(!skip.has(k))walk(v,f);}
function parse(s,label){const a=new Parser().parseFile(label,s);assert.equal(a.parseDiagnostics.length,0,'BRANCHED_LOOP_INVALID_SOURCE:'+label);return a;}
function unwrap(n){while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;}
function call(n,name,arity){n=unwrap(n);return n?.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&n.expression.name===name&&n.arguments.length===arity?n:undefined;}
function statementCall(s,name,arity){return s?.kind===K.ExpressionStatement?call(s.expression,name,arity):undefined;}
function literal(n){n=unwrap(n);let v;
 if(n?.kind===K.NumericLiteral&&/^\d+$/u.test(n.text??''))v=BigInt(n.text);
 else if(n?.kind===K.PrefixUnaryExpression&&n.operator.kind===K.MinusToken&&n.operand?.kind===K.NumericLiteral&&/^\d+$/u.test(n.operand.text??''))v=-BigInt(n.operand.text);
 return v!==undefined&&v>=-2147483648n&&v<=2147483647n;
}
function canonicalFor(n){const c=unwrap(n?.condition);return n?.kind===K.ForStatement&&!n.initializer&&n.statement?.kind===K.Block&&c?.kind===K.PrefixUnaryExpression&&c.operator.kind===K.ExclamationToken&&call(c.operand,'IntLoopDone',0)&&call(n.incrementor,'IntLoopStep',0);}
function branch(s){if(s?.kind!==K.Block||s.statements.length!==1)return;const c=statementCall(s.statements[0],'IntLoopBegin',2);return c&&c.arguments.every(literal)?{statement:s.statements[0],call:c}:undefined;}
export function lowerBranchedIntegerLoopBounds(source,declarations=[],document){
 assert(Array.isArray(declarations),'BRANCHED_LOOP_DECLARATIONS_REQUIRED');
 const ast=(document?document.input(source):parse(source,'owned')),inputs=declarations.map((d,i)=>({fileName:typeof d==='string'?String(i):d.fileName,text:typeof d==='string'?d:d.text}));
 const externalInputs=inputs.map(d=>{assert.equal(typeof d.text,'string');return{fileName:d.fileName,sha256:sha(d.text)};});
 const sources=[ast,...inputs.map((d,i)=>parse(d.text,'declaration-'+i))],defs=new Map(),globalNames=new Set(),allNames=new Set();
 for(const a of sources){for(const s of a.statements){if(s.kind===K.FunctionDeclaration){const n=s.name.name;if(!defs.has(n))defs.set(n,[]);defs.get(n).push(s);}else if(s.kind===K.VariableDeclaration)globalNames.add(s.name.name);}walk(a,n=>{if(n.kind===K.Identifier)allNames.add(n.name);});}
 const contracts=[['IntLoopBegin',K.VoidKeyword,[K.IntKeyword,K.IntKeyword]],['IntLoopDone',K.BoolKeyword,[]],['IntLoopStep',K.VoidKeyword,[]],['IntLoopEnd',K.VoidKeyword,[]]];
 const contractValid=contracts.every(([name,type,params])=>!globalNames.has(name)&&defs.get(name)?.length&&defs.get(name).every(d=>d.type?.kind===type&&d.parameters.length===params.length&&d.parameters.every((p,i)=>p.type?.kind===params[i])));
 const records=[],edits=[],expectedByIf=new Map(),declarationsByFn=new Map();let serial=0;
 if(contractValid)for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  const bindings=[...fn.parameters];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)bindings.push(n);});
  if(new Set(bindings.map(n=>n.name.name)).size!==bindings.length||bindings.some(n=>contracts.some(([name])=>name===n.name.name)))continue;
  const candidates=[];walk(fn.body,b=>{if(b.kind!==K.Block)return;for(let i=0;i+2<b.statements.length;i++){
   const s=b.statements[i];if(s.kind!==K.IfStatement||!canonicalFor(b.statements[i+1])||!statementCall(b.statements[i+2],'IntLoopEnd',0))continue;
   const yes=branch(s.thenStatement),no=branch(s.elseStatement);if(yes&&no)candidates.push({s,yes,no});
  }});
  const newDecls=[];
  for(const {s,yes,no}of candidates){
   let start,end;do{serial++;start='lv_mkLoopStart'+serial;end='lv_mkLoopEnd'+serial;}while(allNames.has(start)||allNames.has(end));allNames.add(start);allNames.add(end);
   const boundText=c=>c.arguments.map(a=>source.slice(a.pos,a.end));
   // Newlines protect a trailing // comment carried by the parser's end span.
   const assignment=c=>{const[a,b]=boundText(c);return `${start} = (\n${a}\n);\n${end} = (\n${b}\n);\n`;};
   const added=parse(`void sample () { int ${start}; int ${end}; IntLoopBegin(${start}, ${end}); }`,'fresh-scaffold').statements[0].body.statements;
   newDecls.push(added[0],added[1]);
   const expected=shape(s);
   expected.thenStatement.statements=shape(parse('void sample () { '+assignment(yes.call)+' }','yes-assignment').statements[0].body.statements);
   expected.elseStatement.statements=shape(parse('void sample () { '+assignment(no.call)+' }','no-assignment').statements[0].body.statements);
   expectedByIf.set(s,[expected,shape(added[2])]);
   edits.push({start:yes.statement.pos,end:yes.statement.end,text:assignment(yes.call)},{start:no.statement.pos,end:no.statement.end,text:assignment(no.call)},{start:s.end,end:s.end,text:`\nIntLoopBegin(${start}, ${end});\n`});
   records.push({function:fn.name.name,sourcePosition:s.pos,startVariable:start,endVariable:end,yesBounds:boundText(yes.call),noBounds:boundText(no.call),conditionSha256:sha(source.slice(s.expression.pos,s.expression.end)),conditionEvaluationsBefore:1,conditionEvaluationsAfter:1,beginCallsPerTakenBranchBefore:1,beginCallsAfter:1,loopAndEndUnchanged:true,literalInt32ArgumentsOnly:true});
  }
  if(newDecls.length){declarationsByFn.set(fn,shape(newDecls));edits.push({start:fn.body.pos+1,end:fn.body.pos+1,text:'\n'+newDecls.map(d=>`int ${d.name.name};`).join('\n')+'\n'});}
 }
 // Build the allowed output independently from the textual edits. Only the
 // selected if statements and fresh local declarations may change the tree.
 function expected(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.flatMap(x=>expectedByIf.has(x)?expectedByIf.get(x):[expected(x)]);const out={};for(const[k,v]of Object.entries(n))if(!skip.has(k))out[k]=expected(v);if(declarationsByFn.has(n))out.body.statements=[...declarationsByFn.get(n),...out.body.statements];return out;}
 edits.sort((a,b)=>a.start-b.start||a.end-b.end);for(let i=1;i<edits.length;i++)assert(edits[i-1].end<=edits[i].start,'BRANCHED_LOOP_OVERLAPPING_EDITS');
 let text=source;for(const e of[...edits].reverse())text=text.slice(0,e.start)+e.text+text.slice(e.end);
 assert.deepEqual(shape((document?document.output(text):parse(text,'lowered')).statements),expected(ast.statements),'BRANCHED_LOOP_OTHER_AST_CHANGED');
 return{text,proof:{kind:'BRANCH_SELECTED_LITERAL_INTEGER_LOOP_BOUNDS',sourceSha256:sha(source),outputSha256:sha(text),contractValid:Boolean(contractValid),externalInputs,records,changed:records.length>0,wholeAstMatchesOnlyDeclaredEdits:true,originalFilesChanged:false,extraNativeCalls:0,newFunctions:0,persistentCache:false,wholeMapAccepted:false}};
}
