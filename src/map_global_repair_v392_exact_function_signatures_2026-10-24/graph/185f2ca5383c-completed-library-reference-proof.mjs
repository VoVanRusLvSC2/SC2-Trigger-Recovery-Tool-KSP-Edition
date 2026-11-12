// Prove only embedded startup calls whose source guards and callers are visible.







import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';







function walk(n,fn){if(!n||typeof n!=='object')return;if(Array.isArray(n)){n.forEach(x=>walk(x,fn));return;}fn(n);for(const[k,v]of Object.entries(n))if(k!=='parent')walk(v,fn);}







const unparen=n=>n?.kind===K.ParenthesizedExpression?unparen(n.expression):n;







function guardedRoot(source,id){







 const name=`lib${id}_InitLib`,defs=source.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.name.name===name&&n.body);







 if(defs.length!==1)return;







 const f=defs[0],body=f.body.statements;if(f.parameters.length||f.type.kind!==K.VoidKeyword||body.length<2)return;







 const g=body[0],set=body[1]?.kind===K.ExpressionStatement?body[1].expression:undefined;







 const flag=unparen(g.expression),branch=g.thenStatement?.kind===K.Block?g.thenStatement.statements:[];







 if(g.kind!==K.IfStatement||g.elseStatement||flag?.kind!==K.Identifier||branch.length!==1||branch[0].kind!==K.ReturnStatement||branch[0].expression)return;







 if(set?.kind!==K.BinaryExpression||set.operatorToken.kind!==K.EqualsToken||set.left.kind!==K.Identifier||set.left.name!==flag.name||unparen(set.right)?.kind!==K.TrueKeyword)return;







 const vars=source.statements.filter(n=>n.kind===K.VariableDeclaration&&n.name.name===flag.name);







 if(vars.length!==1||vars[0].type.kind!==K.BoolKeyword||unparen(vars[0].initializer)?.kind!==K.FalseKeyword)return;







 const allowed=new Set([vars[0].name,flag,set.left]);let escaped=false;







 walk(source,n=>{if(n.kind===K.Identifier&&n.name===flag.name&&!allowed.has(n))escaped=true;if(n.kind===K.StringLiteral&&n.value?.includes(flag.name))escaped=true;});







 if(escaped)return;







 return {function:f,flag:flag.name};







}







function uniqueDirectCaller(source,id){







 const name=`lib${id}_InitLib`,allowed=new Set(),matches=[];







 for(const f of source.statements.filter(n=>n.kind===K.FunctionDeclaration)){







  if(f.name.name===name)allowed.add(f.name);







  for(const s of f.body?.statements??[]){const e=s.kind===K.ExpressionStatement?s.expression:undefined;if(e?.kind===K.CallExpression&&e.expression.kind===K.Identifier&&e.expression.name===name&&e.arguments.length===0){matches.push({caller:f,statement:s});allowed.add(e.expression);}}







 }







 let escaped=false;walk(source,n=>{if(n.kind===K.Identifier&&n.name===name&&!allowed.has(n))escaped=true;if(n.kind===K.StringLiteral&&n.value?.includes(name))escaped=true;});







 if(escaped||matches.length!==1)return;







 return matches[0];







}







export function proveCompletedLibraryReferences(source,startedBefore){







 const proven=new Map(),records=[];







 for(const [target,earlier] of startedBefore){







  if(!guardedRoot(source,target))continue;







  const targetCall=uniqueDirectCaller(source,target);if(!targetCall)continue;







  const statements=targetCall.caller.body.statements,targetIndex=statements.indexOf(targetCall.statement),safe=[];







  for(const id of earlier){







   const guard=guardedRoot(source,id),call=uniqueDirectCaller(source,id);







   if(!guard||!call||call.caller!==targetCall.caller||statements.indexOf(call.statement)>=targetIndex)continue;







   safe.push(id);records.push({target,dependency:id,caller:call.caller.name.name,completionFlag:guard.flag,uniqueDirectCallBeforeTarget:true,guardFlagCannotEscapeOrReset:true});







  }







  if(safe.length)proven.set(target,safe);







 }







 return {proven,records};







}







