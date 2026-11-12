import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from './galaxy-program-context.lexical-parameters.mjs';
import {resolveBoundTypeAlias} from '../types/bound-type-alias.mjs';
import {SyntaxKind as K,TypeFlags,Printer,forEachChild,tokenToString} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};

// A finite overapproximation of callable bodies in an already closed include
// universe. This is observer reachability, not a GUI binding or a purity proof.
// It never chooses the first same-name body or assumes that arity proves ABI.
export function createFiniteFunctionReferenceTargets(files){
  const inputs=files.map(f=>{
    const digest=sha(f.text);
    if([f.sha256,f.contentSha256].some(hash=>hash!==undefined&&hash!==digest))throw Error('FUNCTION_REFERENCE_SOURCE_SHA_CHANGED:'+f.fileName);
    return {...f,sourceId:f.sourceId??f.fileName,contentSha256:digest};
  });
  const program=new GalaxyProgramContext(inputs,{files:inputs.map(({text,ast,...f})=>f)},sha,{checks:'binding'});
  for(const ast of program.documents.values())program.attachOriginal(ast);
  for(const file of files)program.attachOriginal(file.ast,file.fileName);
  const origin=n=>{const p=program.location(n);return p&&program.verifiedInputIdentity(p.sourceFile)?.contentSha256===p.contentSha256?p:undefined;};
  const shape=t=>{const r=t&&resolveBoundTypeAlias(program,t);return r?.status==='RESOLVED'?r:undefined;};
  const named=n=>{const p=origin(n);return p&&[p.sourceFile,p.contentSha256,p.start,p.end];};
  function typeKey(type,depth=0){
    if(depth>32)return;
    const s=shape(type);if(!s)return;
    if(s.nominal){const id=named(s.nominal);return id&&['nominal',id];}
    const n=s.node;
    if(n.kind===K.ArrayType){const e=typeKey(n.elementType,depth+1);return e&&['array',printer.printNode(n.size),e];}
    if(n.kind===K.MappedType){
      if(n.typeArguments?.length!==1)return;
      if(n.returnType?.kind===K.FuncrefKeyword){
        if(program.getBinding(n.typeArguments[0]).status!=='BOUND')return;
        const d=program.declarationAt(n.typeArguments[0]);
        const key=d?.kind===K.FunctionDeclaration&&signature(d,depth+1);return key&&['funcref',key];
      }
      const inner=typeKey(n.typeArguments[0],depth+1);
      return [K.StructrefKeyword,K.ArrayrefKeyword].includes(n.returnType?.kind)&&inner?[n.returnType.kind,inner]:undefined;
    }
    const token=tokenToString(n.kind);return token&&n.kind!==K.Identifier?['scalar',token]:undefined;
  }
  function signature(fn,depth=0){
    if(!origin(fn)||depth>32)return;
    const result=typeKey(fn.type,depth+1),args=fn.parameters.map(p=>typeKey(p.type,depth+1));
    return result&&args.every(Boolean)?[result,args.map((type,i)=>[type,!!fn.parameters[i].isReference])]:undefined;
  }
  function storageType(expression,depth=0){
    const n=un(expression);if(!n||depth>64||!origin(n))return;
    if(n.kind===K.Identifier){
      const d=program.declarationAt(n);return program.getBinding(n).status==='BOUND'&&[K.VariableDeclaration,K.ParameterDeclaration].includes(d?.kind)?d.type:undefined;
    }
    let base=shape(storageType(n.expression,depth+1));if(!base)return;
    if(base.node.kind===K.MappedType&&[K.StructrefKeyword,K.ArrayrefKeyword].includes(base.node.returnType?.kind))base=shape(base.node.typeArguments[0]);
    if(n.kind===K.ElementAccessExpression)return base?.node.kind===K.ArrayType&&program.carrierAt(n.argumentExpression)==='int'?base.node.elementType:undefined;
    if(n.kind===K.PropertyAccessExpression){
      const owner=base?.nominal,d=program.declarationAt(n);
      return owner?.kind===K.StructDeclaration&&d?.kind===K.PropertyDeclaration&&d.parent===owner&&origin(d)?d.type:undefined;
    }
  }
  const bodies=[];
  for(const ast of program.documents.values())for(const fn of ast.statements)if(fn.kind===K.FunctionDeclaration&&fn.body){
    const key=signature(fn);bodies.push({name:fn.name.name,signature:key&&JSON.stringify(key),declaration:named(fn)});
  }
  const records=[];
  const referenceDeclaration=expression=>{
    const s=shape(valueType(expression));
    return s?.node.kind===K.MappedType&&s.node.returnType?.kind===K.FuncrefKeyword?program.declarationAt(s.node.typeArguments[0]):undefined;
  };
  function valueType(expression,depth=0){
    const n=un(expression);if(!n||depth>64)return;
    const stored=storageType(n);if(stored)return stored;
    if(n.kind===K.CallExpression){
      const d=program.declarationAt(un(n.expression));
      if(d?.kind===K.FunctionDeclaration)return d.type;
      const reference=shape(valueType(n.expression,depth+1));
      return reference?.node.kind===K.MappedType&&reference.node.returnType?.kind===K.FuncrefKeyword?program.declarationAt(reference.node.typeArguments[0])?.type:undefined;
    }
  }
  function valueKey(expression){
    const n=un(expression);if(!n)return;
    if(n.kind===K.NullKeyword)return ['null'];
    if(n.kind===K.Identifier&&program.getBinding(n).status==='BOUND'){
      const d=program.declarationAt(n),sig=d?.kind===K.FunctionDeclaration&&signature(d);if(sig)return ['funcref',sig];
    }
    const stored=storageType(n);if(stored)return typeKey(stored);
    if(n.kind===K.CallExpression){
      const d=program.declarationAt(un(n.expression)),fn=d?.kind===K.FunctionDeclaration?d:referenceDeclaration(n.expression);
      return fn&&typeKey(fn.type);
    }
    const carrier=program.carrierAt(n);return ['int','fixed','bool','string'].includes(carrier)?['scalar',carrier]:undefined;
  }
  function accepts(type,expression){
    const expected=typeKey(type),actual=valueKey(expression);if(!expected||!actual)return false;
    if(actual[0]==='null'){
      try{return !!(program.checker.getTypeFromTypeNode(type).flags&TypeFlags.Nullable);}catch{return false;}
    }
    const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
    return same(expected,actual)||[K.StructrefKeyword,K.ArrayrefKeyword].includes(expected[0])&&same(expected[1],actual)||
      same(expected,['scalar','fixed'])&&same(actual,['scalar','int']);
  }
  function resolve(call){
    if(valueFlowIssues.length)return {status:'UNPROVEN',reason:'FUNCTION_REFERENCE_VALUE_FLOW_UNPROVEN',issues:valueFlowIssues};
    const s=shape(valueType(call.expression));
    if(s?.node.kind!==K.MappedType||s.node.returnType?.kind!==K.FuncrefKeyword)return {status:'UNPROVEN',reason:'NOT_BOUND_FUNCTION_REFERENCE_STORAGE'};
    const key=typeKey(s.node),sig=key?.[1];
    if(!sig||sig[1].length!==call.arguments.length)return {status:'UNPROVEN',reason:'FUNCTION_REFERENCE_ABI_OR_ARITY_UNPROVEN'};
    const declaration=referenceDeclaration(call.expression);
    if(!declaration||declaration.parameters.some((p,i)=>!accepts(p.type,call.arguments[i])))return {status:'UNPROVEN',reason:'FUNCTION_REFERENCE_ARGUMENT_TYPES_UNPROVEN'};
    const serialized=JSON.stringify(sig);
    // Unknown body signatures cannot be silently excluded from the universe.
    const targets=bodies.filter(b=>!b.signature||b.signature===serialized);
    const proof={status:'CLOSED_FINITE_REFERENCE',source:origin(call),signature:sig,targets,
      unknownSignatureBodiesIncluded:targets.filter(b=>!b.signature).length,allCompatibleBodiesIncluded:true,
      sourceChanged:false,guiBindingAuthorized:false,newNative:0,newRuntimeFunctions:0};
    records.push(proof);return proof;
  }
  function containsReference(type,seen=new Set()){
    const s=shape(type);if(!s||seen.has(s.node))return false;seen.add(s.node);
    if(s.node.kind===K.MappedType&&s.node.returnType?.kind===K.FuncrefKeyword)return true;
    if(s.node.kind===K.ArrayType)return containsReference(s.node.elementType,seen);
    if(s.node.kind===K.MappedType)return s.node.typeArguments.some(t=>containsReference(t,seen));
    return s.nominal?.kind===K.StructDeclaration&&s.nominal.members.some(m=>containsReference(m.type,seen));
  }
  function unsafeValueSource(node){
    if(node.kind===K.TypeAssertionExpression)return containsReference(node.type)?'UNCHECKED_FUNCTION_REFERENCE_CAST':undefined;
    if(node.kind!==K.CallExpression||un(node.expression)?.kind!==K.Identifier)return;
    const d=program.declarationAt(un(node.expression));
    if(d?.kind!==K.FunctionDeclaration||d.body)return;
    const isReference=p=>p.isReference||shape(p.type)?.node.kind===K.MappedType&&[K.StructrefKeyword,K.ArrayrefKeyword].includes(shape(p.type)?.node.returnType?.kind);
    return containsReference(d.type)||d.parameters.some(p=>isReference(p)&&containsReference(p.type))?'OPAQUE_FUNCTION_REFERENCE_VALUE_SOURCE':undefined;
  }
  const valueFlowIssues=[];
  function inspect(node,owner){
    if(node.kind===K.FunctionDeclaration)owner=node;
    const requireValue=(type,value,role)=>{
      if(containsReference(type)&&!accepts(type,value))valueFlowIssues.push({role,source:origin(node)});
    };
    if(node.kind===K.VariableDeclaration&&node.initializer)requireValue(node.type,node.initializer,'initializer');
    if(node.kind===K.BinaryExpression&&node.operatorToken?.kind===K.EqualsToken){
      const type=storageType(node.left);if(type)requireValue(type,node.right,'assignment');
    }
    if(node.kind===K.ReturnStatement&&node.expression&&owner)requireValue(owner.type,node.expression,'return');
    if(node.kind===K.CallExpression){
      const d=program.declarationAt(un(node.expression)),fn=d?.kind===K.FunctionDeclaration?d:referenceDeclaration(node.expression);
      fn?.parameters.forEach((p,i)=>requireValue(p.type,node.arguments[i],'argument'));
    }
    const unsafe=unsafeValueSource(node);if(unsafe)valueFlowIssues.push({role:unsafe,source:origin(node)});
    forEachChild(node,child=>{inspect(child,owner);});
  }
  for(const ast of program.documents.values())inspect(ast);
  return {resolve,unsafeValueSource,report:()=>({kind:'FINITE_BOUND_FUNCTION_REFERENCE_TARGETS',records,
    valueFlowIssues,files:inputs.map(({text,ast,...f})=>f),persistentCache:false,sourceChanged:false,wholeMapAccepted:false}),dispose:()=>program.dispose()};
}
