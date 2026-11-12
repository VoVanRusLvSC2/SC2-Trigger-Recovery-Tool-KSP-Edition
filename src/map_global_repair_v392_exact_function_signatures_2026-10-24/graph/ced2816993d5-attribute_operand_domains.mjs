import {parseImmutableGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d38acb45983d-immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
// Attribute IDs are not globally unique: a player attribute can share an ID
// with a game attribute. Resolve a comparison's value through its actual API
// operand, including library scope, instead of matching a number alone.
export function attributeOperandDomains(triggerXml,schema,parseXml) {
  if(!schema)return new Map();
  const nodes=[],index=new Map(),calls=new Map(),domains=new Map(),paramUses=new Map(),variableUses=new Map(),variableOwners=new Map();
  const key=(scope,type,id)=>(scope??'')+':'+type+':'+id;
  const nk=n=>key(n.scope,n.attributes.Type,n.attributes.Id);
  const rk=(r,scope)=>key(r.attributes.Library??scope,r.attributes.Type,r.attributes.Id);
  function visit(n){if(n.tag==='Element'){const k=nk(n);if(index.has(k))throw Error('Duplicate scoped attribute element');index.set(k,n);nodes.push(n);}for(const c of n.children)visit(c);}
  visit(parseXml(triggerXml));
  const resolve=(r,n)=>r&&index.get(rk(r,n.scope));
  const formal=p=>p?.children.find(c=>c.tag==='ParameterDef');
  const definition=n=>n.children.find(c=>c.tag==='FunctionDef');
  const matches=(n,b)=>{const d=definition(n);return d&&(d.attributes.Library??n.scope)===b.libraryId&&d.attributes.Id===b.functionDefId;};
  const operand=(n,id,scope)=>n.children.filter(c=>c.tag==='Parameter').map(r=>resolve(r,n)).find(p=>formal(p)?.attributes.Id===id&&(formal(p).attributes.Library??p.scope)===scope);
  for(const owner of nodes.filter(n=>['Trigger','FunctionDef'].includes(n.attributes.Type)))for(const ref of owner.children.filter(c=>['LocalVariable','Variable'].includes(c.tag)&&c.attributes.Type==='Variable')) {
    const k=rk(ref,owner.scope),owners=variableOwners.get(k)??[];owners.push(owner);variableOwners.set(k,owners);
  }
  for(const call of nodes.filter(n=>n.attributes.Type==='FunctionCall'))for(const r of call.children.filter(c=>c.tag==='Parameter')) {
    const k=rk(r,call.scope),uses=paramUses.get(k)??[];uses.push(call);paramUses.set(k,uses);
  }
  for(const p of nodes.filter(n=>n.attributes.Type==='Param'))for(const r of p.children.filter(c=>c.tag==='Variable')) {
    const k=rk(r,p.scope),uses=variableUses.get(k)??[];uses.push(p);variableUses.set(k,uses);
  }
  const set=(n,domain)=>{const k=nk(n);if(domains.has(k)&&domains.get(k)!==domain)throw Error('Shared attribute parameter has conflicting domains');domains.set(k,domain);};
  for(const n of nodes.filter(n=>n.attributes.Type==='FunctionCall')) {
    const def=n.children.find(c=>c.tag==='FunctionDef');if(!def)continue;
    const binding=schema.bindings.find(b=>(def.attributes.Library??n.scope)===b.libraryId&&def.attributes.Id===b.functionDefId);
    if(binding)calls.set(nk(n),binding.attributeType);
  }
  const empty=new Set(schema.emptyAttributeValues??[]),visiting=new Set(),variableDomains=new Map(),scopeSafe=new Map();
  function noHiddenWrites(n) {
    return n.children.filter(c=>c.tag==='ScriptCode'&&!c.selfClosing).every(c=>{
      const code=triggerXml.slice(c.openEnd,c.closeStart).trim();if(!code)return true;
      try {
        const ast=parseImmutableGalaxySyntax('void AttributeScopeProbe(){'+code+'}','attribute-domain-scope.galaxy');
        return !ast.parseDiagnostics.length&&ast.statements.length===1&&ast.statements[0].kind===K.FunctionDeclaration&&
          ast.statements[0].body?.statements.every(s=>s.kind===K.BreakpointStatement||s.kind===K.EmptyStatement);
      }catch{return false;}
    });
  }
  function hasScript(owner) {
    const seen=new Set();
    function walk(n) {
      const k=nk(n);if(seen.has(k))return false;seen.add(k);
      if(n.children.some(c=>c.tag==='ScriptCode'&&!c.selfClosing&&triggerXml.slice(c.openEnd,c.closeStart).trim()))return true;
      return n.children.filter(c=>['FunctionCall','Parameter','Value','Variable'].includes(c.tag)&&c.attributes.Type!=='FunctionDef').some(c=>{const next=resolve(c,n);return next&&walk(next);});
    }
    return walk(owner);
  }
  function domain(p) {
    if(!p)return;
    if(p.children.filter(c=>['FunctionCall','Preset','Variable'].includes(c.tag)).length!==1||p.children.some(c=>['ScriptCode','Value','Array','ArrayIndex','StructMember','Parameter','ValueParam'].includes(c.tag)))return;
    const ref=p.children.find(c=>c.tag==='FunctionCall');if(ref)return calls.get(rk(ref,p.scope));
    const preset=p.children.find(c=>c.tag==='Preset');if(preset)return empty.has(rk(preset,p.scope))?'Empty':undefined;
    const vr=p.children.find(c=>c.tag==='Variable');if(!vr||p.children.some(c=>['Array','ArrayIndex','StructMember'].includes(c.tag)))return;
    const variable=resolve(vr,p);if(!variable||variable.children.find(c=>c.tag==='VariableType')?.children.find(c=>c.tag==='Type')?.attributes.Value!=='attributevalue')return;
    const k=nk(variable);if(visiting.has(k))return;if(variableDomains.has(k))return variableDomains.get(k);
    // Global variables additionally require the complete owned GUI scope to
    // contain no unstructured writes. Language statements are checked by the
    // same immutable AST frontend as conversion, not a spelling whitelist.
    const owners=variableOwners.get(k)??[];
    if(!scopeSafe.has(variable.scope))scopeSafe.set(variable.scope,nodes.filter(n=>n.scope===variable.scope).every(noHiddenWrites));
    if(owners.length>1||owners.length===1&&hasScript(owners[0])||owners.length===0&&!scopeSafe.get(variable.scope))return;
    visiting.add(k);
    try {
      const initial=variable.children.find(c=>c.tag==='Value'),flows=[initial?domain(resolve(initial,variable)):'Empty'];
      for(const use of variableUses.get(k)??[]) {
        const parents=paramUses.get(nk(use));if(!parents?.length)return;
        for(const call of parents) {
          const pd=formal(use),cmp=schema.comparison;
          if(matches(call,cmp)&&pd&&(pd.attributes.Library??use.scope)===cmp.libraryId&&cmp.operandIds.includes(pd.attributes.Id))continue;
          const assignment=(schema.assignments??[]).find(a=>matches(call,a));
          if(!assignment||!pd||(pd.attributes.Library??use.scope)!==assignment.libraryId||pd.attributes.Id!==assignment.targetId)return;
          flows.push(domain(operand(call,assignment.valueId,assignment.libraryId)));
        }
      }
      if(flows.some(v=>!v))return;
      const concrete=new Set(flows.filter(v=>v!=='Empty'));
      const result=concrete.size===1?[...concrete][0]:undefined;variableDomains.set(k,result);return result;
    } finally {visiting.delete(k);}
  }
  for(const n of nodes.filter(n=>n.attributes.Type==='FunctionCall')) {
    const def=n.children.find(c=>c.tag==='FunctionDef'),cmp=schema.comparison;
    if(!def||(def.attributes.Library??n.scope)!==cmp.libraryId||def.attributes.Id!==cmp.functionDefId)continue;
    const params=n.children.filter(c=>c.tag==='Parameter').map(r=>resolve(r,n)).filter(Boolean);
    const operands=cmp.operandIds.map(id=>params.find(p=>p.children.some(c=>c.tag==='ParameterDef'&&c.attributes.Id===id&&(c.attributes.Library??p.scope)===cmp.libraryId)));
    for(let i=0;i<2;i++) {
      const d=domain(operands[i]);
      if(d&&d!=='Empty'&&operands[1-i])set(operands[1-i],d);
    }
  }
  return domains;
}
