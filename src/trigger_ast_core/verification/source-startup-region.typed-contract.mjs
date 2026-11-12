import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {formalPresetRefs,presetDomain} from '../bindings/formal-preset-domain.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {canonicalSourceFunctionDeclaration} from '../model/source-function-declarations.mjs';
import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const printer=new Printer(),sha=s=>createHash('sha256').update(s).digest('hex');
const ref=e=>({library:e.library,type:e.type,id:e.id});
const key=(r,scope)=>{assert(r?.type&&r.id!==undefined,'STARTUP_GUI_TYPED_REFERENCE_REQUIRED');return JSON.stringify([r.library||scope,r.type,r.id]);};
const empty=v=>v===undefined||Array.isArray(v)&&v.length===0;
const voidZero=n=>n?.kind===K.FunctionDeclaration&&n.body&&n.type.kind===K.VoidKeyword&&!n.parameters.length&&!n.modifiers?.length;
const ifTemplate='if (#SUBFUNCS(if," && ")) {\n    #SUBFUNCS(then)\n}\n#IFHAVESUBFUNCS(else,else {\n)\n    #SUBFUNCS(else)\n#IFHAVESUBFUNCS(else,})';
const statements=n=>n?.kind===K.Block?n.statements:n?[n]:[];

/** Independent comparison of original AST operators against serialized GUI.
 * Only source-bound calls and a verified stock conditional grammar are covered.
 * Unknown expressions fail closed; no forward emitter or converter receipts. */
export function createSourceStartupRegionVerifier({program,groups,all,dependencies,refs,resolve,runtimeName,sourceBody,cleanNode}){
 const incoming=new Map();
 for(const r of refs){const k=key(r.target),rows=incoming.get(k)??[];rows.push(r);incoming.set(k,rows);}
 const cleanTarget=element=>{
  const stock=dependencies.get(element.library)?.elementsByType?.[element.type]?.[element.id]===element;
  if(!stock){cleanNode(element);return;}
  // Label references classify editor palette entries; they emit no Galaxy.
  // Every other unknown stock field remains unproved.
  assert((element.unknownXml??[]).every(n=>n.tag==='Label'&&
   Object.keys(n).every(k=>['tag','attributes','position'].includes(k))&&
   n.attributes?.Type==='Label'&&/^[A-Za-z0-9_]+$/u.test(n.attributes.Id??'')&&
   Object.keys(n.attributes).every(k=>['Type','Library','Id'].includes(k))),
   'STARTUP_GUI_UNKNOWN_STOCK_RUNTIME_METADATA');
  cleanNode({...element,unknownXml:[]});
 };
 const owned=(element,parent,edge)=>{
  cleanNode(element);
  const rows=incoming.get(key(ref(element)))??[];
  assert(rows.length===1&&key(rows[0].owner)===key(ref(parent))&&rows[0].path===edge,'STARTUP_GUI_NODE_OWNER_OR_ORDER');
  assert.equal(element.library,parent.library,'STARTUP_GUI_NODE_FOREIGN_SCOPE');
 };
 const carrier=(type,scope)=>{
  assert(type?.type,'STARTUP_GUI_TYPE_REQUIRED');
  if(type.type==='preset'){
   assert.equal(type.typeElement?.type,'Preset','STARTUP_GUI_PRESET_TYPE_REQUIRED');
   const preset=resolve(type.typeElement,scope,'Preset');
   assert(typeof preset.baseType==='string','STARTUP_GUI_PRESET_CARRIER_UNPROVED');
   return preset.baseType;
  }
  assert(!type.typeElement,'STARTUP_GUI_DEPENDENT_CARRIER_UNPROVED');
  assert(/^[A-Za-z_]\w*$/u.test(type.type),'STARTUP_GUI_CARRIER_UNPROVED');return type.type;
 };
 const sourceCallee=source=>{
  assert(source?.kind===K.CallExpression&&source.expression.kind===K.Identifier,'STARTUP_GUI_DIRECT_CALL_REQUIRED');
  assert.equal(program.getBinding(source.expression).status,'BOUND','STARTUP_GUI_SOURCE_CALL_UNBOUND');
  const declaration=canonicalSourceFunctionDeclaration(groups,program.declarationAt(source.expression));
  assert(declaration?.kind===K.FunctionDeclaration,'STARTUP_GUI_SOURCE_CALL_NOT_FUNCTION');return declaration;
 };
 const exactAtom=(source,text,expected,stringValue=false)=>{
  assert(typeof text==='string','STARTUP_GUI_SCALAR_TEXT_REQUIRED');
  if(source.kind===K.StringLiteral){
   assert.equal(expected,'string','STARTUP_GUI_STRING_CARRIER');
   const original=readStringLiteralValue(source.text),actual=stringValue?{bytes:Buffer.from(text,'utf8')}:readStringLiteralValue(text);
   assert(original&&actual&&original.bytes.equals(actual.bytes),'STARTUP_GUI_STRING_BYTES_CHANGED');return;
  }
  if(source.kind===K.TrueKeyword||source.kind===K.FalseKeyword){
   assert.equal(expected,'bool','STARTUP_GUI_BOOLEAN_CARRIER');
   assert.equal(text,source.kind===K.TrueKeyword?'true':'false','STARTUP_GUI_BOOLEAN_CHANGED');return;
  }
  if(source.kind===K.NumericLiteral){
   assert(['int','fixed'].includes(expected),'STARTUP_GUI_NUMBER_CARRIER');
   assert.equal(text,printer.printNode(source),'STARTUP_GUI_NUMBER_CHANGED');return;
  }
  if(source.kind===K.Identifier){
   assert.equal(program.getBinding(source).status,'BOUND','STARTUP_GUI_CONSTANT_UNBOUND');
   const declaration=program.declarationAt(source);
   assert(declaration?.kind===K.VariableDeclaration&&declaration.parent?.kind===K.SourceFile,'STARTUP_GUI_CONSTANT_DECLARATION');
   assert(declaration.modifiers?.some(m=>m.kind===K.ConstKeyword),'STARTUP_GUI_MUTABLE_IDENTIFIER_UNPROVED');
   assert.equal(printer.printNode(declaration.type),expected,'STARTUP_GUI_CONSTANT_CARRIER');
   assert.equal(text,source.name,'STARTUP_GUI_CONSTANT_IDENTITY_CHANGED');return;
  }
  assert.fail('STARTUP_GUI_EXPRESSION_KIND_UNPROVED:'+source.kind);
 };
 let trace,visited;
 function callNode(r,parent,edge,role){
  const call=resolve(r,parent.library,'FunctionCall');owned(call,parent,edge);
  const fields=new Set(['id','type','library','name','functionDef','parameters','subFunctions','subFunctionType','unknownXml']);
  assert(Object.entries(call).every(([k,v])=>fields.has(k)||v===undefined),'STARTUP_GUI_UNPROVED_CALL_FIELD');
  assert(!visited.has(key(ref(call))),'STARTUP_GUI_CALL_REUSED_OR_CYCLIC');visited.add(key(ref(call)));
  if(role)assert.equal(key(call.subFunctionType,call.library),key(ref(role)),'STARTUP_GUI_ACTION_ROLE_CHANGED');
  else assert(!call.subFunctionType,'STARTUP_GUI_UNEXPECTED_NESTED_ROLE');
  return call;
 }
 function nativeCall(source,call,definition,expected){
  const declaration=sourceCallee(source),name=source.expression.name;
  assert.equal(runtimeName(definition),name,'STARTUP_GUI_NATIVE_TARGET_CHANGED');
  assert(definition.flags?.includes('Native')&&!definition.flags.some(f=>['Event','Operator','CreateThread','SubFunctions','Template','Inline'].includes(f)),
   'STARTUP_GUI_NATIVE_ROLE');
  assert(!definition.scriptCode&&!definition.expressionCode&&empty(definition.actions)&&empty(definition.localVariables)&&empty(definition.subFunctionTypes),
   'STARTUP_GUI_NATIVE_RUNTIME_BODY');
  assert(declaration.modifiers?.some(m=>m.kind===K.NativeKeyword)&&!declaration.body,'STARTUP_GUI_BOUND_API_NOT_NATIVE');
  const signature=n=>JSON.stringify({result:printer.printNode(n.type),params:n.parameters.map(p=>({type:printer.printNode(p.type),reference:!!p.isReference}))});
  assert(groups.get(name)?.declarations.every(({node:n})=>n.kind===K.FunctionDeclaration&&!n.body&&n.modifiers?.some(m=>m.kind===K.NativeKeyword)&&signature(n)===signature(declaration)),
   'STARTUP_GUI_NATIVE_SOURCE_ABI_CONFLICT');
  const result=carrier(definition.returnType??{type:'void'},definition.library);
  assert(definition.flags.every(f=>['Native','NoScriptPrefix','Action','Call'].includes(f))&&
   definition.flags.includes(result==='void'?'Action':'Call')&&
   !definition.flags.includes(result==='void'?'Call':'Action'),'STARTUP_GUI_NATIVE_ACTION_VALUE_ROLE');
  assert(declaration.parent?.kind===K.SourceFile&&declaration.modifiers.length===1,'STARTUP_GUI_NATIVE_DECLARATION_ROLE');
  assert.equal(result,printer.printNode(declaration.type),'STARTUP_GUI_NATIVE_RETURN_ABI');
  if(expected)assert.equal(result,expected,'STARTUP_GUI_NESTED_CALL_CARRIER');
  assert(empty(call.subFunctions),'STARTUP_GUI_NATIVE_SUBFUNCTIONS');
  const formals=(definition.parameters??[]).map(r=>resolve(r,definition.library,'ParamDef'));
  assert.equal(formals.length,declaration.parameters.length,'STARTUP_GUI_NATIVE_FORMAL_ARITY');
  assert.equal(source.arguments.length,formals.length,'STARTUP_GUI_SOURCE_ARGUMENT_ARITY');
  const values=(call.parameters??[]).map((r,i)=>{const p=resolve(r,call.library,'Param');owned(p,call,'parameters['+i+']');return p;});
  assert.equal(values.length,formals.length,'STARTUP_GUI_ARGUMENT_CARDINALITY');
  const used=new Set();
  for(const [i,formal]of formals.entries()){
   assert(!formal.isMultiple,'STARTUP_GUI_VARIADIC_FORMAL_UNPROVED');
   const sourceFormal=declaration.parameters[i];assert(!sourceFormal.isReference,'STARTUP_GUI_NATIVE_SOURCE_REFERENCE_UNPROVED');
   let abi=carrier(formal.paramType,formal.library);
   if(formal.isReference&&abi==='unit')abi='unitref';
   else assert(!formal.isReference&&!sourceFormal.isReference,'STARTUP_GUI_REFERENCE_ABI_UNPROVED');
   assert.equal(abi,printer.printNode(sourceFormal.type),'STARTUP_GUI_NATIVE_FORMAL_ABI');
   const matches=values.filter(p=>key(p.parameterDef,p.library)===key(ref(formal)));
   assert.equal(matches.length,1,'STARTUP_GUI_FORMAL_ARGUMENT_BINDING');
   const param=matches[0];assert(!used.has(key(ref(param))),'STARTUP_GUI_ARGUMENT_REUSED');used.add(key(ref(param)));
   const allowed=new Set(['id','type','library','name','parameterDef','value','valueType','preset','functionCall','unknownXml']);
   assert(Object.entries(param).every(([k,v])=>allowed.has(k)||v===undefined),'STARTUP_GUI_UNPROVED_PARAM_FIELD');
   const shapes=['value','preset','functionCall'].filter(k=>param[k]!==undefined);
   assert.equal(shapes.length,1,'STARTUP_GUI_ARGUMENT_VALUE_SHAPE');
   const domains=formalPresetRefs(formal,formal.library);
   if(param.preset){
    assert(domains.length,'STARTUP_GUI_PRESET_HAS_NO_FORMAL_DOMAIN');
    const members=domains.flatMap(r=>{const p=presetDomain(r,resolve);assert(p.valid,'STARTUP_GUI_PRESET_DOMAIN_INVALID');return p.values;});
    const preset=resolve(param.preset,param.library,'PresetValue');cleanNode(preset);
    assert(members.some(m=>key(m.ref)===key(ref(preset))),'STARTUP_GUI_PRESET_OUTSIDE_FORMAL_DOMAIN');
    if(param.valueType)assert.equal(carrier(param.valueType,param.library),abi,'STARTUP_GUI_PRESET_VALUE_TYPE');
    exactAtom(source.arguments[i],preset.value,abi);
   }else if(param.functionCall){
    assert(!param.valueType,'STARTUP_GUI_NESTED_VALUE_TYPE_UNPROVED');
    const nested=callNode(param.functionCall,param,'functionCall');
    const target=resolve(nested.functionDef,nested.library,'FunctionDef');cleanTarget(target);
    nativeCall(source.arguments[i],nested,target,abi);
   }else{
    assert.equal(formal.paramType?.type==='preset',false,'STARTUP_GUI_REQUIRED_ENUM_BYPASSED');
    assert.equal(carrier(param.valueType,param.library),abi,'STARTUP_GUI_LITERAL_CARRIER');
    exactAtom(source.arguments[i],param.value,abi,abi==='string');
   }
  }
  trace.push({kind:'NATIVE_CALL',name,definition:ref(definition),source:program.location(source)});return result;
 }
 function ordinaryCall(source,call,target){
  const declaration=sourceCallee(source),name=source.expression.name;
  assert.equal(declaration,sourceBody(name),'STARTUP_GUI_ORDINARY_SOURCE_OWNER');
  assert(voidZero(declaration)&&!source.arguments.length,'STARTUP_GUI_ORDINARY_SOURCE_ABI');
  assert(target.flags?.includes('Action')&&!target.flags.some(f=>['Native','Event','CreateThread','SubFunctions','Template','Inline'].includes(f))&&
   empty(target.parameters)&&empty(call.parameters)&&empty(call.subFunctions)&&(target.returnType?.type??'void')==='void','STARTUP_GUI_ORDINARY_CALL_ABI');
  if(target.scriptCode){
   assert.deepEqual([...target.flags].sort(),['Action','Operator'],'STARTUP_GUI_PRESERVED_INTERFACE_FLAGS');
   assert(empty(target.actions)&&empty(target.localVariables),'STARTUP_GUI_PRESERVED_INTERFACE_RUNTIME_BODY');
   assert.equal(target.scriptCode.replace(/\s+/gu,''),name+'();','STARTUP_GUI_PRESERVED_INTERFACE_NOT_EXACT_SOURCE_CALL');
  }else{
   assert(target.flags.includes('NoScriptPrefix')&&!target.flags.includes('Operator'),'STARTUP_GUI_ORDINARY_DEFINITION_FLAGS');
   assert.equal(runtimeName(target),name,'STARTUP_GUI_ORDINARY_TARGET_CHANGED');
   const collisions=[...all.values()].flatMap(l=>Object.values(l.elements)).filter(e=>e.type==='FunctionDef'&&!e.disabled&&!e.scriptCode&&runtimeName(e)===name);
   assert.equal(collisions.length,1,'STARTUP_GUI_ORDINARY_RUNTIME_OWNER_AMBIGUOUS');
  }
  trace.push({kind:'SOURCE_CALL',name,definition:ref(target),source:program.location(declaration),sourceBodySha256:sha(printer.printNode(declaration))});
 }
 function statement(source,r,parent,edge,role){
  const call=callNode(r,parent,edge,role),target=resolve(call.functionDef,call.library,'FunctionDef');cleanTarget(target);
  if(source.kind===K.ExpressionStatement){
   assert(source.expression?.kind===K.CallExpression,'STARTUP_GUI_STATEMENT_KIND_UNPROVED');
   if(target.flags?.includes('Native'))nativeCall(source.expression,call,target,'void');
   else ordinaryCall(source.expression,call,target);
   return;
  }
  assert.equal(source.kind,K.IfStatement,'STARTUP_GUI_STATEMENT_KIND_UNPROVED');
  assert.equal(dependencies.get(target.library)?.elementsByType?.FunctionDef?.[target.id],target,'STARTUP_GUI_IF_NOT_LOADED_STOCK');
  assert.deepEqual([...target.flags].sort(),['Action','SubFunctions'],'STARTUP_GUI_IF_FLAGS');
  assert.equal(target.scriptCode,ifTemplate,'STARTUP_GUI_IF_SEMANTIC_TEMPLATE');
  assert(empty(target.parameters)&&empty(target.actions)&&empty(target.localVariables)&&empty(call.parameters)&&
   !target.expressionCode&&(target.returnType?.type??'void')==='void','STARTUP_GUI_IF_RUNTIME_BODY');
  const roles=(target.subFunctionTypes??[]).map(r=>resolve(r,target.library,'SubFuncType'));
  assert.equal(roles.length,3,'STARTUP_GUI_IF_ROLE_CARDINALITY');
  for(const [i,name]of ['if','then','else'].entries()){
   cleanNode(roles[i]);assert.equal(roles[i].library,target.library,'STARTUP_GUI_IF_ROLE_OWNER');
   assert.equal(roles[i].identifier??roles[i].name,name,'STARTUP_GUI_IF_ROLE_IDENTITY');
   assert.equal(!!roles[i].isAction,i>0,'STARTUP_GUI_IF_ROLE_ACTION_CONTRACT');assert(!roles[i].functionDef,'STARTUP_GUI_IF_ROLE_CONSTRAINT');
  }
  const children=call.subFunctions??[],partition=[[],[],[]];let previousRole=0;
  for(const [i,r]of children.entries()){
   const child=resolve(r,call.library,'FunctionCall'),index=roles.findIndex(role=>key(ref(role))===key(child.subFunctionType,child.library));
   assert(index>=previousRole&&index>=0,'STARTUP_GUI_IF_BRANCH_ORDER');previousRole=index;partition[index].push({r,edge:'subFunctions['+i+']'});
  }
  assert.equal(partition[0].length,1,'STARTUP_GUI_IF_CONDITION_CARDINALITY');
  const condition=partition[0][0],conditionCall=callNode(condition.r,call,condition.edge,roles[0]);
  const conditionTarget=resolve(conditionCall.functionDef,conditionCall.library,'FunctionDef');cleanTarget(conditionTarget);
  nativeCall(source.expression,conditionCall,conditionTarget,'bool');
  for(const [i,branch]of [source.thenStatement,source.elseStatement].entries()){
   const expected=statements(branch),actual=partition[i+1];assert.equal(actual.length,expected.length,'STARTUP_GUI_IF_BRANCH_CARDINALITY');
   for(let j=0;j<expected.length;j++)statement(expected[j],actual[j].r,call,actual[j].edge,roles[i+1]);
  }
  trace.push({kind:'IF',definition:ref(target),source:program.location(source)});
 }
 return ({statements:source,call,role})=>{
  trace=[];visited=new Set();const children=call.subFunctions??[];
  assert.equal(children.length,source.length,'STARTUP_GUI_REGION_STATEMENT_CARDINALITY');
  for(let i=0;i<source.length;i++)statement(source[i],children[i],call,'subFunctions['+i+']',role);
  return {kind:'INDEPENDENT_TYPED_SOURCE_STARTUP_REGION',passed:true,sourceStatements:source.length,visitedCalls:visited.size,
   targets:trace.filter(t=>t.kind==='SOURCE_CALL'),trace,converterReceiptsUsed:false,forwardEmitterUsed:false,wholeMapAccepted:false};
 };
}
