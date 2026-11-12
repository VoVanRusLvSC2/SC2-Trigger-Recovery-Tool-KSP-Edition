import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {createClosedLiteralCallbackParameterDomains} from './closed-literal-callback-parameter-domain.mjs';
// Native string callbacks are not checked by ordinary argument type checking.
// The contract is the installed Natives.galaxy Trigger Design Comments:
// bool callback(bool testConds, bool runActions). No engine implementation is supplied.
export function inspectTriggerCallbacks(primary,declarations,{Parser,SyntaxKind:K,forEachChild,tokenToString}){
 const sources=[...declarations.map(f=>({...f,external:true})),...primary.map(f=>({...f,external:false}))];
 const functions=new Map(),issues=[],checked=[],sourceOverrides=[];
 const digest=text=>createHash('sha256').update(text).digest('hex');
 const inputs=sources.map(s=>({fileName:s.fileName,text:s.text,owned:!s.external,sourceId:s.fileName,contentSha256:digest(s.text)}));
 const program=new GalaxyProgramContext(inputs,{files:inputs,buildIdentity:{kind:'SHA_BOUND_COMPONENT_INPUTS_NOT_ENGINE_PROOF'}},digest);
 try{
 const domains=[];
 const type=n=>tokenToString(n?.kind)??n?.name??n?.typeName?.name??'unknown';
 const signature=n=>({result:type(n.type),parameters:n.parameters.map(p=>type(p.type))});
 for(const source of sources){
  source.ast=program.documents.get(source.fileName);program.attachOriginal(source.ast);
  if(source.ast.parseDiagnostics.length)issues.push({code:'CALLBACK_INPUT_SYNTAX',fileName:source.fileName});
  for(const n of source.ast.statements)if(n.kind===K.FunctionDeclaration){
   const entries=functions.get(n.name.name)??[];entries.push({node:n,fileName:source.fileName});functions.set(n.name.name,entries);
  }
 }
 const resolveDomain=createClosedLiteralCallbackParameterDomains(program,{K,forEachChild});
 const api=functions.get('TriggerCreate')??[];
 const native=api.some(({node:n})=>n.modifiers?.some(m=>m.kind===K.NativeKeyword)&&
  type(n.type)==='trigger'&&n.parameters.length===1&&type(n.parameters[0].type)==='string');
 const overridden=api.some(({node:n})=>n.body);
 if(overridden)sourceOverrides.push('TriggerCreate');
 for(const source of sources.filter(s=>!s.external)){
  const visit=(n,shadowed=false,owner)=>{
   if(n.kind===K.FunctionDeclaration){
    owner=n;
    // A local/parameter with this name may shadow the native. Never assume otherwise.
    shadowed=n.parameters.some(p=>p.name.name==='TriggerCreate');
    const findLocal=x=>{if(x.kind===K.VariableDeclaration&&x.name.name==='TriggerCreate')shadowed=true;forEachChild(x,findLocal);};
    if(n.body)findLocal(n.body);
   }
   if(n.kind===K.CallExpression&&n.expression?.kind===K.Identifier&&n.expression.name==='TriggerCreate'){
    const site={fileName:source.fileName,start:n.pos};
    if(shadowed)issues.push({...site,code:'CALLBACK_API_SHADOWED'});
    else if(overridden){/* An ordinary source function, not the engine callback API. */}
    else if(!native)issues.push({...site,code:'CALLBACK_NATIVE_ABI_UNPROVEN'});
    else if(n.arguments.length!==1)issues.push({...site,code:'CALLBACK_CREATE_ARITY'});
    else{
     let arg=n.arguments[0];while(arg.kind===K.ParenthesizedExpression)arg=arg.expression;
     const domain=arg.kind===K.StringLiteral?{proved:true,values:[arg.value]}:resolveDomain(arg,owner);
     if(!domain.proved)issues.push({...site,code:'CALLBACK_DYNAMIC_NAME_UNPROVEN',domainRefusal:domain.reason});
     else{
      if(domain.kind)domains.push({...site,...domain});
      for(const name of domain.values){const definitions=(functions.get(name)??[]).filter(f=>f.node.body);
      if(definitions.length!==1)issues.push({...site,code:definitions.length?'CALLBACK_AMBIGUOUS_DEFINITION':'CALLBACK_BODY_MISSING',name});
      else{
       const actual=signature(definitions[0].node);
       if(actual.result!=='bool'||actual.parameters.length!==2||actual.parameters.some(t=>t!=='bool'))
        issues.push({...site,code:'CALLBACK_SIGNATURE_MISMATCH',name,actual});
       else checked.push({...site,name,definition:definitions[0].fileName});
      }
      }
     }
    }
   }
   forEachChild(n,c=>visit(c,shadowed,owner));
  };
  visit(source.ast);
 }
 return {status:issues.length?'REVIEW':'PASSED',checked:checked.length,bindings:checked,issues,sourceOverrides,
  closedParameterDomains:domains,
  scope:'Literal native registrations and independently bound finite literal parameter domains in supplied sources; external runtime entries remain separate.',
  engineCompile:false};
 }finally{program.dispose();}
}
