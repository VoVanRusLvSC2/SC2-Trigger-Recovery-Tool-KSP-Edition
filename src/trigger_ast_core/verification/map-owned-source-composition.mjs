// Comparison view only. Inline complete, actual archive-owned include bodies
// at their include sites. Unresolved external includes and all other text stay.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {logicalSourcePath} from '../model/source-ownership.mjs';
import {readStringLiteralValue} from '../types/string-literal-value.mjs';
import {openMpqReader} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/@modkit/blizzard-mpq/src/mpq/codec.js';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const owner=name=>logicalSourcePath(name.replace(/\.galaxy$/iu,'')+'.galaxy');

export async function composeMapOwnedSource(text,resolve,{fileName='MapScript.galaxy',maxFiles=512,maxBytes=32*1024**2}={}){
  const loaded=new Set(),files=[],sites=[];let total=0;
  async function expand(source,name){
    const ast=parseImmutableGalaxySyntax(source,name);assert.equal(ast.parseDiagnostics.length,0,'OWNED_COMPOSITION_SYNTAX');
    const edits=[];
    for(const node of ast.statements){
      if(!node.path)continue;
      const value=readStringLiteralValue(node.path.text);assert(value&&!value.needsPreset,'OWNED_COMPOSITION_INCLUDE_LITERAL');
      const logical=owner(value.value),file=await resolve(logical);if(!file)continue;
      assert.equal(owner(file.fileName),logical,'OWNED_COMPOSITION_EXACT_ARCHIVE_PATH');
      const bytes=Buffer.from(file.text);assert.equal(sha(bytes),file.sha256,'OWNED_COMPOSITION_BODY_SHA');
      let replacement='';const repeated=loaded.has(logical);
      if(!repeated){
        loaded.add(logical);files.push(file);total+=bytes.length;assert(files.length<=maxFiles&&total<=maxBytes,'OWNED_COMPOSITION_BOUND');
        replacement='\n'+await expand(file.text,file.fileName)+'\n';
      }
      sites.push({from:name,path:logical,sha256:file.sha256,includeOnceRepeated:repeated,bodyNodesDiscarded:false});
      edits.push({start:node.pos,end:node.end,text:replacement});
    }
    let result=source,boundary=Infinity;
    for(const edit of edits.toSorted((a,b)=>b.start-a.start)){assert(edit.end<=boundary,'OWNED_COMPOSITION_OVERLAP');result=result.slice(0,edit.start)+edit.text+result.slice(edit.end);boundary=edit.start;}
    assert.equal(parseImmutableGalaxySyntax(result,name+'-comparison-view').parseDiagnostics.length,0,'OWNED_COMPOSITION_OUTPUT_SYNTAX');
    return result;
  }
  const result=await expand(text,fileName);
  return {text:result,files,proof:{kind:'ACTUAL_ARCHIVE_OWNED_INCLUDE_COMPOSITION',rootSha256:sha(text),viewSha256:sha(result),sites,
    files:files.map(({text,...pin})=>pin),onlyOwnedIncludeSpansReplaced:true,allOwnedBodyTextRetained:true,includeOnce:true,externalIncludesRetained:true,
    originalSourceOrCandidateChanged:false,wholeProgramEquivalenceProved:false}};
}

export async function composeArchiveOwnedSourcePair(before,after,{sourceArchive,candidateArchive,declarations}){
  const sides=[];
  for(const [text,pin]of [[before,sourceArchive],[after,candidateArchive]]){
    const bytes=await readFile(pin.path);assert.equal(sha(bytes),pin.sha256,'OWNED_COMPOSITION_ARCHIVE_CHANGED');
    const archive=await openMpqReader(bytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
    try{
      const result=await composeMapOwnedSource(text,async logical=>{
        const entry=archive.find(logical);if(!entry)return;
        const body=Buffer.from(await archive.read(entry.id));
        return {fileName:logical,sha256:sha(body),text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body)};
      });sides.push({...result,archive:pin});
    }finally{archive.dispose();}
  }
  const materials=sides.flatMap(s=>s.files),removed=[],external=[];
  for(const declaration of declarations){
    const logical=logicalSourcePath(declaration.fileName),digest=sha(declaration.text);
    if(materials.some(f=>owner(f.fileName)===logical&&f.sha256===digest))removed.push({fileName:declaration.fileName,sha256:digest,completeBodyNowInRoot:true});else external.push(declaration);
  }
  return {before:sides[0].text,after:sides[1].text,declarations:external,
    proof:{before:{...sides[0].proof,archive:sourceArchive},after:{...sides[1].proof,archive:candidateArchive},removedDuplicateDeclarationViews:removed,
      contentOnlyOwnership:false,wholeProgramOracleStillRequired:true,sourceOrCandidateChanged:false}};
}
