// ABI facts from explicit value-returning Native metadata only. This does not
// infer a void result from an Action or the hidden arguments of an Event.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseTriggerXmlSync} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/sax-reader.js';
import {SyntaxKind as K,stringToToken,isKeywordTypeKind,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {createGalaxyDocument} from '../model/galaxy-document.collections.mjs';
import {mapParameterTypeToGalaxy,deriveNativeTypeMapping,withNamingIndexes} from '../../map_global_repair_v193_preset_reference_use_2026-10-19/types/189652cc1dc7-core.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const inventories=new WeakMap();
const checked=f=>{assert(f&&typeof f.fileName==='string'&&typeof f.text==='string'&&f.sha256===sha(f.text),'NATIVE_CALL_ABI_INPUT_SHA');return f;};
const keyword=s=>typeof s==='string'&&s!=='void'&&isKeywordTypeKind(stringToToken(s));
export function inspectExplicitNativeCallAbi({nativeMetadata,metadata=[],declarations=[]}){
 checked(nativeMetadata);assert(/(?:^|[\\/])NativeLib\.TriggerLib$/iu.test(nativeMetadata.fileName),'CANONICAL_NATIVE_METADATA_REQUIRED');
 const files=[nativeMetadata,...metadata],libraries=new Map(),owners=new Map();
 for(const f of files){checked(f);for(const[id,lib]of parseTriggerXmlSync(f.text)){assert(!libraries.has(id),'NATIVE_CALL_ABI_DUPLICATE_LIBRARY');libraries.set(id,lib);owners.set(id,f);}}
 const natives=parseTriggerXmlSync(nativeMetadata.text);assert.equal(natives.size,1);const native=[...natives.values()][0];
 const parsed=[],signatures=new Map();
 try{
  for(const f of declarations){checked(f);const doc=createGalaxyDocument(f);parsed.push(doc);
   for(const n of doc.ast.statements){if(n.kind!==K.FunctionDeclaration)continue;const rows=signatures.get(n.name.name)??[];rows.push({fileName:f.fileName,sha256:f.sha256,start:n.pos,end:n.end,node:n});signatures.set(n.name.name,rows);}
  }
  return withNamingIndexes(()=>{
   for(const lib of libraries.values())deriveNativeTypeMapping(lib,declarations);
   const carrier=(type,owner)=>{
    if(!type?.type||/^(?:any|sameas|return|void|struct)$/iu.test(type.type))return;
    const mapped=mapParameterTypeToGalaxy(type,owner,native,libraries);return keyword(mapped)?mapped:undefined;
   };
   const records=[],refused=[];
   for(const def of Object.values(native.elements??{})){
    if(def.type!=='FunctionDef'||!def.flags?.includes('Native'))continue;
    const identity={library:native.id,type:def.type,id:def.id,symbol:def.identifier??def.name};
    const reject=reason=>refused.push({...identity,reason});
    if(def.disabled||!def.flags.includes('Call')||def.flags.some(f=>['Action','Event','Operator','SubFunctions'].includes(f))||!def.returnType){reject('EXPLICIT_VALUE_RETURNING_CALL_REQUIRED');continue;}
    if(!/^[A-Za-z_]\w*$/u.test(identity.symbol??'')||def.scriptCode?.trim()||def.expressionCode?.trim()||(def.actions?.length??0)){reject('DIRECT_NATIVE_IDENTITY_REQUIRED');continue;}
    const result=carrier(def.returnType,native);if(!result){reject('RETURN_CARRIER_UNRESOLVED');continue;}
    const args=[];let reason;
    for(const ref of def.parameters??[]){
     const owner=libraries.get(ref.library??native.id),formal=owner?.elements?.[ref.id]??owner?.elementsByType?.ParamDef?.[ref.id];
     if(ref.type!=='ParamDef'||!formal||formal.type!=='ParamDef'||formal.library!==owner.id||formal.isReference||formal.arrayDimensions?.length||formal.arraySize!==undefined||args.some(a=>a.id===formal.id&&a.library===owner.id)){reason='FORMAL_IDENTITY_OR_ABI_UNSUPPORTED';break;}
     const type=carrier(formal.paramType,owner);if(!type){reason='FORMAL_CARRIER_UNRESOLVED';break;}
     args.push({library:owner.id,id:formal.id,type,parameterType:formal.paramType});
    }
    if(reason){reject(reason);continue;}
    const existing=signatures.get(identity.symbol)??[],witnesses=[];
    for(const item of existing){const n=item.node,actual={returnType:printer.printNode(n.type),parameterTypes:n.parameters.map(p=>printer.printNode(p.type))};
     assert(!n.body&&n.modifiers?.length===1&&n.modifiers[0].kind===K.NativeKeyword&&!n.parameters.some(p=>p.isReference),'NATIVE_CALL_ABI_SOURCE_COLLISION:'+identity.symbol);
     assert.deepEqual(actual,{returnType:result,parameterTypes:args.map(a=>a.type)},'NATIVE_CALL_ABI_METADATA_SOURCE_MISMATCH:'+identity.symbol);
     const{node,...witness}=item;witnesses.push(witness);
    }
    records.push({...identity,returnType:result,parameterTypes:args.map(a=>a.type),formals:args,metadata:{fileName:nativeMetadata.fileName,sha256:nativeMetadata.sha256},sourceWitnesses:witnesses,sourceDeclarationMissing:existing.length===0,sourceSignature:`native ${result} ${identity.symbol}(${args.map((a,i)=>a.type+' p'+i).join(', ')});`,runtimeFunctionCreated:false,guiNativeCreated:false});
   }
   assert.equal(new Set(records.map(r=>r.symbol)).size,records.length,'NATIVE_CALL_ABI_AMBIGUOUS_SYMBOL');
   const inventory={kind:'EXPLICIT_NATIVE_VALUE_CALL_ABI_INVENTORY',records,refused,inputPins:files.map(f=>({fileName:f.fileName,sha256:f.sha256})),declarationPins:declarations.map(f=>({fileName:f.fileName,sha256:f.sha256})),syntheticVoidOrHiddenArguments:false,benchmarkVerdictChanged:false,accepted:false};
   inventories.set(inventory,structuredClone(records));return inventory;
  });
 }finally{for(const d of parsed)d.dispose();}
}
// Use only a capability created in this operation; mutable JSON reports cannot
// authorize a source signature. These files are SDK inputs, never packed code.
export function selectMissingExplicitNativeCallAbi(inventory,names){
 const records=inventories.get(inventory);assert(records,'NATIVE_CALL_ABI_CAPABILITY_REQUIRED');assert(Array.isArray(names)&&names.length<=4096&&names.every(n=>typeof n==='string'&&/^[A-Za-z_]\w*$/u.test(n)),'NATIVE_CALL_ABI_REQUEST_BOUND');
 const wanted=[...new Set(names)],selected=records.filter(r=>r.sourceDeclarationMissing&&wanted.includes(r.symbol));
 const text=selected.map(r=>r.sourceSignature).join('\n');
 return {files:text?[{fileName:'VerifiedNativeMetadataValueCalls.galaxy',text,sha256:sha(text)}]:[],records:selected,unresolved:wanted.filter(n=>!selected.some(r=>r.symbol===n)),packedIntoMap:false,runtimeFunctionsCreated:0,guiNativeCreated:0,accepted:false};
}
