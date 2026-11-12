import {createHash} from 'node:crypto';
import {templateMacros} from '../../map_global_repair_v487_native_expression_identity_2026-10-27/graph/d5734da0691b-56a9139d7536-a7e6f1fe81bc-cf5412e476e04e5a-balanced-script-template.mjs';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer(),sha=text=>createHash('sha256').update(text).digest('hex');

// Derive an alias from complete loaded template bodies, never from a game API
// name or a fixed GUI ID. Variable ownership/type/scope must be checked by the
// caller before it may substitute an actual GUI reference.
export function proveTemplateCellSubstitution({automatic,explicit,cell,parameter}){
 const identifier=s=>typeof s==='string'&&/^[A-Za-z_]\w*$/u.test(s);
 if(!identifier(cell)||!identifier(parameter)||typeof automatic!=='string'||typeof explicit!=='string')return;
 function view(text,isAutomatic){
  const edits=[],uses={cell:0,parameters:new Set(),autos:new Set(),regions:new Set()};
  for(const macro of templateMacros(text)){
   const [name,annotation]=macro.args;if(!identifier(name))return;
   let replacement;
   if(macro.name==='AUTOVAR'){
    if(macro.args.length>2||annotation?.startsWith('ancestor:')||annotation==='parent')return;
    if(isAutomatic&&name===cell){uses.cell++;replacement='proofIterationCell';}
    else{uses.autos.add(name);replacement='proofAuto_'+name;}
   }else if(macro.name==='PARAM'&&macro.args.length===1){
    if(!isAutomatic&&name===parameter){uses.cell++;replacement='proofIterationCell';}
    else{uses.parameters.add(name);replacement='proofParam_'+name;}
   }else if(macro.name==='SUBFUNCS'&&macro.args.length===1){uses.regions.add(name);replacement='proofRegion_'+name+'();';}
   else return;
   edits.push({...macro,replacement});
  }
  if(!uses.cell||!uses.regions.size)return;
  let rewritten=text;for(const e of edits.toReversed())rewritten=rewritten.slice(0,e.start)+e.replacement+rewritten.slice(e.end);
  const ast=parseImmutableGalaxySyntax('void proofTemplate(){'+rewritten+'}','template-cell.galaxy');
  if(ast.parseDiagnostics.length)return;
  return {canonical:printer.printNode(ast.statements[0]),uses};
 }
 const left=view(automatic,true),right=view(explicit,false);
 if(!left||!right||left.canonical!==right.canonical)return;
 return {kind:'COMPLETE_TEMPLATE_CELL_SUBSTITUTION',automaticSha256:sha(automatic),explicitSha256:sha(explicit),cell,parameter,
  canonicalAstSha256:sha(left.canonical),uses:left.uses.cell,parameterRoles:[...left.uses.parameters],automaticRoles:[...left.uses.autos],regionRoles:[...left.uses.regions],
  completeTemplateAstEqual:true,variableBindingAuthorized:false,wholeProgramEquivalenceProved:false};
}
