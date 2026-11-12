import {cloneGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v485_exact_native_export_2026-10-27/graph/94c0098c9dbc-dd2fe52ec855-3af1c1fe9330da63-semantic_forms.mjs';
/** Comparison only. Split leading local initializers in their ORIGINAL order.
 * No call, assignment or initializer changes position relative to another
 * executable expression. Const, arrays and structures refuse the transform.
 */
export function normalizeLeadingInitializers(source,K,forEachChild){
 const result={...source,statements:source.statements.map(cloneGalaxySyntax)},notes=[];
 const visit=(n,fn)=>{if(!n)return;fn(n);forEachChild(n,c=>visit(c,fn));};
 const handleTypes=new Set(['bool','int','fixed','string','text','color','point','region','unit','unitgroup','playergroup','timer','bank','dialog','control','trigger','sound','actor','marker','order','abilcmd','wave','wavetarget']);
 const typeName=t=>t?.name??t?.typeName?.name??Object.entries(K).find(([key,value])=>value===t?.kind&&key.endsWith('Keyword'))?.[0].slice(0,-7).toLowerCase();
 for(const f of result.statements??[]){
  if(f.kind!==K.FunctionDeclaration||!f.body)continue;
  const ss=f.body.statements;let count=0;while(ss[count]?.kind===K.VariableDeclaration)count++;
  const prefix=ss.slice(0,count);if(!prefix.some(d=>d.initializer))continue;
  const names=prefix.map(d=>d.name.name);if(new Set(names).size!==names.length)continue;
  const all=new Set(names),seen=new Set((f.parameters??[]).map(p=>p.name.name));let safe=true;
  for(const d of prefix){
   if(!handleTypes.has(typeName(d.type))||d.modifiers?.some(m=>m.kind===K.ConstKeyword)){safe=false;break;}
   visit(d.initializer,n=>{if(n.kind===K.Identifier&&all.has(n.name)&&!seen.has(n.name))safe=false;});
   seen.add(d.name.name);
  }
  // A later/nested duplicate declaration would make name-based binding unsafe.
  const counts=new Map();visit(f.body,n=>{if(n.kind===K.VariableDeclaration)counts.set(n.name.name,(counts.get(n.name.name)??0)+1);});
  if(!safe||names.some(name=>counts.get(name)!==1))continue;
  const assignments=[];
  for(const d of prefix){if(d.initializer){assignments.push({kind:K.ExpressionStatement,expression:{kind:K.BinaryExpression,left:cloneGalaxySyntax(d.name),operatorToken:{kind:K.EqualsToken},right:d.initializer}});delete d.initializer;}}
  f.body.statements=[...prefix,...assignments,...ss.slice(count)];
  notes.push({function:f.name.name,rule:'LEADING_LOCAL_INITIALIZERS_SAME_EXECUTION_ORDER',count:assignments.length});
 }
 return {source:result,notes};
}
