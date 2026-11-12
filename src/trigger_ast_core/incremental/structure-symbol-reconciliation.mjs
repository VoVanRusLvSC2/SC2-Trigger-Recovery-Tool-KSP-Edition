// A declaration-only transaction: repair an explicit full type name stored in
// XML's stem field. No elements, folders, references or other bytes are rebuilt.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {xmlTree} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {generatedStructureStem} from '../model/generated-structure-stem.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
export function reconcileStructureSymbolStems(xml,galaxy){
 const source=parseImmutableGalaxySyntax(galaxy,'structure-symbol-source');assert.equal(source.parseDiagnostics.length,0,'STRUCTURE_SYMBOL_SOURCE_SYNTAX');
 const structs=source.statements.filter(n=>n.kind===K.StructDeclaration),names=new Set(structs.map(n=>n.name.name));
 assert.equal(names.size,structs.length,'STRUCTURE_SYMBOL_SOURCE_AMBIGUOUS');
 const tree=xmlTree(xml),edits=[],refused=[],records=[];
 function visit(node,library){
  if(node.tag==='Library')library=node.attributes.Id;
  if(node.tag==='Element'&&node.attributes.Type==='Structure'){
   const identifiers=node.children.filter(n=>n.tag==='Identifier');
   if(identifiers.length===1){
    const id=identifiers[0],raw=xml.slice(id.openEnd,id.closeStart),name=raw.trim(),prefix=(library?'lib'+library+'_':'')+'gs_';
    const stem=names.has(name)?generatedStructureStem(name,prefix):undefined;
    if(stem!==undefined){
     // An already valid stem can itself equal another source type. Never
     // rename it when its currently generated full name is also authored.
     if(names.has(prefix+name))refused.push({library:library??'Map',id:node.attributes.Id,name,reason:'CURRENT_QUALIFIED_NAME_IS_AN_AUTHORED_TYPE'});
     else if(!id.children.length&&/^[A-Za-z_][A-Za-z_0-9]*$/u.test(name)){
      const leading=raw.length-raw.trimStart().length,start=id.openEnd+leading;
      edits.push({start,end:start+name.length,from:name,to:stem});records.push({library:library??'Map',id:node.attributes.Id,sourceType:name,oldIdentifier:name,newIdentifier:stem,compilerPrefix:prefix,generatedTypeAfter:prefix+stem});
     }
    }
   }
  }
  for(const child of node.children)visit(child,library);
 }
 visit(tree);
 let result='',cursor=0;const inverse=[];
 for(const edit of edits.sort((a,b)=>a.start-b.start)){assert(edit.start>=cursor,'STRUCTURE_SYMBOL_EDIT_OVERLAP');result+=xml.slice(cursor,edit.start);inverse.push({start:result.length,end:result.length+edit.to.length,text:edit.from});result+=edit.to;cursor=edit.end;}
 result+=xml.slice(cursor);xmlTree(result);
 let restored=result;for(const edit of inverse.toReversed())restored=restored.slice(0,edit.start)+edit.text+restored.slice(edit.end);
 assert.equal(restored,xml,'STRUCTURE_SYMBOL_INVERSE_NOT_EXACT');
 return {xml:result,proof:{kind:'SOURCE_BOUND_GENERATED_STRUCTURE_STEM_TRANSACTION',records,refused,sourceSha256:sha(galaxy),beforeXmlSha256:sha(xml),afterXmlSha256:sha(result),
   allOtherXmlBytesExactByInverse:true,newElementIds:0,deletedElementIds:0,treeRebuilt:false,wholeProgramOracleStillRequired:true}};
}
