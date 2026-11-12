import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {Parser,Printer,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {globalVarName} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {withImplicitLibrary} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
import {openVerifiedSourceBindingProgram} from './verified-source-binding-program.mjs';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const key=(lib,type,id)=>JSON.stringify([lib,type,id]);
const literal=n=>n?.kind===K.NumericLiteral||n?.kind===K.ParenthesizedExpression&&literal(n.expression)||n?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(n.operator?.kind)&&n.operand?.kind===K.NumericLiteral;

/** Find unused, source-owned int constants whose original name the GUI did not
 * reproduce. Discovery does not modify GUI, prove initialization order, or
 * authorize adoption. All reachable original source files must be bound. */
export function inspectUnusedConstantMirrors({original,exported,guiLibraries,closedContext={},library='Map',existingTriggerData=false}){
 const result={kind:'UNUSED_SOURCE_CONSTANT_MIRROR_CANDIDATES',originalSha256:sha(original),exportedSha256:sha(exported),candidates:[],refused:[],guiPatchAuthorized:false,wholeMapAccepted:false};
 if(existingTriggerData)return {...result,reason:'PRESERVE_EXISTING_GUI_STRUCTURE'};
 const bound=openVerifiedSourceBindingProgram(original,closedContext);if(bound.reason)return {...result,reason:bound.reason};
 try{
  const {program,ast}=bound,gui=guiLibraries.get(library);assert(gui,'UNUSED_CONSTANT_GUI_LIBRARY');
  const all=[...new Set(Object.values(gui.elements))],rootVariables=new Set(),visited=new Set();
  function root(r){const owner=r.library??library;if(owner!==library||!r.type||!r.id)return;const k=key(owner,r.type,r.id);if(visited.has(k))return;visited.add(k);
   const found=[...new Set([gui.elements[r.type+':'+r.id],gui.elements[r.id]].filter(e=>e?.type===r.type))];if(found.length!==1)return;
   if(r.type==='Variable')rootVariables.add(k);if(r.type==='Category')for(const c of found[0].items??[])root(c);
  }for(const r of gui.items??[])root(r);
  const native=program.documents.get('mapscript.galaxy');assert(native?.text===original);
  const nativeAst=new Parser().parseFile('native-export.galaxy',exported);assert.equal(nativeAst.parseDiagnostics.length,0,'UNUSED_CONSTANT_NATIVE_SYNTAX');
  const source=ast.statements.filter(n=>n.kind===K.VariableDeclaration&&n.type.kind===K.IntKeyword&&n.modifiers?.length===1&&n.modifiers[0].kind===K.ConstKeyword&&literal(n.initializer));
  const candidatesByName=new Map(source.map(n=>[n.name.name,n])),occurrences=new Map(source.map(n=>[n.name.name,[]]));
  for(const [file,doc]of program.documents){program.attachOriginal(doc);function walk(n){if(n.kind===K.Identifier&&occurrences.has(n.name))occurrences.get(n.name).push({file,node:n,declaration:n.parent?.kind===K.VariableDeclaration&&n.parent.name===n});forEachChild(n,walk);}walk(doc);}
  const vars=all.filter(e=>e.type==='Variable'&&rootVariables.has(key(e.library??library,e.type,e.id))&&e.isConstant&&e.variableType?.type==='int'&&!e.isArray);
  const nativeGlobals=nativeAst.statements.filter(n=>n.kind===K.VariableDeclaration),nativeOccurrences=new Map();
  function scanNative(n){if(n.kind===K.Identifier){const rows=nativeOccurrences.get(n.name)??[];rows.push({node:n,declaration:n.parent?.kind===K.VariableDeclaration&&n.parent.name===n});nativeOccurrences.set(n.name,rows);}forEachChild(n,scanNative);}scanNative(nativeAst);
  for(const v of vars){
   const name=v.identifier??v.name,n=candidatesByName.get(name);if(!n)continue;
   const reject=reason=>result.refused.push({name,gui:{library:v.library??library,type:v.type,id:v.id},reason});
   const found=occurrences.get(name);if(found.length!==1||!found[0].declaration||found[0].file!=='mapscript.galaxy'){reject('ORIGINAL_CONSTANT_REFERENCED_OR_AMBIGUOUS');continue;}
   const emitted=withImplicitLibrary(library,()=>globalVarName(library,v));if(emitted===name)continue;
   const target=nativeGlobals.filter(x=>x.name.name===emitted),references=nativeOccurrences.get(emitted)??[];
   if(target.length!==1||target[0].type.kind!==K.IntKeyword||target[0].modifiers?.length!==1||target[0].modifiers[0].kind!==K.ConstKeyword||!literal(target[0].initializer)||printer.printNode(target[0].initializer)!==printer.printNode(n.initializer)||references.length!==1||!references[0].declaration){reject('NATIVE_CONSTANT_DECLARATION_OR_USES_NOT_EXACT');continue;}
   const targetKey=key(v.library??library,v.type,v.id),uses=[];
   for(const owner of all){function scan(value,parts){if(!value||typeof value!=='object')return;if(Array.isArray(value)){value.forEach((x,i)=>scan(x,[...parts,String(i)]));return;}
     if(parts.length&&value.type&&value.id&&key(value.library??owner.library??library,value.type,value.id)===targetKey)uses.push({owner,path:parts.join('.')});
     for(const [k,x]of Object.entries(value))scan(x,[...parts,k]);
    }scan(owner,[]);}
   if(uses.some(u=>u.owner.type!=='Category'||!/^items\.\d+$/u.test(u.path))){reject('GUI_CONSTANT_HAS_NONCATEGORY_REFERENCE');continue;}
   result.candidates.push({sourceName:name,sourceType:'int',sourceDeclaration:original.slice(n.pos,n.end),sourceDeclarationSha256:sha(original.slice(n.pos,n.end)),gui:{library:v.library??library,type:'Variable',id:v.id,identifier:name},nativeEmittedName:emitted,representation:'DISABLED_UNUSED_CONSTANT_REFERENCE_ONLY',references:[],
    originalUsesAcrossBoundClosure:0,nativeUsesOutsideDeclaration:0,categoryReferences:uses.length,requiredProofs:['ORIGINAL_INCLUDE_AND_GLOBAL_INITIALIZER_ORDER','DISABLED_CONSTANT_NATIVE_EXPORT','COMPLETE_PROGRAM_AND_ATTRIBUTES']});
  }
  return {...result,closure:bound.closure,allReachableOriginalSourcesBound:true};
 }finally{bound.dispose();}
}
