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
const issuedCompositions=new WeakMap();

export async function composeMapOwnedSource(text,resolve,{fileName='MapScript.galaxy',maxFiles=512,maxBytes=32*1024**2}={}){
  const loaded=new Set(),files=[],sites=[],externalIncludes=[];let total=0;
  async function expand(source,name){
    const ast=parseImmutableGalaxySyntax(source,name);assert.equal(ast.parseDiagnostics.length,0,'OWNED_COMPOSITION_SYNTAX');
    const edits=[];
    for(const node of ast.statements){
      if(!node.path)continue;
      const value=readStringLiteralValue(node.path.text);assert(value&&!value.needsPreset,'OWNED_COMPOSITION_INCLUDE_LITERAL');
      const logical=owner(value.value),file=await resolve(logical);
      if(!file){externalIncludes.push({from:name,include:value.value,sourceSha256:sha(source)});continue;}
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
  const composition={text:result,files,proof:{kind:'ACTUAL_ARCHIVE_OWNED_INCLUDE_COMPOSITION',rootSha256:sha(text),viewSha256:sha(result),sites,
    files:files.map(({text,...pin})=>pin),onlyOwnedIncludeSpansReplaced:true,allOwnedBodyTextRetained:true,includeOnce:true,externalIncludesRetained:true,
    originalSourceOrCandidateChanged:false,wholeProgramEquivalenceProved:false}};
  issuedCompositions.set(composition,{externalIncludes,owned:new Map(files.map(f=>[owner(f.fileName),f.sha256]))});return composition;
}

// A composed include still belongs to its original source and layer. Move an
// edge into the virtual root only from an issued full-body composition, with
// the same explicit source resolution and SHA-bound target. Ambiguity fails.
export function deriveComposedIncludeEvidence(compositions,includeEvidence,declarations,{rootFileName='MapScript.galaxy'}={}){
  assert(Array.isArray(includeEvidence),'COMPOSED_INCLUDE_EVIDENCE_REQUIRED');
  const evidence=includeEvidence.map(e=>({...e})),records=[];
  for(const composition of compositions){
    const context=issuedCompositions.get(composition);assert(context,'UNISSUED_SOURCE_COMPOSITION');
    for(const origin of context.externalIncludes){
      const from=logicalSourcePath(origin.from);if(!context.owned.has(from))continue;
      assert.equal(context.owned.get(from),origin.sourceSha256,'COMPOSED_INCLUDE_SOURCE_CHANGED');
      const matches=includeEvidence.filter(e=>logicalSourcePath(e.from)===from&&owner(e.include)===owner(origin.include));
      assert(matches.length,'COMPOSED_INCLUDE_ORIGINAL_RESOLUTION_MISSING:'+from+':'+origin.include);
      const binding=matches[0];assert(matches.every(e=>logicalSourcePath(e.path)===logicalSourcePath(binding.path)&&e.layerId===binding.layerId),'COMPOSED_INCLUDE_ORIGINAL_RESOLUTION_AMBIGUOUS');
      const targets=declarations.filter(f=>logicalSourcePath(f.fileName)===logicalSourcePath(binding.path));
      assert(targets.length&&targets.every(f=>sha(f.text)===sha(targets[0].text)),'COMPOSED_INCLUDE_TARGET_CONTENT_NOT_BOUND');
      for(const target of targets)if(target.sha256!==undefined)assert.equal(sha(target.text),target.sha256,'COMPOSED_INCLUDE_TARGET_SHA_CHANGED');
      const existing=evidence.filter(e=>logicalSourcePath(e.from)===logicalSourcePath(rootFileName)&&owner(e.include)===owner(origin.include));
      assert(existing.every(e=>logicalSourcePath(e.path)===logicalSourcePath(binding.path)&&e.layerId===binding.layerId),'COMPOSED_INCLUDE_VIRTUAL_ROOT_RESOLUTION_CONFLICT');
      if(!existing.length)evidence.push({...binding,from:rootFileName});
      records.push({...origin,virtualFrom:rootFileName,path:binding.path,layerId:binding.layerId,targetSha256:sha(targets[0].text),originalBindingRetained:true});
    }
  }
  return {includeEvidence:evidence,proof:{kind:'ARCHIVE_COMPOSITION_INCLUDE_ORIGIN_TRANSPORT',records,allEdgesFromExplicitOriginalBindings:true,noResolutionByBasenameOrUniqueToken:true,sourceOrCandidateChanged:false}};
}

export async function composeArchiveOwnedSourcePair(before,after,{sourceArchive,candidateArchive,declarations,includeEvidence}){
  const sides=[];
  for(const [text,pin]of [[before,sourceArchive],[after,candidateArchive]]){
    const bytes=await readFile(pin.path);assert.equal(sha(bytes),pin.sha256,'OWNED_COMPOSITION_ARCHIVE_CHANGED');
    const archive=await openMpqReader(bytes,{maxArchiveBytes:1024**3,maxEntries:100000,maxEntryBytes:256*1024**2});
    try{
      const result=await composeMapOwnedSource(text,async logical=>{
        const entry=archive.find(logical);if(!entry)return;
        const body=Buffer.from(await archive.read(entry.id));
        return {fileName:logical,sha256:sha(body),text:new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(body)};
      });result.archive=pin;sides.push(result);
    }finally{archive.dispose();}
  }
  const materials=sides.flatMap(s=>s.files),removed=[],external=[];
  for(const declaration of declarations){
    const logical=logicalSourcePath(declaration.fileName),digest=sha(declaration.text);
    if(materials.some(f=>owner(f.fileName)===logical&&f.sha256===digest))removed.push({fileName:declaration.fileName,sha256:digest,completeBodyNowInRoot:true});else external.push(declaration);
  }
  const transported=deriveComposedIncludeEvidence(sides,includeEvidence,declarations);
  return {before:sides[0].text,after:sides[1].text,declarations:external,includeEvidence:transported.includeEvidence,
    proof:{before:{...sides[0].proof,archive:sourceArchive},after:{...sides[1].proof,archive:candidateArchive},removedDuplicateDeclarationViews:removed,
      includeOriginTransport:transported.proof,contentOnlyOwnership:false,wholeProgramOracleStillRequired:true,sourceOrCandidateChanged:false}};
}
