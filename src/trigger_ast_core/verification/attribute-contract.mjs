import {isDeepStrictEqual} from 'node:util';
import {Parser, SyntaxKind as K, forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {readAttributes,writeAttributes} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/map/shared/format/formats/attributes.js';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {createXmlEnvironment} from '../model/document-environment.mjs';

// Attribute IDs in the XML definition are editor IDs. The decimal ID codec is
// not a normalization of arbitrary Galaxy strings: runtime tokens stay exact.
export const attributeValueToken = id => /^(?:0|[1-9]\d*)$/u.test(String(id)) ? String(id).padStart(4,'0') : String(id);
export function attributeCatalog(model) {
  const definitions=new Map(),issues=[];
  for(const def of model?.attributes??[]) {
    const id=String(def.id);
    if(definitions.has(id)) issues.push({kind:'DUPLICATE_ATTRIBUTE_ID',id});
    const tokens=new Set();
    for(const value of def.values??[]) {
      const token=attributeValueToken(value.id);
      if(tokens.has(token)) issues.push({kind:'AMBIGUOUS_ATTRIBUTE_TOKEN',id,token});
      tokens.add(token);
    }
    definitions.set(id,{definition:def,tokens});
  }
  return {definitions,issues};
}

export function compareAttributeDocuments(referenceModel,candidateXml,{referenceOrigin='ORIGINAL',approvedTestDefaults=false}={}) {
  const candidate=candidateXml===undefined?undefined:readAttributes(candidateXml);
  const catalog=attributeCatalog(candidate),issues=[...catalog.issues];
  const expected=referenceModel===undefined?undefined:readAttributes(writeAttributes(referenceModel));
  if(!isDeepStrictEqual(expected,candidate)) issues.push({kind:'ATTRIBUTE_DOCUMENT_CHANGED'});
  if(referenceModel&& !['ORIGINAL','VERIFIED_RECOVERY'].includes(referenceOrigin)) issues.push({kind:'UNVERIFIED_ATTRIBUTE_SOURCE'});
  return {passed:issues.length===0,issues,referenceOrigin,approvedTestDefaults,
    originalLobbyPreserved:issues.length===0&&!approvedTestDefaults,
    scope:'Complete definitions, values, defaults, variants, slots, locks, hidden and unknown fields; exact model preservation'};
}

export function inspectAttributeProgram(scripts,apiNames) {
  const apis=new Set(apiNames),files=new Set(),calls=[],issues=[];
  for(const file of scripts) {
    if(files.has(file.fileName)){issues.push({kind:'DUPLICATE_PROGRAM_FILE',file:file.fileName});continue;}
    files.add(file.fileName);
    const ast=new Parser().parseFile(file.fileName,file.text);
    if(ast.parseDiagnostics.length){issues.push({kind:'ATTRIBUTE_PROGRAM_PARSE_ERROR',file:file.fileName});continue;}
    const walk=(node,owner)=>{
      if(node.kind===K.FunctionDeclaration)owner=node.name?.name??node.name?.text;
      if(node.kind===K.CallExpression&&node.expression?.kind===K.Identifier&&apis.has(node.expression.name)) {
        const literal=node.arguments?.[0]?.kind===K.StringLiteral?readStringLiteralValue(node.arguments[0].text):undefined;
        calls.push({file:file.fileName,function:owner,api:node.expression.name,pos:node.pos,
          selector:literal?.value,indirect:!literal});
      }
      forEachChild(node,child=>{walk(child,owner);});
    };
    walk(ast,undefined);
  }
  return {calls,issues};
}

// Whole-program exact comparison is deliberately stronger than an approximate
// taint analysis. It covers selectors/tokens passing through variables, function
// parameters, returns and branches without assuming that an unknown flow is safe.
// The caller supplies the unchanged pinned user oracle, not a new normalizer.
export async function compareAttributePrograms(before,after,{apiNames,compare}) {
  const original=inspectAttributeProgram(before,apiNames),candidate=inspectAttributeProgram(after,apiNames);
  const issues=[...original.issues,...candidate.issues],checks=[];
  const applicable=original.calls.length>0||candidate.calls.length>0;
  if(applicable) {
    const left=new Map(before.map(f=>[f.fileName,f.text])),right=new Map(after.map(f=>[f.fileName,f.text]));
    for(const name of new Set([...left.keys(),...right.keys()])) {
      if(!left.has(name)||!right.has(name)){issues.push({kind:'ATTRIBUTE_PROGRAM_CLOSURE_CHANGED',file:name});continue;}
      const result=await compare(left.get(name),right.get(name));
      checks.push({file:name,exact:result.exact===true,syntaxValid:result.syntaxValid});
      if(result.exact!==true)issues.push({kind:'ATTRIBUTE_PROGRAM_REQUIRES_PROOF',file:name});
    }
  }
  return {passed:issues.length===0,applicable,issues,checks,original,candidate,
    indirectFlowsCovered:applicable&&issues.length===0,
    namespaceRelocationAssumed:false,wholeMapAccepted:false};
}

const decode=s=>s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/giu,(_,v)=>v[0]==='#'?String.fromCodePoint(v[1].toLowerCase()==='x'?parseInt(v.slice(2),16):Number(v.slice(1))):({amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"})[v.toLowerCase()]);
export function inspectAttributeGui({xml,parseXml,schema,model,ownedOwners=[]}) {
  const env=createXmlEnvironment(parseXml(xml)),catalog=attributeCatalog(model);
  const issues=[...env.issues,...catalog.issues],calls=new Map(),external=[],indirect=[];
  const text=n=>n&&!n.selfClosing?decode(xml.slice(n.openEnd,n.closeStart)):undefined;
  const child=(n,tag)=>n?.children.find(c=>c.tag===tag);
  const literal=n=>{
    if(!n||n.children.some(c=>['FunctionCall','Variable','Parameter','Preset','ValueParam','ScriptCode'].includes(c.tag)))return;
    let value=text(child(n,'Value'));if(value===undefined)return;
    if(value.startsWith('"')){const parsed=readStringLiteralValue(value);if(!parsed)return;value=parsed.value;}
    return {value,type:child(n,'ValueType')?.attributes.Type,display:text(child(n,'DisplayText'))};
  };
  const key=n=>env.key({type:n.attributes.Type,id:n.attributes.Id},n.scope??'');
  const owned=value=>{
    if(/^\d+$/u.test(value))return value;
    const match=/^\[([^\]]+)\](\d+)$/u.exec(value);
    return match&&ownedOwners.includes(match[1])?match[2]:undefined;
  };
  const actuals=call=>call.children.filter(c=>c.tag==='Parameter').map(r=>env.resolveNode(r,call));
  const formal=(p,library,id)=>{const r=child(p,'ParameterDef');return r&&(r.attributes.Library??p.scope??'')===library&&r.attributes.Id===id;};
  for(const call of env.nodes.filter(n=>n.attributes.Type==='FunctionCall')) {
    const ref=child(call,'FunctionDef');
    const binding=schema.bindings.find(b=>b.libraryId===(ref?.attributes.Library??call.scope??'')&&b.functionDefId===ref?.attributes.Id);
    if(!binding)continue;
    const params=actuals(call),matches=params.filter(p=>formal(p,binding.libraryId,binding.firstParamId));
    if(matches.length!==1){issues.push({kind:'ATTRIBUTE_PARAMETER_REFERENCE_INVALID',call:key(call)});continue;}
    const p=matches[0],v=literal(p);
    if(!v){indirect.push({call:key(call),parameter:key(p)});continue;}
    const id=owned(v.value);
    if(id===undefined){external.push({call:key(call),selector:v.value});continue;}
    const entry=catalog.definitions.get(id);
    if(!entry){issues.push({kind:'ATTRIBUTE_DEFINITION_MISSING',id});continue;}
    if(entry.definition.type!==binding.attributeType)issues.push({kind:'ATTRIBUTE_API_DOMAIN_MISMATCH',id});
    if(v.type!==binding.valueType)issues.push({kind:'ATTRIBUTE_SELECTOR_TYPE_LOST',id});
    if(!v.display?.trim())issues.push({kind:'ATTRIBUTE_DISPLAY_MISSING',id});
    calls.set(key(call),{id,selector:v.value});
  }
  let comparisons=0;
  for(const call of env.nodes.filter(n=>n.attributes.Type==='FunctionCall')) {
    const ref=child(call,'FunctionDef'),cmp=schema.comparison;
    if((ref?.attributes.Library??call.scope??'')!==cmp.libraryId||ref?.attributes.Id!==cmp.functionDefId)continue;
    const params=actuals(call),operands=cmp.operandIds.map(id=>params.find(p=>formal(p,cmp.libraryId,id)));
    for(let i=0;i<2;i++) {
      const nested=env.resolveNode(child(operands[i],'FunctionCall'),operands[i]??call),bound=nested&&calls.get(key(nested));
      if(!bound)continue;
      const value=literal(operands[1-i]);if(!value)continue;comparisons++;
      const separator=value.value.indexOf('|'),selector=value.value.slice(0,separator),token=value.value.slice(separator+1);
      if(value.type!=='attributevalue')issues.push({kind:'ATTRIBUTE_VALUE_TYPE_LOST',id:bound.id});
      // Preserve the actual owner as well as the ID. A foreign owner with the
      // same numeric ID is not the same attribute.
      if(separator<0||![bound.selector,bound.id].includes(selector))issues.push({kind:'ATTRIBUTE_VALUE_OWNER_MISMATCH',id:bound.id});
      if(!catalog.definitions.get(bound.id).tokens.has(token))issues.push({kind:'ATTRIBUTE_VALUE_TOKEN_MISSING',id:bound.id,token});
      if(!value.display?.trim())issues.push({kind:'ATTRIBUTE_VALUE_DISPLAY_MISSING',id:bound.id});
    }
  }
  return {passed:issues.length===0,issues,ownedCalls:calls.size,comparisons,external,indirect,
    coverageComplete:external.length===0&&indirect.length===0,wholeMapAccepted:false};
}
