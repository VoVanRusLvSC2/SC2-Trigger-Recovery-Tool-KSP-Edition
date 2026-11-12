// An exact header can prove an empty custom-definition set. Attribute queries
// alone must not fabricate definitions. This never rewrites a query or a value.
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {decodeCacheHeader,field,number,array,reference,blob} from '../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2/dist/modules/game/battlenet/content-sources/cache-header.js';
import {decodeBoundAsciiString} from '../galaxy_ascii_string_v1246.mjs';
const sha=b=>createHash('sha256').update(b).digest('hex');
export function classifyExactEmptyOwnAttributes({source,ast,originalDefinitions=0,headers}) {
 const no=reason=>({applicable:false,reason});
 if(originalDefinitions)return no('ORIGINAL_DEFINITIONS_PRESENT');
 if(!headers?.length)return no('NO_EXACT_HEADER');
 if(headers.some(h=>!h.exactArchiveMatch||!Number.isSafeInteger(h.namespace)||h.namespace<1||!Array.isArray(h.attributes)))return no('INVALID_HEADER_FACTS');
 const ns=headers[0].namespace;if(ns===999)return no('STANDARD_NAMESPACE_IS_NOT_CUSTOM_MAP_OWNERSHIP');if(headers.some(h=>h.namespace!==ns))return no('HEADER_NAMESPACE_CONFLICT');
 if(headers.some(h=>h.attributes.some(a=>a.namespace!==999)))return no('CUSTOM_OR_FOREIGN_DEFINITIONS_PRESENT');
 if(ast.parseDiagnostics?.length)return no('SOURCE_SYNTAX_ERRORS');
 const queries=[],pending=[ast],names=new Set(['GameAttributeGameValue','GameAttributePlayerValue']);
 while(pending.length){const n=pending.pop();if(!n||typeof n!=='object')continue;
  if([141,142,143].includes(n.kind)&&names.has(n.name?.name))return no('ATTRIBUTE_NATIVE_SHADOWED');
  if(n.kind===121&&n.expression?.kind===113&&names.has(n.expression.name)) {
   const key=decodeBoundAsciiString(n.arguments?.[0],source);if(key===undefined)return no('DYNAMIC_OR_UNSUPPORTED_QUERY_KEY');
   const own=/^\[bnet:local\/0\.0\/(\d+)\](\d+)$/u.exec(key);
   // Standard queries stay bound to the installed standard dependency. No
   // assumption is made about arbitrary foreign namespaces or numeric aliases.
   const standard=/^\[bnet:(?:Liberty|Swarm|Void) \(Mod\)\/0\.0\/999,file:Mods[\\/](?:Liberty|Swarm|Void)\.SC2Mod\]\d+$/u.test(key);
   if(!standard&&(!own||Number(own[1])!==ns))return no('UNPROVEN_QUERY_NAMESPACE');
   queries.push({function:n.expression.name,key,kind:standard?'unchanged-standard-query':'unchanged-own-query-with-no-published-custom-definition'});
  }
  for(const[k,v]of Object.entries(n))if(!['parent','symbol','locals','flowNode','syntaxTokens'].includes(k)){if(Array.isArray(v))pending.push(...v.filter(x=>x&&typeof x==='object'));else if(v&&typeof v==='object')pending.push(v);}
 }
 return {applicable:true,namespace:ns,definitionCount:0,queries,queryBytesUnchanged:true,newDefinitionsCreated:false,newDefaultsCreated:false,rule:'EXACT_SOURCE_HEADER_HAS_NO_CUSTOM_DEFINITIONS_AND_ALL_QUERY_NAMESPACES_ACCOUNTED'};
}
export async function readExactEmptyOwnAttributeEvidence({indexPath,originalSha256,source,ast,originalDefinitions=0}) {
 const bytes=await readFile(indexPath),index=JSON.parse(bytes),matches=index.exact.filter(h=>h.sourceArchiveSha256===originalSha256),headers=[],pins=[];
 for(const h of matches){assert(h.exactArchiveMatch&&h.archive.sha256===originalSha256);const raw=await readFile(h.header);assert.equal(sha(raw),h.headerSha256,'Exact header changed');const head=field(decodeCacheHeader(raw),0);assert.equal(reference(blob(field(head,2))).sha256,originalSha256,'Header archive differs');const namespace=number(field(head,3));assert.equal(namespace,h.namespace);const attributes=array(field(head,5)).map(a=>({namespace:number(field(field(a,0),0)),id:number(field(field(a,0),1))}));headers.push({exactArchiveMatch:true,namespace,attributes});pins.push({header:h.header,headerSha256:h.headerSha256});}
 return {...classifyExactEmptyOwnAttributes({source,ast,originalDefinitions,headers}),sourceArchiveSha256:originalSha256,indexPath,indexSha256:sha(bytes),headers:pins};
}
