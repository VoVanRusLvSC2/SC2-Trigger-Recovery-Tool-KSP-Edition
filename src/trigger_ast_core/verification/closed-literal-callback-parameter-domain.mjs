// Resolve a string parameter at one native callback registration from every
// direct call to its exact bound owner. No name-only substitutions or code
// rewriting. Nonliteral callers, escapes and parameter writes remain REVIEW.
export function createClosedLiteralCallbackParameterDomains(program,{K,forEachChild}){
 const byName=new Map();
 const walk=(root,visit)=>{const pending=[root];while(pending.length){const n=pending.pop();visit(n);forEachChild(n,c=>{pending.push(c);});}};
 for(const ast of program.documents.values())walk(ast,n=>{if(n.kind===K.Identifier||n.kind===K.StringLiteral){const name=n.kind===K.Identifier?n.name:n.value;const entries=byName.get(name)??[];entries.push(n);byName.set(name,entries);}});
 const unwrap=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
 const identity=node=>{let source=node;while(source.parent)source=source.parent;const input=program.verifiedInputIdentity(source.fileName);return input&&{sourceFile:source.fileName,sourceId:input.sourceId,contentSha256:input.contentSha256,start:node.pos,end:node.end};};
 return function resolve(arg,owner){
  const refused=reason=>({proved:false,reason});
  arg=unwrap(arg);
  if(!owner?.body||owner.parent?.kind!==K.SourceFile||arg?.kind!==K.Identifier)return refused('NOT_TOP_LEVEL_PARAMETER_REGISTRATION');
  const parameter=program.declarationAt(arg),index=owner.parameters.indexOf(parameter);
  if(index<0||parameter.type?.kind!==K.StringKeyword||parameter.isReference)return refused('PARAMETER_BINDING_NOT_EXACT');
  const ownerBinding=program.getBinding(owner.name),parameterBinding=program.getBinding(arg);
  if(ownerBinding.status!=='BOUND'||parameterBinding.status!=='BOUND'||!identity(owner)||!identity(parameter))return refused('UNVERIFIED_OR_AMBIGUOUS_BINDING');
  // A wrapper compatible with an engine's callback ABI could have unknown
  // callers. This proof only closes the supplied, ordinary direct-call domain.
  if(owner.parameters.length===2&&owner.parameters.every(p=>p.type?.kind===K.BoolKeyword)&&owner.type?.kind===K.BoolKeyword)return refused('OWNER_IS_ENGINE_CALLBACK_ABI');
  let invalidUse=false,uses=0;
  walk(owner.body,node=>{
   if(node.kind!==K.Identifier||node.name!==parameter.name.name)return;
   const bound=program.getBinding(node);
   if(bound.status!=='BOUND'||bound.symbolId!==parameterBinding.symbolId){invalidUse=true;return;}
   if(node!==arg)invalidUse=true;else uses++;
  });
  if(invalidUse||uses!==1)return refused('PARAMETER_NOT_SINGLE_UNCHANGED_NATIVE_ARGUMENT');
  const values=new Set(),callers=[];
  for(const ref of byName.get(owner.name.name)??[]){
   if(ref.kind===K.StringLiteral)return refused('OWNER_NAME_ESCAPES_AS_STRING');
   const binding=program.getBinding(ref);
   if(binding.status!=='BOUND')return refused('OWNER_REFERENCE_UNRESOLVED');
   if(binding.symbolId!==ownerBinding.symbolId)continue;
   if(ref.parent?.kind===K.FunctionDeclaration&&ref.parent.name===ref)continue;
   const parent=ref.parent;
   if(parent?.kind!==K.CallExpression||parent.expression!==ref)return refused('OWNER_REFERENCE_ESCAPES_DIRECT_CALL');
   if(parent.arguments.length!==owner.parameters.length)return refused('CALLER_ARITY');
   const value=unwrap(parent.arguments[index]);
   if(value?.kind!==K.StringLiteral||typeof value.value!=='string')return refused('CALLER_ARGUMENT_NOT_LITERAL');
   const source=identity(parent);if(!source)return refused('CALLER_SOURCE_UNVERIFIED');
   values.add(value.value);callers.push({...source,value:value.value});
   if(callers.length>4096||values.size>512)return refused('CALLER_DOMAIN_BOUND');
  }
  if(!callers.length)return refused('NO_CLOSED_CALLERS');
  return {proved:true,kind:'BOUND_LITERAL_CALLBACK_PARAMETER_DOMAIN',owner:identity(owner),ownerSymbolId:ownerBinding.symbolId,parameter:identity(parameter),parameterIndex:index,values:[...values].sort(),callers,parameterUnchanged:true,allSuppliedDirectCallersChecked:true,externalRuntimeEntriesProved:false,wholeMapAccepted:false};
 };
}
