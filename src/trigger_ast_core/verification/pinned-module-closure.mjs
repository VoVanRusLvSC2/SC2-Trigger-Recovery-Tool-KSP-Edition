// Verify the complete executable import closure of a component, instead of
// accidentally tying its evidence to unrelated application entry points.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {builtinModules} from 'node:module';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';

const lexerUrl=new URL('../../sdk_type_ast_2026-10-18/tools/node_modules/es-module-lexer/dist/lexer.js',import.meta.url);
const lexerSha256='36dc42b0c379cc7d0911ffbc136844729fe3a529f89194ed672cc911d5357f46';
const builtins=new Set(builtinModules.flatMap(n=>[n,n.replace(/^node:/u,''),'node:'+n.replace(/^node:/u,'')]));
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const key=file=>pathToFileURL(fileURLToPath(new URL(file))).href;
const execFileAsync=promisify(execFile);
const issuedClosures=new WeakMap();
async function resolveBare(specifier,parent){
  const {stdout}=await execFileAsync(process.execPath,['--experimental-import-meta-resolve','--input-type=module','-e','process.stdout.write(import.meta.resolve(process.argv[1],process.argv[2]));',specifier,parent],{windowsHide:true,maxBuffer:64*1024});
  return key(stdout);
}

export async function verifyPinnedModuleClosure(session,roots,pins,{qualifiedResolutions=[]}={}) {
  await session.verify(fileURLToPath(lexerUrl),lexerSha256);
  const {init,parse}=await import(lexerUrl.href);await init;
  const known=new Map();
  for(const pin of pins){const url=pathToFileURL(pin.path).href,prior=known.get(url);assert(!prior||prior.sha256===pin.sha256,'CONFLICTING_COMPONENT_PIN:'+pin.path);known.set(url,pin);}
  const pending=roots.map(file=>file instanceof URL?key(file.href):pathToFileURL(file).href),seen=new Set(),modules=[],edges=[];
  while(pending.length){
    const url=pending.pop();if(seen.has(url))continue;seen.add(url);
    const pin=known.get(url);assert(pin,'COMPONENT_MODULE_NOT_QUALIFIED:'+url);
    try{await session.verify(pin.path,pin.sha256);}catch(error){throw new Error('COMPONENT_PIN_MISMATCH:'+pin.path,{cause:error});}
    assert(/\.(?:mjs|js)$/u.test(new URL(url).pathname),'COMPONENT_MODULE_FORMAT_NOT_SUPPORTED:'+url);
    const bytes=await readFile(pin.path);assert.equal(digest(bytes),pin.sha256,'COMPONENT_READ_CHANGED:'+pin.path);
    const text=new TextDecoder('utf-8',{fatal:true,ignoreBOM:true}).decode(bytes);
    // A legacy CommonJS/eval loader needs a separately proved resolver. Refuse
    // conservatively, including lookalikes in comments, rather than omit edges.
    assert(!/\b(?:createRequire|require|eval|Function)\s*\(/u.test(text),'UNPROVED_COMPONENT_LOADER:'+url);
    const [imports]=parse(text,url);
    modules.push({path:pin.path,sha256:pin.sha256});
    for(const item of imports){
      if(item.d===-2)continue; // import.meta contains no module edge.
      assert(typeof item.n==='string','UNRESOLVED_COMPONENT_DYNAMIC_IMPORT:'+url);
      const specifier=item.n;
      if(builtins.has(specifier)){edges.push({from:url,specifier,builtin:true});continue;}
      let target;
      if(specifier.startsWith('.')||specifier.startsWith('file:'))target=new URL(specifier,url);
      else {
        const expected=qualifiedResolutions.find(r=>r.from===url&&r.specifier===specifier)?.resolved;
        assert(expected,'UNPROVED_COMPONENT_PACKAGE_RESOLUTION:'+specifier);
        const actual=await resolveBare(specifier,url);assert.equal(actual,key(expected),'QUALIFIED_COMPONENT_PACKAGE_TARGET_CHANGED');target=new URL(actual);
      }
      assert(target.protocol==='file:'&&!target.search&&!target.hash,'UNSAFE_COMPONENT_IMPORT_URL');
      const resolved=key(target.href);edges.push({from:url,specifier,resolved,dynamic:item.d>=0,bare:!specifier.startsWith('.')&&!specifier.startsWith('file:')});pending.push(resolved);
    }
  }
  const proof={kind:'COMPLETE_SHA_PINNED_ESM_COMPONENT_CLOSURE',roots:roots.map(f=>String(f)),modules,edges,
    modulesVerified:modules.length,unresolvedImports:0,unsupportedLoadersAccepted:0,lexer:{path:fileURLToPath(lexerUrl),sha256:lexerSha256},
    completeTransitiveImportGraph:true,unrelatedApplicationModulesNotClaimed:true};
  issuedClosures.set(proof,edges.filter(e=>e.bare).map(e=>({...e})));return proof;
}

export async function recheckPinnedModuleResolutions(proof){
  const edges=issuedClosures.get(proof);assert(edges,'UNISSUED_COMPONENT_CLOSURE');
  for(const edge of edges)assert.equal(await resolveBare(edge.specifier,edge.from),edge.resolved,'COMPONENT_PACKAGE_TARGET_CHANGED_BEFORE_SEAL');
  return {bareResolutionsRechecked:edges.length,allExact:true};
}
