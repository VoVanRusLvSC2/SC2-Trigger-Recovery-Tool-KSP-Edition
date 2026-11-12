// Match loaded loop-template AST and expose named captures for independent
// source/GUI compatibility checks. No source rewrite or equivalence acceptance.
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from "../conversion/exact-function-signatures/immutable-galaxy-syntax.collections.mjs";
import {SyntaxKind as K} from "../conversion/exact-function-signatures/index-alternate-3.js";
const omitted=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode']);
const unwrap=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
function shape(n){n=unwrap(n);if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(shape);return Object.fromEntries(Object.keys(n).filter(k=>!omitted.has(k)).sort().map(k=>[k,shape(n[k])]));}
const fingerprint=n=>JSON.stringify(shape(n));
const literalInitializer=n=>{n=unwrap(n);return n?.kind===K.NumericLiteral||n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator.kind)&&literalInitializer(n.operand);};
function bodySlot(node,slots){
 const call=node?.kind===K.ExpressionStatement&&node.expression;
 const slot=call?.kind===K.CallExpression&&call.expression?.kind===K.Identifier&&slots.get(call.expression.name);
 return slot?.kind==='SUBFUNCS'&&call.arguments.length===0?call.expression.name:undefined;
}
function bind(name,value,bindings){const key=fingerprint(value);if(bindings.has(name))return bindings.get(name).key===key;bindings.set(name,{key,value});return true;}
function match(pattern,actual,slots,bindings){
 pattern=unwrap(pattern);actual=unwrap(actual);
 const slot=pattern?.kind===K.Identifier&&slots.get(pattern.name);
 if(slot){if(slot.kind==='SUBFUNCS'||!actual||typeof actual.kind!=='number'||slot.kind==='AUTOVAR'&&actual.kind!==K.Identifier)return false;return bind(pattern.name,actual,bindings);}
 if(pattern===null||typeof pattern!=='object')return pattern===actual;
 if(!actual||typeof actual!=='object')return false;
 if(Array.isArray(pattern)){
  if(!Array.isArray(actual))return false;
  pattern=pattern.filter(n=>n?.kind!==K.EmptyStatement);actual=actual.filter(n=>n?.kind!==K.EmptyStatement);
  const positions=pattern.flatMap((n,i)=>bodySlot(n,slots)?[i]:[]);
  if(positions.length>1)return false;
  if(!positions.length)return pattern.length===actual.length&&pattern.every((n,i)=>match(n,actual[i],slots,bindings));
  const at=positions[0],tail=pattern.length-at-1,end=actual.length-tail;
  return end>=at&&pattern.slice(0,at).every((n,i)=>match(n,actual[i],slots,bindings))&&
   pattern.slice(at+1).every((n,i)=>match(n,actual[end+i],slots,bindings))&&bind(bodySlot(pattern[at],slots),actual.slice(at,end),bindings);
 }
 const keys=Object.keys(pattern).filter(k=>!omitted.has(k)),other=Object.keys(actual).filter(k=>!omitted.has(k));
 return keys.length===other.length&&keys.every(k=>other.includes(k)&&match(pattern[k],actual[k],slots,bindings));
}

export function deriveNativeLoopTemplateMatcher(library,{macros}){
 const rules=[],refused=[];
 for(const definition of Object.values(library.elementsByType?.FunctionDef??{})){
  const script=definition.scriptCode;
  if(definition.disabled||!definition.flags?.includes('Action')||!definition.flags.includes('SubFunctions')||typeof script!=='string')continue;
  const slots=new Map(),names=new Map(),initializers=new Map();let code='',cursor=0,invalid=false;
  const reserve=(kind,arg)=>{const key=kind+':'+arg;let name=names.get(key);if(!name){name='ModkitLoopShapeSlot'+names.size;names.set(key,name);slots.set(name,{kind,name:arg});}return name;};
  // The prefix must not collide with an identifier authored in the SDK template.
  if(script.includes('ModkitLoopShapeSlot'))continue;
  try{
   for(const macro of macros(script)){
    if(macro.name==='INITAUTOVAR'){
     if(macro.args.length!==2||!macro.args.every(a=>/^[A-Za-z_]\w*$/u.test(a))){invalid=true;break;}
     const a=reserve('AUTOVAR',macro.args[0]),p=reserve('PARAM',macro.args[1]);initializers.set(a,p);
     code+=script.slice(cursor,macro.start)+a+' = '+p+';';cursor=macro.end;continue;
    }
    const valid=macro.name==='PARAM'&&macro.args.length===1||macro.name==='AUTOVAR'&&[1,2].includes(macro.args.length)||macro.name==='SUBFUNCS'&&macro.args.length===1;
    if(!valid||!/^[A-Za-z_]\w*$/u.test(macro.args[0]??'')){invalid=true;break;}
    const key=macro.name+':'+macro.args[0];let name=names.get(key);
    if(!name){name='ModkitLoopShapeSlot'+names.size;names.set(key,name);slots.set(name,{kind:macro.name,name:macro.args[0]});}
    code+=script.slice(cursor,macro.start)+name+(macro.name==='SUBFUNCS'?'();':'');cursor=macro.end;
   }
  }catch{invalid=true;}
  if(invalid)continue;code+=script.slice(cursor);
  const ast=parseImmutableGalaxySyntax('void Template(){'+code+'}','native-loop-template.galaxy');
  if(ast.parseDiagnostics.length)continue;
  const statements=Array.from(ast.statements[0]?.body?.statements??[]).filter(n=>n.kind!==K.EmptyStatement),loops=statements.flatMap((n,i)=>[K.ForStatement,K.WhileStatement].includes(n.kind)?[i]:[]);
  if(loops.length!==1||![...slots.values()].some(s=>s.kind==='SUBFUNCS'))continue;
  // Ambiguous multiple body captures in the same list are deliberately refused.
  let ambiguous=false;
  function inspect(n){if(!n||typeof n!=='object')return;if(Array.isArray(n)){if(n.filter(x=>bodySlot(x,slots)).length>1)ambiguous=true;n.forEach(inspect);}else for(const[k,v]of Object.entries(n))if(!omitted.has(k))inspect(v);}
  inspect(statements);if(ambiguous){refused.push({id:definition.id,reason:'MULTIPLE_BODY_CAPTURES_IN_ONE_LIST'});continue;}
  rules.push({id:definition.id,owner:definition.library??library.id,templateSha256:createHash('sha256').update(script).digest('hex'),statements,loopAt:loops[0],slots,initializers});
 }
 const proof={kind:'MATCH_LOADED_GUI_LOOP_TEMPLATE_AST',templates:rules.map(r=>({owner:r.owner,id:r.id,templateSha256:r.templateSha256,prefixStatements:r.loopAt,suffixStatements:r.statements.length-r.loopAt-1})),refused,sourceRewritten:false,emptyStatementView:true,acceptanceClaimed:false,persistentCache:false};
 function matchesAt(statements,index,{constantDeclarations=new Map()}={}){
  if(![K.ForStatement,K.WhileStatement].includes(statements[index]?.kind))return [];
  return rules.flatMap(r=>{
   const bindings=new Map();
   const attempt=(pattern,actual)=>{const copy=new Map(bindings);if(!match(pattern,actual,r.slots,copy))return false;bindings.clear();for(const [k,v]of copy)bindings.set(k,v);return true;};
   if(!attempt(r.statements[r.loopAt],statements[index]))return [];
   let cursor=index-1;
   for(const prefix of r.statements.slice(0,r.loopAt).toReversed()){
    while(statements[cursor]?.kind===K.EmptyStatement)cursor--;
    const expr=prefix.kind===K.ExpressionStatement&&prefix.expression;
    const a=expr?.kind===K.BinaryExpression&&expr.operatorToken.kind===K.EqualsToken&&expr.left?.kind===K.Identifier&&expr.left.name;
    const p=a&&r.initializers.get(a);
    if(cursor>=0&&attempt(prefix,statements[cursor])){
     // For a literal numeric input this SDK macro emits a const declaration,
     // not a runtime store. Do not mistake an older store-shaped template for
     // a possible emission of the current template.
     if(p&&literalInitializer(bindings.get(p)?.value))return [];cursor--;continue;
    }
    const ref=a&&bindings.get(a)?.value,decl=ref?.kind===K.Identifier&&constantDeclarations.get(ref.name);
    if(!p||expr.right?.kind!==K.Identifier||expr.right.name!==p||!decl||!bind(p,decl.initializer,bindings))return [];
   }
   const start=cursor+1;cursor=index+1;
   for(const suffix of r.statements.slice(r.loopAt+1)){
    while(statements[cursor]?.kind===K.EmptyStatement)cursor++;
    if(cursor>=statements.length||!attempt(suffix,statements[cursor]))return [];cursor++;
   }
   return [{start,end:cursor,templateId:r.id,captures:[...bindings].map(([name,{value}])=>({kind:r.slots.get(name).kind,name:r.slots.get(name).name,value}))}];
  });
 }
 return {proof,matchesAt,shouldPreserve:(statements,index)=>matchesAt(statements,index).length>0};
}
