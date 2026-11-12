import {syntaxShape} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2/dist/modules/triggers/services/galaxy-conversion/internal/script-template.js'
import {pairedFunctionLocalNames} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2/dist/modules/triggers/services/galaxy-conversion/internal/galaxy-comparison.js'
/** Preserve include paths and literal spelling/type; syntaxShape is a projection,
 * not an AST clone. Parser parent links are omitted to avoid cycles. */
const parserMetadata=new Set(['parent','pos','end','line','char','syntaxTokens','commentsLineMap','lineMap','bindDiagnostics','additionalSyntacticDiagnostics'])
export function cloneGalaxySyntax(n){if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.map(cloneGalaxySyntax);return Object.fromEntries(Object.entries(n).filter(([k])=>!parserMetadata.has(k)).map(([k,v])=>[k,cloneGalaxySyntax(v)]))}
export function normalizeSemanticPair(original,exported,K,forEachChild){
 const preliminary=[normalizeSemanticForms(original,K,forEachChild,null),normalizeSemanticForms(exported,K,forEachChild,null)]
 original=preliminary[0].source;exported=preliminary[1].source
 const functions=s=>new Map(s.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body).map(n=>[n.name.name,n]))
 const fs=[functions(original),functions(exported)],maps=[new Map(),new Map()]
 const prefixSafe=f=>{
  const declarations=[];const collect=n=>{if(n.kind===K.VariableDeclaration)declarations.push(n);forEachChild(n,collect)};collect(f.body)
  const all=new Set(declarations.map(d=>d.name.name));if(all.size!==declarations.length)return false
  const initialized=new Set((f.parameters??[]).map(p=>p.name.name))
  for(const d of f.body.statements){if(d.kind!==K.VariableDeclaration)break;let unsafe=false;const visit=n=>{if(!n)return;if(n.kind===K.Identifier&&all.has(n.name)&&!initialized.has(n.name))unsafe=true;if([K.CallExpression,K.PostfixUnaryExpression,K.ElementAccessExpression].includes(n.kind)||n.kind===K.BinaryExpression&&!['PlusToken','MinusToken','AsteriskToken','AmpersandToken','BarToken','CaretToken','LessThanToken','GreaterThanToken','LessThanEqualsToken','GreaterThanEqualsToken','EqualsEqualsToken','ExclamationEqualsToken','AmpersandAmpersandToken','BarBarToken'].map(k=>K[k]).includes(n.operatorToken?.kind))unsafe=true;forEachChild(n,visit)};visit(d.initializer);if(unsafe)return false;if(d.initializer)initialized.add(d.name.name)}return true
 }
 for(const [name,f] of fs[0])if(fs[1].has(name)&&prefixSafe(f)&&prefixSafe(fs[1].get(name))){const pair=pairedFunctionLocalNames(f,fs[1].get(name));maps[0].set(name,pair[0]);maps[1].set(name,pair[1])}
 const result={original:normalizeSemanticForms(original,K,forEachChild,maps[0],{clone:false}),exported:normalizeSemanticForms(exported,K,forEachChild,maps[1],{clone:false})}
 result.original.notes.unshift(...preliminary[0].notes);result.exported.notes.unshift(...preliminary[1].notes)
 return result
}
/** Comparison-only forms with explicit proofs. Product/XML/export bytes stay intact.
 * Never sorts actions or calls. Binding names, values and dependencies remain checked. */
export function normalizeSemanticForms(source,K,forEachChild,bindingMaps=new Map(),{clone=true}={}){
 const notes=[]
 const result={...source,statements:clone?source.statements.map(cloneGalaxySyntax):[...source.statements]}
 const walk=(n,fn,parent)=>{if(!n)return;fn(n,parent);forEachChild(n,c=>walk(c,fn,n))}
 const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n
 const literals=new Set([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword,K.NullKeyword])
 const unary=new Set([K.PlusToken,K.MinusToken,K.ExclamationToken,K.TildeToken])
 const binary=new Set(['PlusToken','MinusToken','AsteriskToken','AmpersandToken','BarToken','CaretToken','LessThanToken','GreaterThanToken','LessThanEqualsToken','GreaterThanEqualsToken','EqualsEqualsToken','ExclamationEqualsToken','AmpersandAmpersandToken','BarBarToken'].map(k=>K[k]))
 const pure=n=>!n||literals.has(n.kind)||n.kind===K.Identifier||n.kind===K.ParenthesizedExpression&&pure(n.expression)||n.kind===K.PrefixUnaryExpression&&unary.has(n.operator?.kind)&&pure(n.operand)||n.kind===K.BinaryExpression&&binary.has(n.operatorToken?.kind)&&pure(n.left)&&pure(n.right)
 const builtinTypes=new Map(['Bool','Int','Fixed','String','Text','Void'].map(t=>[K[t+'Keyword'],t.toLowerCase()]))
 const kindText=n=>builtinTypes.get(n?.kind)??n?.name??n?.typeName?.name??''
 for(const f of result.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
  let statements=f.body.statements
  const types=new Map((f.parameters??[]).map(p=>[p.name.name,kindText(p.type)]))
  walk(f.body,n=>{if(n.kind===K.VariableDeclaration)types.set(n.name.name,kindText(n.type))})
  const uses=new Set();walk(f.body,(n,parent)=>{if(n.kind===K.Identifier&&parent?.name!==n)uses.add(n.name)})
  f.body.statements=f.body.statements.filter(n=>{const unused=n.kind===K.VariableDeclaration&&!n.initializer&&builtinTypes.has(n.type?.kind)&&!uses.has(n.name.name);if(unused)notes.push({function:f.name.name,rule:'UNUSED_UNINITIALIZED_SCALAR',name:n.name.name});return !unused})
  // The Editor makes literal loop bounds const and hoists them. Accept only a
  // single literal write whose EVERY use is dominated by that write in the
  // same block. Calls, mutable expressions and conditional escaping reads fail.
  const entries=[]
  const paths=(n,ancestors=[])=>{if(!n)return;entries.push({node:n,ancestors});forEachChild(n,c=>paths(c,[...ancestors,n]))};paths(f.body)
  const literalKinds=new Set([K.NumericLiteral,K.StringLiteral,K.TrueKeyword,K.FalseKeyword])
  const writes=new Set(['EqualsToken','PlusEqualsToken','MinusEqualsToken','AsteriskEqualsToken','SlashEqualsToken','PercentEqualsToken','LessThanLessThanEqualsToken','GreaterThanGreaterThanEqualsToken','AmpersandEqualsToken','BarEqualsToken','CaretEqualsToken'].map(s=>K[s]).filter(n=>n!==undefined))
  const declarationCounts=new Map(),assignmentsByName=new Map(),refsByName=new Map();
  const append=(map,name,e)=>{if(name!==undefined){if(!map.has(name))map.set(name,[]);map.get(name).push(e)}};
  for(const e of entries){const n=e.node;
   if(n.kind===K.VariableDeclaration)declarationCounts.set(n.name.name,(declarationCounts.get(n.name.name)??0)+1);
   if(n.kind===K.BinaryExpression&&unwrap(n.left)?.kind===K.Identifier&&writes.has(n.operatorToken?.kind))append(assignmentsByName,unwrap(n.left).name,e);
   else if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(n.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(n.operator?.kind))append(assignmentsByName,unwrap(n.operand)?.name,e);
   if(n.kind===K.Identifier&&e.ancestors.at(-1)?.name!==n)append(refsByName,n.name,e);
  }
  const removeStatements=new Set();const topDeclarations=f.body.statements.filter(n=>n.kind===K.VariableDeclaration)
  for(const decl of topDeclarations){
   const name=decl.name.name;if(!['int','fixed','bool','string'].includes(kindText(decl.type))||declarationCounts.get(name)!==1)continue
   const assignments=assignmentsByName.get(name)??[]
   if(decl.initializer&&literalKinds.has(unwrap(decl.initializer).kind)&&assignments.length===0){if(decl.modifiers?.some(m=>m.kind===K.ConstKeyword)){decl.modifiers=decl.modifiers.filter(m=>m.kind!==K.ConstKeyword);notes.push({function:f.name.name,rule:'IMMUTABLE_LOCAL_LITERAL',name})}continue}
   if(decl.initializer||assignments.length!==1)continue
   const a=assignments[0],expression=a.node,statement=a.ancestors.at(-1),block=a.ancestors.at(-2)
   if(expression.operatorToken?.kind!==K.EqualsToken||!literalKinds.has(unwrap(expression.right)?.kind)||statement?.kind!==K.ExpressionStatement||block?.kind!==K.Block)continue
   const index=block.statements.indexOf(statement),dominated=new Set()
   for(const s of block.statements.slice(index+1))walk(s,n=>dominated.add(n))
   const refs=(refsByName.get(name)??[]).filter(e=>e.node!==expression.left)
   if(!refs.length||!refs.every(e=>dominated.has(e.node)))continue
   decl.initializer=expression.right;removeStatements.add(statement);notes.push({function:f.name.name,rule:'DOMINATED_SINGLE_LITERAL_LOCAL_WRITE',name})
  }
  if(removeStatements.size){const strip=n=>{if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.filter(v=>!removeStatements.has(v)).map(strip);return Object.fromEntries(Object.entries(n).map(([k,v])=>[k,strip(v)]))};f.body=strip(f.body)}
  // 0.0-x and unary -x are the same operation for a declared fixed operand.
  // Do not rewrite integer/unknown expressions, calls, casts or any other math.
  const replace=n=>{
   if(!n||typeof n!=='object')return n
   if(Array.isArray(n))return n.map(replace)
   const u=unwrap(n),right=unwrap(u?.right)
   if(u?.kind===K.BinaryExpression&&u.operatorToken?.kind===K.MinusToken&&u.left?.kind===K.NumericLiteral&&Number(u.left.value)===0&&right?.kind===K.Identifier&&types.get(right.name)==='fixed'){
    notes.push({function:f.name.name,rule:'FIXED_ZERO_MINUS_IDENTIFIER',operand:right.name})
    return {kind:K.PrefixUnaryExpression,operator:{kind:K.MinusToken},operand:right}
   }
   return Object.fromEntries(Object.entries(n).map(([k,v])=>[k,replace(v)]))
  }
  f.body=replace(f.body);statements=f.body.statements
  // A redundant final bool guard contains no action and returns the same literal.
  const tail=statements.at(-2),last=statements.at(-1),condition=unwrap(tail?.expression)
  const returned=tail?.thenStatement?.kind===K.Block?tail.thenStatement.statements:null
  if(tail?.kind===K.IfStatement&&!tail.elseStatement&&condition?.kind===K.PrefixUnaryExpression&&condition.operator?.kind===K.ExclamationToken&&condition.operand?.kind===K.Identifier&&types.get(condition.operand.name)==='bool'&&returned?.length===1&&returned[0].kind===K.ReturnStatement&&last?.kind===K.ReturnStatement&&literals.has(last.expression?.kind)&&returned[0].expression?.kind===last.expression.kind&&[K.TrueKeyword,K.FalseKeyword].includes(last.expression.kind)){
   f.body.statements.splice(-2,1);notes.push({function:f.name.name,rule:'REDUNDANT_FINAL_BOOL_GUARD'})
  }
  // Leading declarations only: no actions/calls/writes may participate.
  statements=f.body.statements;let count=0
  while(statements[count]?.kind===K.VariableDeclaration)count++
  const prefix=statements.slice(0,count),names=new Set(prefix.map(d=>d.name.name))
  if(bindingMaps?.has(f.name.name)&&prefix.length>1&&names.size===prefix.length&&prefix.every(d=>pure(d.initializer))){
   const dependencies=new Map(prefix.map(d=>{const refs=new Set();walk(d.initializer,n=>{if(n.kind===K.Identifier&&names.has(n.name))refs.add(n.name)});return[d.name.name,refs]}))
   const pending=[...prefix],sorted=[],done=new Set()
   const bindings=bindingMaps.get(f.name.name),key=d=>bindings?.get(d.name.name)??d.name.name
   while(pending.length){const ready=pending.filter(d=>[...dependencies.get(d.name.name)].every(n=>done.has(n))).sort((a,b)=>key(a).localeCompare(key(b)));if(!ready.length)break;const first=ready[0];pending.splice(pending.indexOf(first),1);sorted.push(first);done.add(first.name.name)}
   if(!pending.length){f.body.statements=[...sorted,...statements.slice(count)];if(prefix.some((n,i)=>n!==sorted[i]))notes.push({function:f.name.name,rule:'PURE_LOCAL_DECLARATIONS_DEPENDENCY_ORDER',count})}
  }
  // Parameter captures may surround the Editor's explicit local-record defaults.
  // Only a contiguous prefix of pure writes to OWNED locals participates.
  if(bindingMaps?.has(f.name.name)){
   const ss=f.body.statements;let n=0;while(ss[n]?.kind===K.VariableDeclaration)n++
   const ds=ss.slice(0,n),locals=new Map(ds.map(d=>[d.name.name,d])),structures=new Map(result.statements.filter(s=>s.kind===K.StructDeclaration).map(s=>[s.name.name,s]))
   const primitive=d=>['int','fixed','bool','string'].includes(kindText(d?.type))
   const assignment=(left,right)=>({kind:K.ExpressionStatement,expression:{kind:K.BinaryExpression,left,right,operatorToken:{kind:K.EqualsToken}}})
   const initializers=ds.filter(d=>d.initializer&&!d.modifiers?.some(m=>m.kind===K.ConstKeyword)).map(d=>assignment(d.name,d.initializer))
   const candidate=[...initializers,...ss.slice(n)],writes=[]
   const key=left=>{const x=unwrap(left);if(x?.kind===K.Identifier&&primitive(locals.get(x.name)))return x.name;if(x?.kind===K.PropertyAccessExpression&&x.expression?.kind===K.Identifier){const d=locals.get(x.expression.name),structure=structures.get(kindText(d?.type)),field=(structure?.properties??structure?.members??[]).find(p=>p.name?.name===x.name?.name);if(d&&!d.initializer&&primitive(field))return x.expression.name+'.'+x.name.name}return null}
   for(const s of candidate){const e=s?.expression,k=s?.kind===K.ExpressionStatement&&e?.kind===K.BinaryExpression&&e.operatorToken?.kind===K.EqualsToken?key(e.left):null;if(!k||!pure(e.right))break;writes.push({statement:s,key:k,right:e.right})}
   if(writes.length>1&&initializers.length<=writes.length){
    // The Editor may emit the same local struct defaults twice. Remove only
    // repeated field writes with identical RHS that reads no owned local.
    const unique=[],seenWrites=new Map();let duplicatesSafe=true
    for(const w of writes){if(seenWrites.has(w.key)){let localRead=false;walk(w.right,t=>{if(t.kind===K.Identifier&&locals.has(t.name))localRead=true});if(!w.key.includes('.')||localRead||JSON.stringify(syntaxShape(w.right))!==JSON.stringify(syntaxShape(seenWrites.get(w.key).right)))duplicatesSafe=false}else{seenWrites.set(w.key,w);unique.push(w)}}
    const keys=new Set(unique.map(w=>w.key)),done=new Set();let safe=duplicatesSafe
    const deps=new Map()
    for(const w of unique){const refs=new Set();walk(w.right,t=>{if(t.kind===K.Identifier&&keys.has(t.name))refs.add(t.name)});if([...refs].some(r=>!done.has(r)))safe=false;deps.set(w.key,refs);done.add(w.key)}
    if(safe){const pending=[...unique],sorted=[],completed=new Set(),bindings=bindingMaps.get(f.name.name),binding=k=>{const [base,...rest]=k.split('.');return [bindings.get(base)??base,...rest].join('.')}
     while(pending.length){const ready=pending.filter(w=>[...deps.get(w.key)].every(k=>completed.has(k))).sort((a,b)=>binding(a.key).localeCompare(binding(b.key)));if(!ready.length)break;const w=ready[0];pending.splice(pending.indexOf(w),1);sorted.push(w);completed.add(w.key)}
     if(!pending.length){for(const d of ds)if(d.initializer&&!d.modifiers?.some(m=>m.kind===K.ConstKeyword))delete d.initializer;f.body.statements=[...ds,...sorted.map(w=>w.statement),...candidate.slice(writes.length)];notes.push({function:f.name.name,rule:'INDEPENDENT_OWNED_LOCAL_INITIALIZATION_PREFIX',count:writes.length})}
    }
   }
  }
 }
 // Only unused empty void startup stages, and only standalone direct calls.
 const empty=result.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body?.statements.length===0&&n.parameters?.length===0&&kindText(n.type)==='void'&&/^(?:lib\w+_)?InitCustomScript$/.test(n.name.name))
 for(const f of empty){
  const name=f.name.name;let unsafe=false
  walk(result,(n,parent)=>{
   if(n.kind===K.StringLiteral&&n.value===name)unsafe=true
   if(n.kind===K.Identifier&&n.name===name&&parent?.name!==n){if(parent?.kind!==K.CallExpression||parent.expression!==n||parent.arguments.length)unsafe=true}
  })
  const strip=n=>{if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.filter(s=>!(s?.kind===K.ExpressionStatement&&s.expression?.kind===K.CallExpression&&s.expression.expression?.name===name&&s.expression.arguments.length===0)).map(strip);return Object.fromEntries(Object.entries(n).map(([k,v])=>[k,strip(v)]))}
  // Refuse nested use e.g. Foo(InitCustomScript()), despite the void type.
  walk(result,(n,parent)=>{if(n.kind===K.CallExpression&&n.expression?.name===name&&parent?.kind!==K.ExpressionStatement)unsafe=true})
  if(!unsafe){result.statements=result.statements.filter(n=>!(n.kind===K.FunctionDeclaration&&n.name?.name===name));result.statements=result.statements.map(strip);notes.push({function:name,rule:'EMPTY_VOID_CUSTOM_STARTUP_STAGE'})}
 }
 return {source:result,notes}
}
