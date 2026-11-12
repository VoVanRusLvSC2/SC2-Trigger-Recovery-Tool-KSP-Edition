import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from './galaxy-program-context.binding-mode.mjs';
import {indexAuthoredScriptSections} from './authored-script-sections.typedef-initializer-anchors.mjs';
import {boundStorageShape} from './bound-storage-shape.mjs';
import {resolveBoundTypeAlias} from '../types/bound-type-alias.mjs';
import {logicalSourcePath} from './source-ownership.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');

// Original storage declarations only, selected through exact authored sections.
// No source text is rewritten; include-file storage keeps its separate index.
export function createAuthoredStorageIndex(input,sections){
 const sources=[['primary.galaxy',input.script??''],['header.galaxy',input.header??'']].filter(([,text])=>text.trim()).map(([fileName,text])=>({fileName,sourceId:fileName,text,owned:true,contentSha256:sha(text)}));
 const files=[...sources,...(input.galaxyDeclarations??[]).map(s=>({...s,sourceId:s.fileName,contentSha256:sha(s.text)}))];
 const program=new GalaxyProgramContext(files,{files,dependencies:[]},sha,{checks:'binding'}),owned=new Set(),globals=new Map(),types=new Map();
 let active=true;
 const record=node=>{const p=program.location(node),text=program.inputs.get(p.sourceFile).text;return {name:node.name.name,owner:logicalSourcePath(p.sourceFile),sourceSha256:p.contentSha256,declarationStart:node.pos,declarationEnd:node.end,declarationSha256:sha(text.slice(node.pos,node.end))};};
 try{
  for(const ast of program.documents.values())program.attachOriginal(ast);
  for(const source of sources){
   const selected=sections.filter(s=>s.fileName===source.fileName);if(!selected.length)continue;
   const index=indexAuthoredScriptSections({fileName:source.fileName,text:source.text,expectedSha256:source.contentSha256});assert(!index.rejected.length,'AUTHORED_STORAGE_SECTION_INDEX_REJECTED');
   const ast=program.documents.get(source.fileName),byStart=new Map(ast.statements.map(n=>[n.pos,n]));
   for(const section of selected){
    assert.equal(section.sourceSha256,source.contentSha256,'AUTHORED_STORAGE_SOURCE_CHANGED');
    const matches=index.sections.filter(s=>s.library===section.library&&s.sha256===section.sha256&&s.start===section.start&&source.text.slice(s.start,s.end)===section.code);
    assert.equal(matches.length,1,'AUTHORED_STORAGE_SECTION_NOT_ORIGINAL');
    for(const d of matches[0].declarations){const node=byStart.get(d.start);assert(node?.kind===d.kind&&node.name?.name===d.name,'AUTHORED_STORAGE_DECLARATION_IDENTITY');owned.add(node);}
   }
  }
  for(const ast of program.documents.values())for(const node of ast.statements){
   if([K.StructDeclaration,K.TypedefDeclaration].includes(node.kind)){const rows=types.get(node.name.name)??[];rows.push(node);types.set(node.name.name,rows);}
   if(!owned.has(node)||node.kind!==K.VariableDeclaration)continue;
   const shape=boundStorageShape(program,node.type),rows=globals.get(node.name.name)??[];
   rows.push({node,shape,record:Object.freeze({...record(node),elementType:shape.elementType,rank:shape.rank,dimensions:shape.dimensions&&Object.freeze([...shape.dimensions]),constant:!!node.modifiers?.some(m=>m.kind===K.ConstKeyword),static:!!node.modifiers?.some(m=>m.kind===K.StaticKeyword)})});globals.set(node.name.name,rows);
  }
 }catch(error){program.dispose();throw error;}
 const rootFor=name=>{
  assert(active,'AUTHORED_STORAGE_INDEX_EXPIRED');const rows=globals.get(name)??[];
  return rows.length===1&&!program.conflicts.has(name)&&rows[0].shape.status==='RESOLVED'&&!rows[0].record.static?rows[0]:undefined;
 };
 return Object.freeze({
  rootCount:globals.size,
  dispose(){if(active){active=false;program.dispose();}},
  resolveGlobal(name){const root=rootFor(name);return root?{status:'UNIQUE_GLOBAL_VALUE',declaration:root.record}:{status:'MISSING_OR_UNPROVED_AUTHORED_STORAGE'};},
  isStructType(name){assert(active,'AUTHORED_STORAGE_INDEX_EXPIRED');const rows=types.get(name)??[];if(rows.length!==1)return rows.length>1;const n=rows[0];return n.kind===K.StructDeclaration||!!resolveBoundTypeAlias(program,n.type).nominal;},
  resolveAccess(name,steps,mode='read'){
   const root=rootFor(name),fail=reason=>({status:'UNSUPPORTED_SOURCE_ACCESS',reason});
   if(!root||!Array.isArray(steps)||steps.length>32||!['read','write'].includes(mode))return fail('AUTHORED_ROOT_OR_ACCESS_NOT_PROVED');
   if(mode==='write'&&root.record.constant)return fail('READONLY_AUTHORED_ROOT');
   let type=resolveBoundTypeAlias(program,root.node.type),axis=0;const members=[],normalized=[];
   for(const step of steps){
    if(type.status!=='RESOLVED')return fail('AUTHORED_ACCESS_ALIAS_UNPROVED');
    if(step.kind==='index'){
     if(type.node.kind!==K.ArrayType||step.index!==axis++)return fail('AUTHORED_ARRAY_AXIS');
     normalized.push({kind:'index',index:step.index});type=resolveBoundTypeAlias(program,type.node.elementType);
    }else if(step.kind==='member'){
     const structure=type.nominal;
     if(type.node.kind===K.ArrayType||structure?.kind!==K.StructDeclaration||!owned.has(structure))return fail('AUTHORED_NOMINAL_OWNER_NOT_PRESERVED');
     const fields=structure.members.filter(n=>n.kind===K.PropertyDeclaration&&n.name.name===step.name);if(fields.length!==1)return fail('AUTHORED_MEMBER_NOT_UNIQUE');
     const field=fields[0];if(mode==='write'&&field.modifiers?.some(m=>m.kind===K.ConstKeyword))return fail('READONLY_AUTHORED_MEMBER');
     members.push({...record(field),struct:structure.name.name,structDeclarationSha256:record(structure).declarationSha256});normalized.push({kind:'member',name:field.name.name});type=resolveBoundTypeAlias(program,field.type);
    }else return fail('AUTHORED_ACCESS_STEP_UNSUPPORTED');
   }
   const shape=type.status==='RESOLVED'?boundStorageShape(program,type.node):type;
   if(shape.status!=='RESOLVED'||shape.nominal||shape.rank||shape.node.kind===K.MappedType||!/^[_A-Za-z]\w*$/u.test(shape.elementType??'')||shape.elementType==='void')return fail('AUTHORED_COMPLETE_SCALAR_REQUIRED');
   return {status:'UNIQUE_SCALAR_ACCESS',access:{root:root.record,members,steps:normalized,elementType:shape.elementType,indexCount:axis,mode}};
  }
 });
}
