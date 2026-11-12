import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=b=>createHash('sha256').update(b).digest('hex');
const fold=s=>s.replaceAll('\\','/').toLowerCase();
const safe=s=>typeof s==='string'&&!s.includes('%')&&!s.includes('\0')&&!fold(s).startsWith('/')&&!s.includes(':')&&!fold(s).split('/').some(p=>!p||p==='.'||p==='..');
const declaration=s=>/^base\.sc2data\/(?:triggerlibs\/.*\.(?:galaxy|sc2lib|triggerlib)|triggerlibs\/librarylist\.xml|lib[a-z0-9_]+_h\.galaxy)$/iu.test(s);
const localization=s=>/^[a-z]{4}\.sc2data\/localizeddata\/(?:triggerstrings|gamestrings)\.txt$/iu.test(s);

/** Read-only, declaration-only view. It supplements a namespace that the actual
 * Editor has admitted for this installed stock package. It does not synthesize
 * runtime dependencies, change their order, or expose GameData/assets/Objects.
 * Existing mounted resolutions always win; ambiguous fallback files refuse.
 */
export function createQualifiedDeclarationContext({context,providers,admission}) {
 assert.equal(admission.kind,'VERIFIED_NATIVE_NAMESPACE_ADMISSION');
 assert(admission.nativeCompilationVerified&&admission.nativeSourceVerified,'DECLARATION_ADMISSION_UNVERIFIED');
 const required=admission.requiredPackages.map(fold);
 assert(required.every(p=>context.layers.some(l=>l.sourceId==='local:casc'&&fold(l.sourcePath)===p)),'DECLARATION_ADMISSION_PACKAGE_CONTEXT');
 const ids=new Map(),records=[],observed=new Set();
 const layers=providers.map((provider,i)=>{
  assert(safe(provider.packagePath),'DECLARATION_PROVIDER_PATH');
  const id='qualified-declaration:'+i;assert(!context.layers.some(l=>l.id===id),'DECLARATION_PROVIDER_ID_COLLISION');
  const files=new Map();for(const file of provider.files) {
   assert(safe(file),'DECLARATION_FILE_PATH');if(declaration(file)) {assert(!files.has(fold(file)),'DECLARATION_DUPLICATE_FILE');files.set(fold(file),file);}
  }
  assert(files.size,'DECLARATION_PROVIDER_EMPTY');ids.set(id,{provider,files});
  return Object.freeze({id,sourceId:'local:qualified-declarations',sourcePath:provider.packagePath,role:'declaration-only',provenance:'native-namespace-admission'});
 });
 const exists=(id,file)=>{const p=ids.get(id);return p&&p.files.get(fold(file));};
 const read=async(id,file,maxBytes)=>{
  const p=ids.get(id);if(!p)return context.read(id,file,maxBytes);
  assert(safe(file)&&(declaration(file)||localization(file)),'DECLARATION_NON_CODE_READ');
  const path=localization(file)?file:exists(id,file);assert(path,'DECLARATION_FILE_ABSENT');
  const limit=p.provider.maxReadBytes===undefined?maxBytes:Math.min(maxBytes,p.provider.maxReadBytes);
  const data=await p.provider.read(path,limit);assert(data.byteLength<=maxBytes,'DECLARATION_READ_LIMIT');
  const key=JSON.stringify([id,fold(path),sha(data)]);if(!observed.has(key)){observed.add(key);records.push({layerId:id,packagePath:p.provider.packagePath,path,bytes:data.byteLength,sha256:sha(data),role:'declaration-only'});}
  return data;
 };
 const locate=async(file,options)=>{
  assert(safe(file),'DECLARATION_LOOKUP_PATH');const original=await context.locate(file,options);if(original)return original;
  if(!declaration(file))return undefined;
  const matches=layers.flatMap(l=>{const path=exists(l.id,file);return path?[{layerId:l.id,path}]:[];});
  assert(matches.length<=1,'DECLARATION_AMBIGUOUS_FALLBACK');return matches[0];
 };
 const files=async(id,options={})=>{
  const p=ids.get(id);if(!p)return context.files(id,options);
  const names=[...p.files.values()].filter(f=>fold(f).startsWith(fold(options.prefix??''))).sort();
  const at=options.cursor===undefined?0:Number(options.cursor),limit=options.limit??1000;
  assert(Number.isSafeInteger(at)&&at>=0&&Number.isSafeInteger(limit)&&limit>0,'DECLARATION_PAGE_RANGE');
  return {items:names.slice(at,at+limit),...(at+limit<names.length?{nextCursor:String(at+limit)}:{})};
 };
 // Real contexts are frozen. An empty facade avoids violating Proxy invariants
 // for their non-configurable properties and retains original method receivers.
 const view=new Proxy(Object.create(null),{get(_target,key){if(key==='layers')return [...context.layers,...layers];if(key==='read')return read;if(key==='locate')return locate;if(key==='files')return files;const result=Reflect.get(context,key,context);return typeof result==='function'?result.bind(context):result;}});
 return Object.freeze({context:view,evidence:()=>({kind:'QUALIFIED_DECLARATION_CONTEXT',admission,providers:layers,reads:[...records],
  originalRuntimeLayersUnchanged:true,runtimeDependencyGraphProved:false,gameDataOrAssetsExposed:false,emissionAuthorized:false,persistentCache:false})});
}
