import {SyntaxKind as K,forEachChild} from "../sdk/array-values/modules/galaxy/language-core/index.js";
import {boundSourceStoragePath} from "../model/authored-storage-boundary-path.global-scope.mjs";
import {retainedGuiType} from "../model/gui-type-qualifiers.mjs";

// An Editor domain can share an integer Galaxy carrier. Infer it only from
// complete, consistently bound uses and known GUI/ABI contracts. This planner
// does not mutate GUI data or infer by a field's spelling.
export function planBoundStructureFieldDomains({program,statements,fields,argumentContract,valueContract}){
 const id=loc=>loc?.contentSha256&&JSON.stringify([loc.sourceFile,loc.contentSha256,loc.start,loc.end]);
 const rows=new Map();
 for(const f of fields){const location=program.location(f.declaration),identity=id(location);if(identity&&f.variable?.variableType?.type==='int')rows.set(identity,{field:f,location,uses:[],domains:new Map(),refused:[]});}
 const names=new Set([...rows.values()].map(row=>row.field.declaration.name?.name).filter(Boolean));
 const declarationLocation=node=>{
  const direct=program.location(node);if(direct)return direct;
  let root=node;while(root?.parent)root=root.parent;
  const input=root?.fileName&&program.verifiedInputIdentity(root.fileName);
  return input?.contentSha256&&{sourceFile:root.fileName,contentSha256:input.contentSha256,start:node.pos,end:node.end};
 };
 const parenthesized=node=>{while(node.parent?.kind===K.ParenthesizedExpression&&node.parent.expression===node)node=node.parent;return node;};
 const record=(row,node,contract,where)=>{
  const domain=retainedGuiType(contract?.domain),type=domain?.type;
  if(!where?.contentSha256||contract?.carrier!=='int'||!type||/^(?:int|byte|fixed|bool|string|text|void|any|sameas|preset|struct)/iu.test(type)){
   row.refused.push({reason:'UNPROVEN_OR_NONDOMAIN_USE',where});return;
  }
  row.domains.set(JSON.stringify(domain),domain);row.uses.push({where,domain});
 };
 function visit(node){
  if(node.kind===K.PropertyAccessExpression&&names.has(node.name?.name)){
   const declaration=program.declarationAt(node),location=declaration&&declarationLocation(declaration),row=rows.get(id(location));
   if(row){
    const where=program.location(node),binding=program.getBinding(node),storage=boundSourceStoragePath(program,node);
    if(binding.status!=='BOUND'||storage.status!=='EXACT_BOUND_SCALAR_STORAGE'||storage.elementType!=='int')row.refused.push({reason:'SOURCE_BINDING_OR_STORAGE_UNPROVEN',where});
    else{
     const value=parenthesized(node),parent=value.parent;
     if(parent?.kind===K.CallExpression&&parent.arguments?.includes(value))record(row,node,argumentContract(parent,parent.arguments.indexOf(value)),where);
     else if(parent?.kind===K.BinaryExpression&&parent.operatorToken?.kind===K.EqualsToken&&parent.left===value)record(row,node,valueContract(parent.right),where);
     else row.refused.push({reason:'UNSUPPORTED_USE',where});
    }
   }else if(program.getBinding(node).status!=='BOUND'){
    // Ambiguous accesses with a matching field spelling prevent inference;
    // spelling never authorizes a positive match.
    for(const candidate of rows.values())if(candidate.field.declaration.name?.name===node.name?.name)
     candidate.refused.push({reason:'UNBOUND_FIELD_USE',where:program.location(node)});
   }
  }
  forEachChild(node,visit);
 }
 for(const statement of statements)visit(statement);
 const plans=[];
 for(const row of rows.values())if(!row.refused.length&&row.uses.length&&row.domains.size===1){
  const domain=row.domains.values().next().value;
  plans.push({variable:row.field.variable,domain,source:row.location,uses:row.uses});
 }
 return {plans,refused:[...rows.values()].filter(r=>r.refused.length||r.domains.size>1).map(r=>({source:r.location,reasons:r.refused,domains:[...r.domains.values()]}))};
}
