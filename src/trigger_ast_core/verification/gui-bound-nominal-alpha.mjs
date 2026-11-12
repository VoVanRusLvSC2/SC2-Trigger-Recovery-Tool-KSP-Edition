import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../../trigger_ast_implementation_2026-10-07/source-bug-v1670/verified-input-v1689/galaxy-program-context.identity.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {globalVariables,globalVariableNames,withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {memberVarName,structureTypeName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {createGuiCapabilityCatalog} from '../bindings/gui-capability-catalog.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const walk=(node,visit,parent)=>{visit(node,parent);forEachChild(node,child=>walk(child,visit,node));};
// bindSourceFile assigns a per-parse numeric node id to array type nodes.
// It is not a Galaxy type/member identity or a serialized GUI element id.
const ignored=new Set(['parent','pos','end','line','char','syntaxTokens','symbol','locals','flowNode','id']);
const shape=n=>!n||typeof n!=='object'?n:Array.isArray(n)?n.map(shape):Object.fromEntries(Object.keys(n).filter(k=>!ignored.has(k)).sort().map(k=>[k,shape(n[k])]));
const type=n=>JSON.stringify(shape(n.type));
const flags=n=>JSON.stringify((n.modifiers??[]).map(m=>m.kind));
function program(text,fileName){const files=[{fileName,text,sourceId:fileName,owned:true,contentSha256:sha(text)}];const p=new GalaxyProgramContext(files,{files,dependencies:[]},sha);const ast=p.documents.get(fileName);assert(!ast.parseDiagnostics.length,'NOMINAL_ALPHA_SYNTAX');p.attachOriginal(ast);return {p,ast};}
function unique(nodes){const result=new Map();for(const n of nodes){assert(!result.has(n.name.name),'NOMINAL_ALPHA_DUPLICATE_DECLARATION');result.set(n.name.name,n);}return result;}

/** Proof view only. A field spelling is changed only through its nominal
 * declaration and exact GUI Library/Type/Id; unrelated fields and shadowing
 * locals never follow a text replacement. Equality is still the oracle's job.
 * Complete external/runtime reflection closure is a separate mandatory gate. */
export function normalizeGuiBoundNominalAlpha(before,after,libraries,{implicitLibraryId='Map',externalSources=[]}={}) {
 const left=program(before,'nominal-before.galaxy'),right=program(after,'nominal-after.galaxy');
 try {
  const catalog=createGuiCapabilityCatalog(libraries);assert(!catalog.issues.length,'NOMINAL_ALPHA_GUI_AMBIGUITY');
  const sourceGlobals=unique(left.ast.statements.filter(n=>n.kind===K.VariableDeclaration));
  const targetGlobals=unique(right.ast.statements.filter(n=>n.kind===K.VariableDeclaration));
  const sourceStructs=unique(left.ast.statements.filter(n=>n.kind===K.StructDeclaration));
  const targetStructs=unique(right.ast.statements.filter(n=>n.kind===K.StructDeclaration));
  const mapping=new Map(),records=[],refused=[],targets=new Set();
  function add(declaration,actual,record) {
    const old=declaration.name.name;if(old===actual)return;
    assert(!mapping.has(declaration),'NOMINAL_ALPHA_MULTIPLE_GUI_OWNERS');
    const key=JSON.stringify([record.kind,record.structure,actual]);assert(!targets.has(key),'NOMINAL_ALPHA_TARGET_COLLISION');targets.add(key);
    mapping.set(declaration,actual);records.push({...record,source:old,target:actual,sourcePosition:declaration.pos,sourceSha256:sha(before)});
  }
  for(const [owner,library]of libraries) {
    const globals=globalVariables(library),names=owner===implicitLibraryId?withImplicitLibrary(owner,()=>globalVariableNames(owner,globals)):globalVariableNames(owner,globals);
    for(const variable of globals) {
      const a=sourceGlobals.get(variable.identifier),name=names.get(variable.id),b=targetGlobals.get(name);
      if(!a||!b||a.name.name===name)continue;
      assert.equal(type(a),type(b),'NOMINAL_ALPHA_GLOBAL_TYPE');assert.equal(flags(a),flags(b),'NOMINAL_ALPHA_GLOBAL_MODIFIERS');
      let capture=sourceGlobals.has(name);
      walk(left.ast,(n,parent)=>{if(n.kind===K.Identifier&&n.name===name&&!(parent?.kind===K.PropertyAccessExpression&&parent.name===n))capture=true;});
      if(capture){refused.push({kind:'global',source:a.name.name,target:name,reason:'TARGET_LEXICAL_CAPTURE'});continue;}
      add(a,name,{kind:'global',library:owner,id:variable.id});
    }
    for(const structure of Object.values(library.elements).filter(e=>e.type==='Structure')) {
      const getName=()=>structureTypeName({type:'Structure',library:owner,id:structure.id},library,undefined,libraries);
      const name=owner===implicitLibraryId?withImplicitLibrary(owner,getName):getName();
      const a=sourceStructs.get(name),b=targetStructs.get(name);if(!a||!b)continue;
      const members=(structure.variables??[]).map(ref=>catalog.resolve(ref,owner,'Variable'));
      assert(members.every(Boolean),'NOMINAL_ALPHA_MEMBER_GUI_OWNER');
      assert.equal(a.members.length,members.length,'NOMINAL_ALPHA_SOURCE_LAYOUT');assert.equal(b.members.length,members.length,'NOMINAL_ALPHA_TARGET_LAYOUT');
      const original=unique(a.members),actual=unique(b.members);
      for(const [i,member]of members.entries()) {
        const x=original.get(member.identifier),target=memberVarName(member,implicitLibraryId),y=actual.get(target);
        assert(x&&y&&x===a.members[i]&&y===b.members[i],'NOMINAL_ALPHA_MEMBER_LAYOUT_OR_IDENTITY');
        assert.equal(type(x),type(y),'NOMINAL_ALPHA_MEMBER_TYPE');assert.equal(flags(x),flags(y),'NOMINAL_ALPHA_MEMBER_MODIFIERS');
        assert(!original.has(target)||target===x.name.name,'NOMINAL_ALPHA_MEMBER_CAPTURE');
        add(x,target,{kind:'member',structure:name,library:owner,id:member.id,structureId:structure.id});
      }
    }
  }
  // Textual source references are conservative vetoes. This does not assert
  // absence of opaque engine entry/reflection, or authorize whole-map MATCH.
  const spellings=new Set([...mapping].flatMap(([d,name])=>[d.name.name,name]));
  let observed=false;
  walk(left.ast,n=>{if(n.kind===K.StringLiteral&&[...spellings].some(s=>n.value===s||n.value?.includes('.'+s)))observed=true;});
  for(const text of externalSources) {
    const ext=program(typeof text==='string'?text:text.text,'nominal-external.galaxy');
    try{walk(ext.ast,n=>{if(n.kind===K.Identifier&&spellings.has(n.name)||n.kind===K.StringLiteral&&[...spellings].some(s=>n.value===s||n.value?.includes('.'+s)))observed=true;});}finally{ext.p.dispose();}
  }
  assert(!observed,'NOMINAL_ALPHA_EXTERNAL_OR_TEXTUAL_OBSERVER');
  const edits=[];
  walk(left.ast,(node,parent)=>{
    if(node.kind!==K.Identifier)return;
    const declaration=parent?.name===node&&mapping.has(parent)?parent:left.p.declarationAt(node);
    if(!mapping.has(declaration))return;
    const binding=left.p.getBinding(node);assert.equal(binding.status,'BOUND','NOMINAL_ALPHA_REFERENCE_NOT_BOUND');
    edits.push({node,name:mapping.get(declaration)});
  });
  for(const edit of edits)edit.node.name=edit.name;
  return {before:edits.length?printer.printFile(left.ast):before,after,records,refused,edits:edits.length,
    sourceOrCandidateChanged:false,wholeProgramEquivalent:false,engineReflectionClosureProved:false,benchmarkChanged:false};
 } finally{left.p.dispose();right.p.dispose();}
}
