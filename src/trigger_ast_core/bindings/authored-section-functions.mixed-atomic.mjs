import {analyzeClosedAuthoredUnits} from '../analysis/closed-authored-units.qualified.mjs';
import assert from 'node:assert/strict';
import {AsyncLocalStorage} from 'node:async_hooks';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {indexAuthoredScriptSections} from '../model/authored-script-sections.typedef-initializer-anchors.mjs';
import {createGalaxyDocument} from '../model/galaxy-document.collections.mjs';
import {SyntaxKind as K, Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {scriptCodeFromBlock} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/sax-reader.js';

const scope = new AsyncLocalStorage();
const sha = s => createHash('sha256').update(s).digest('hex');
const getTypeName = n => new Printer().printNode(n);
const xmlCode = s => s.replace(/\r\n?/gu,'\n');
const key = e => JSON.stringify([e.library, e.type, e.id]);
const require = createRequire(new URL('../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js', import.meta.url));
const sax = require('sax');

// Only a completely supported unit of explicitly delimited, function-only authored sections qualifies. No
// inferred missing binding, map name, native API list or fallback is accepted.
function makeLegacyPlan(input, policy) {
  if (!policy.preserveAuthoredCode || input.existingTriggerData?.trim()) return [];
  const result = [];
  for (const [fileName, text] of [['primary.galaxy', input.script ?? ''], ['header.galaxy', input.header ?? '']]) {
    if (!text.trim() || !/^\/\/ Custom Script: \S/mu.test(text)) continue;
    const index = indexAuthoredScriptSections({fileName, text, expectedSha256: sha(text)});
    if(index.rejected.length)return [];
    const document = createGalaxyDocument({fileName, text});
    try {
      for (const section of index.sections) {
        if(!section.declarations.length)continue;
        // A mixed authored unit needs a complete global/structure ownership
        // contract. Partial function preservation can change call binding.
        if(section.library!==(input.libraryId??'Map') || section.declarations.some(d=>d.kind!==K.FunctionDeclaration))return [];
        const functions = section.declarations.map(d => {
          const found = document.ast.statements.filter(n => n.kind === K.FunctionDeclaration && n.name.name === d.name);
          if (found.length !== 1 || !found[0].body || found[0].pos !== d.start) return undefined;
          const fn = found[0], parameters = fn.parameters.map(p => ({name:p.name.name, type:getTypeName(p.type)}));
          // Ref/array/generic signatures need a separate ABI contract. A simple
          // identifier type can be checked directly against the GUI formal.
          if (parameters.some(p => !/^[A-Za-z_]\w*$/u.test(p.type)) ||
              !/^[A-Za-z_]\w*$/u.test(getTypeName(fn.type))) return undefined;
          return {name:d.name, declarationSha256:d.sha256, parameters, returnType:getTypeName(fn.type)};
        });
        if (functions.some(f => !f)) return [];
        result.push({...section, fileName, sourceSha256:sha(text), code:text.slice(section.start,section.end), functions});
      }
    } finally { document.dispose(); }
  }
  const names = result.flatMap(s => s.functions.map(f => f.name));
  assert.equal(new Set(names).size, names.length, 'AMBIGUOUS_AUTHORED_SECTION_FUNCTION');
  return result;
}

function makePlan(input,policy){
 const legacy=makeLegacyPlan(input,policy);
 if(legacy.length||!policy.preserveAuthoredCode||input.existingTriggerData?.trim())return legacy;
 const sources=[['primary.galaxy',input.script??''],['header.galaxy',input.header??'']].filter(([,text])=>text.trim()).map(([fileName,text])=>({fileName,text}));
 if(!sources.some(s=>/^\/\/ Custom Script: \S/mu.test(s.text)))return [];
 const closure=analyzeClosedAuthoredUnits({sources,declarationSources:input.galaxyDeclarations??[],libraryId:input.libraryId??'Map'});
 const prepared=new Map(),plan=[];
 for(const unit of closure.units){
  const names=new Set(unit.publicCalls.map(c=>c.name));
  const functions=unit.declarations.filter(d=>d.kind===K.FunctionDeclaration&&names.has(d.name));
  if(functions.some(f=>!f.hasBody||!/^[_A-Za-z]\w*$/u.test(f.returnType)||f.parameters.some(p=>!/^[_A-Za-z]\w*$/u.test(p.type))))continue;
  const privateDeclarations=unit.declarations.filter(d=>d.kind!==K.FunctionDeclaration||!names.has(d.name)).map(d=>({name:d.name,kind:d.kind}));
  prepared.set(unit.id,{...unit,code:unit.sourceCode,sha256:unit.sectionSha256,functions:functions.map(f=>({...f,declarationSha256:f.sourceSha256})),privateDeclarations,
   allFunctionNames:unit.declarations.filter(d=>d.kind===K.FunctionDeclaration).map(d=>d.name),closedMixedUnit:true});
 }
 // A connected source component is indivisible: an unsupported public ABI in
 // any member cannot leave a dependent half preserved and another half rebuilt.
 for(const component of closure.components)if(component.closurePassed&&component.units.every(id=>prepared.has(id)))
  plan.push(...component.units.map(id=>prepared.get(id)));
 Object.defineProperty(plan,'closure',{value:{kind:closure.kind,bindingOnly:true,components:closure.components,
  units:closure.units.map(({sourceCode,...unit})=>unit),guiEmissionAuthorized:false,semanticEquivalenceProved:false}});
 return plan;
}

export function shouldSkipAuthoredSectionDeclaration(node,libId){
 const context=scope.getStore();
 if(!context?.active)return false;
 if(node.kind===K.FunctionDeclaration&&context.plan.some(s=>s.library===libId&&s.functions.some(f=>f.name===node.name?.name)))return false;
 return context.plan.some(s=>s.library===libId&&s.privateDeclarations?.some(d=>d.kind===node.kind&&d.name===node.name?.name));
}
export function isPreservedAuthoredSectionFunction(node,libId){
 const context=scope.getStore();
 return !!context?.active&&context.plan.some(s=>s.library===libId&&(s.allFunctionNames??s.functions.map(f=>f.name)).includes(node.name?.name));
}

export async function withAuthoredSectionFunctions(input, policy, callback) {
  const context = {plan:makePlan(input,policy), records:new Map(), active:true};
  return scope.run(context, async () => {
    try { return await callback(context.plan); }
    finally { context.active=false; }
  });
}

function templateFor(fn, names) {
  return `${fn.name}(${names.map(n => `#PARAM(${n})`).join(', ')})${fn.returnType==='void'?';':''}`;
}
function checkedInterface(definition, fn, elements, library) {
  assert.equal(definition.library, library, 'AUTHORED_INTERFACE_LIBRARY');
  const formals = (definition.parameters ?? []).map(r => {
    assert.equal(r.library ?? library, library, 'AUTHORED_FORMAL_LIBRARY');
    assert(r.type===undefined||r.type==='ParamDef','AUTHORED_FORMAL_REFERENCE_TYPE');
    const found=[...new Set([elements[r.id],elements[`ParamDef:${r.id}`]].filter(Boolean))];
    assert.equal(found.length,1,'AUTHORED_FORMAL_MISSING_OR_AMBIGUOUS');
    const p = found[0];
    assert(p?.type==='ParamDef' && p.library===library, 'AUTHORED_FORMAL_TYPED_IDENTITY');
    assert(/^[A-Za-z_]\w*$/u.test(p.name), 'AUTHORED_FORMAL_IDENTIFIER');
    return p;
  });
  assert.equal(formals.length, fn.parameters.length, 'AUTHORED_INTERFACE_ARITY');
  for (let i=0;i<formals.length;i++) {
    assert.equal(formals[i].paramType?.type,fn.parameters[i].type,'AUTHORED_INTERFACE_FORMAL_TYPE');
    assert(!formals[i].isReference,'AUTHORED_INTERFACE_REFERENCE_FORMAL');
  }
  assert.equal(definition.returnType?.type, fn.returnType, 'AUTHORED_INTERFACE_RETURN_TYPE');
  assert.equal(new Set(formals.map(p=>p.name)).size,formals.length,'AUTHORED_INTERFACE_FORMAL_COLLISION');
  return templateFor(fn,formals.map(p=>p.name));
}

// The FunctionDef is the interface of an ORIGINAL source function. Inline
// substitution emits one call to it, never another runtime function or Native.
export function preserveAuthoredSectionFunction({sourceFunction,funcDef,elements,libId}) {
  const context=scope.getStore();
  if(!context?.active)return false;
  const matches=context.plan.filter(s=>s.library===libId && s.functions.some(f=>f.name===sourceFunction.name.name));
  if(!matches.length)return false;
  assert.equal(matches.length,1,'AMBIGUOUS_AUTHORED_FUNCTION_OWNER');
  const section=matches[0],fn=section.functions.find(f=>f.name===sourceFunction.name.name);
  const code=checkedInterface(funcDef,fn,elements,libId);
  assert(!funcDef.flags?.includes('CreateThread'),'AUTHORED_INTERFACE_THREADED');
  funcDef.flags=['Operator','NoScriptPrefix'];
  delete funcDef.actions;delete funcDef.localVariables;
  funcDef.scriptCode=code;
  context.records.set(key(funcDef),{type:funcDef.type,id:funcDef.id,library:libId,code,kind:'SOURCE_FUNCTION_CALL_INTERFACE',sourceFunction:fn.name});
  return true;
}

export function materializeAuthoredSections({elements,libId,idFromKey}) {
  const context=scope.getStore();if(!context?.active)return;
  for(const section of context.plan.filter(s=>s.library===libId)) {
    for(const fn of section.functions)assert([...context.records.values()].some(r=>r.sourceFunction===fn.name),'AUTHORED_SECTION_PARTIALLY_LOWERED');
    const id=idFromKey(`${libId}|authored-section|${section.fileName}|${section.sha256}`);
    assert(!elements[id],'AUTHORED_SECTION_ID_COLLISION');
    // The XML reader's ScriptCode DTO uses LF. Match that transport BEFORE
    // the existing exact semantic reparse check; never relax that check.
    const code=xmlCode(section.code);
    const element={type:'CustomScript',id,library:libId,name:section.label,displayName:section.label,scriptCode:code};
    elements[id]=element;
    context.records.set(key(element),{type:element.type,id,library:libId,code,kind:'ORIGINAL_AUTHORED_SECTION',sourceSha256:section.sourceSha256,sectionSha256:section.sha256});
  }
}

export function isAuthoredSectionElement(element) {
  const context=scope.getStore(),record=context?.active&&context.records.get(key(element));
  if(!record||typeof element.scriptCode!=='string'||xmlCode(element.scriptCode)!==xmlCode(record.code)||element.expressionCode!==undefined||element.flags?.includes('Native'))return false;
  if(record.type==='FunctionDef'){
    const flags=element.flags?.filter(f=>f!=='Action'&&f!=='Call');
    return flags?.length===2&&['Operator','NoScriptPrefix'].every(f=>flags.includes(f))&&element.actions===undefined&&!element.localVariables?.length;
  }
  return element.type==='CustomScript' && !element.flags?.length && !element.initFunc;
}

// Rebuild provenance from a separately read output graph and the sealed source.
// A serialized converter receipt is never permission for a raw field.
export function withVerifiedAuthoredSectionOutput(input,policy,libraries,callback) {
  return withAuthoredSectionFunctions(input,policy,()=>{
    const context=scope.getStore();
    for(const section of context.plan) {
      const library=libraries.get(section.library);assert(library,'AUTHORED_OUTPUT_LIBRARY_MISSING');
      const values=Object.values(library.elements);
      for(const fn of section.functions) {
        const refused=[];
        const interfaces=values.filter(e=>e.type==='FunctionDef'&&typeof e.scriptCode==='string').filter(e=>{
          try{return e.scriptCode===checkedInterface(e,fn,library.elements,library.id);}catch(error){refused.push({id:e.id,error:String(error.message)});return false;}
        });
        assert.equal(interfaces.length,1,'AUTHORED_OUTPUT_INTERFACE_MISSING_OR_AMBIGUOUS: '+JSON.stringify(refused));
        const e=interfaces[0];context.records.set(key(e),{type:e.type,id:e.id,library:library.id,code:e.scriptCode,kind:'SOURCE_FUNCTION_CALL_INTERFACE',sourceFunction:fn.name});
        assert(isAuthoredSectionElement(e),'AUTHORED_OUTPUT_INTERFACE_FLAGS');
      }
      const raw=values.filter(e=>e.type==='CustomScript'&&typeof e.scriptCode==='string'&&xmlCode(e.scriptCode)===xmlCode(section.code));
      assert.equal(raw.length,1,'AUTHORED_OUTPUT_RAW_SECTION_MISSING_OR_CHANGED');
      const e=raw[0];context.records.set(key(e),{type:e.type,id:e.id,library:library.id,code:section.code,kind:'ORIGINAL_AUTHORED_SECTION',sourceSha256:section.sourceSha256,sectionSha256:section.sha256});
      assert(isAuthoredSectionElement(e),'AUTHORED_OUTPUT_RAW_FLAGS_OR_INITIALIZER');
    }
    return callback(authoredSectionProof());
  });
}

export function isAuthoredSectionXml(fragment,library) {
  const context=scope.getStore();if(!context?.active)return false;
  let type,id,code='',fields=0,depth=0,capture=false;const flags=[];
  const parser=sax.parser(true,{trim:false,normalize:false});
  parser.onopentag=n=>{if(depth++===0){type=n.attributes.Type;id=n.attributes.Id;}if(n.name==='ScriptCode'){fields++;capture=true;}if(n.name.startsWith('Flag'))flags.push(n.name.slice(4));};
  parser.onclosetag=n=>{if(n==='ScriptCode')capture=false;depth--;};
  parser.ontext=parser.oncdata=s=>{if(capture)code+=s;};parser.write(fragment).close();
  // Use the established reversible XML block transport, never Galaxy-token or
  // whitespace normalization of executable code. Action/Call are serialized
  // from the definition's role booleans, not its flags array.
  const roleFlags=flags.filter(f=>f==='Action'||f==='Call');
  if(roleFlags.length>1)return false;
  return fields===1&&isAuthoredSectionElement({type,id,library,scriptCode:scriptCodeFromBlock(code),flags:flags.filter(f=>f!=='Action'&&f!=='Call')});
}

export function authoredSectionProof() {
  const context=scope.getStore();assert(context?.active,'AUTHORED_SECTION_SCOPE_REQUIRED');
  return {closure:context.plan.closure,sections:context.plan.map(s=>({library:s.library,fileName:s.fileName,label:s.label,sourceSha256:s.sourceSha256,sectionSha256:s.sha256,functions:s.functions,privateDeclarations:s.privateDeclarations,closedMixedUnit:s.closedMixedUnit})),
    records:[...context.records.values()].map(({code,...r})=>({...r,scriptCodeSha256:sha(code)})),
    newNative:0,newRuntimeFunctions:0,sourceBodyChanged:false,sourceCodeTransport:'EXACT_EXCEPT_XML_LINE_END_TRANSPORT',semanticEquivalenceProved:false,actualEditor:false};
}
