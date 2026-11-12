import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.mjs';
import {logicalSourcePath} from '../model/source-ownership.mjs';
import {removeAlreadyLoadedOwnedIncludes} from '../passes/owned-include-closure.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),permissions=new WeakMap();
const unwrap=n=>n?.kind===K.ParenthesizedExpression?unwrap(n.expression):n;
function literalConstant(node){
 if(node.kind!==K.VariableDeclaration||node.modifiers?.length!==1||node.modifiers[0].kind!==K.ConstKeyword)return false;
 const value=unwrap(node.initializer);
 if(node.type?.kind===K.BoolKeyword)return [K.TrueKeyword,K.FalseKeyword].includes(value?.kind);
 if(![K.IntKeyword,K.FixedKeyword].includes(node.type?.kind))return false;
 return value?.kind===K.NumericLiteral||value?.kind===K.PrefixUnaryExpression&&[K.PlusToken,K.MinusToken].includes(value.operator?.kind)&&value.operand?.kind===K.NumericLiteral;
}

/** Prove absence of a constant symbol across the exact resolved root/include
 * program. Hash receipts alone cannot authorize removal: the returned opaque
 * capability is bound to these source bytes and to literal const declarations.
 * Any other identifier use or literal string mention is a refusal. */
export function proveUnusedLiteralConstants({root,ownedSources=[],externalSources=[],includeEvidence,names}){
 const closure=removeAlreadyLoadedOwnedIncludes({root,ownedSources,externalSources,includeEvidence,includeRoot:false});
 assert(closure.proof.completeReachableClosure,'UNUSED_CONSTANT_REQUIRES_COMPLETE_INCLUDE_CLOSURE');
 const reachable=new Map(closure.proof.resolvedFiles.map(f=>[logicalSourcePath(f.path),f.sha256]));
 const requested=new Set(names);assert([...requested].every(n=>/^[A-Za-z_]\w*$/u.test(n)),'UNUSED_CONSTANT_INVALID_NAME');
 const records=new Map([...requested].map(name=>[name,{name,declarations:[],references:[],stringMentions:[]}]));
 const seen=new Set();
 for(const file of [root,...ownedSources,...externalSources]){
  const owner=logicalSourcePath(file.originalPath??file.fileName);
  if(!reachable.has(owner)||seen.has(owner))continue;seen.add(owner);
  assert.equal(sha(file.text),reachable.get(owner),'UNUSED_CONSTANT_OWNER_SHA');
  if(file.sha256!==undefined)assert.equal(sha(file.text),file.sha256,'UNUSED_CONSTANT_INPUT_SHA');
  const ast=parseImmutableGalaxySyntax(file.text,file.fileName);assert.equal(ast.parseDiagnostics.length,0);
  const definitions=new Map();
  for(const node of ast.statements??[])if(node.name?.name&&requested.has(node.name.name)){
   const row=records.get(node.name.name),accepted=owner===logicalSourcePath(root.fileName)&&literalConstant(node);
   row.declarations.push({owner,start:node.pos,end:node.end,sha256:sha(file.text.slice(node.pos,node.end)),literalConstant:accepted});
   if(accepted)definitions.set(node.name,node.name.name);
  }
  const walk=node=>{
   if(node.kind===K.Identifier&&requested.has(node.name)&&!definitions.has(node))records.get(node.name).references.push({owner,start:node.pos,end:node.end});
   if(node.kind===K.StringLiteral)for(const name of requested)if(String(node.value??node.text).includes(name))records.get(name).stringMentions.push({owner,start:node.pos,end:node.end});
   forEachChild(node,walk);
  };
  walk(ast);
 }
 const allowed=[],refused=[];
 for(const row of records.values()){
  if(row.declarations.length===1&&row.declarations[0].literalConstant&&!row.references.length&&!row.stringMentions.length)allowed.push(row);
  else refused.push(row);
 }
 const capability=Object.freeze({}),sourceSha256=sha(root.text);permissions.set(capability,{sourceSha256,names:new Set(allowed.map(r=>r.name))});
 return{capability,proof:{kind:'CLOSED_UNUSED_LITERAL_CONSTANTS',sourceSha256,closure:closure.proof,allowed,refused,sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}

/** Auxiliary view only. Literal primitive constants have no runtime writes or
 * calls; their declaration order can be canonicalized without moving mutable
 * stores, includes or executable bodies relative to each other. */
export function canonicalLiteralGlobalConstants(source,unusedCapability){
 const ast=parseImmutableGalaxySyntax(source,'literal-global-constant-proof.galaxy');assert.equal(ast.parseDiagnostics.length,0);
 const permission=unusedCapability===undefined?undefined:permissions.get(unusedCapability);
 assert(unusedCapability===undefined||permission?.sourceSha256===sha(source),'UNTRUSTED_OR_STALE_UNUSED_CONSTANT_CAPABILITY');
 const constants=(ast.statements??[]).filter(literalConstant);
 const names=constants.map(n=>n.name.name);assert.equal(new Set(names).size,names.length,'GLOBAL_CONSTANT_AMBIGUOUS_NAME');
 const removed=constants.filter(n=>permission?.names.has(n.name.name)),retained=constants.filter(n=>!permission?.names.has(n.name.name));
 const sorted=[...retained].sort((a,b)=>a.name.name<b.name.name?-1:a.name.name>b.name.name?1:0);
 if(!constants.length)return{text:source,proof:{kind:'LITERAL_GLOBAL_CONSTANT_PERMUTATION',sourceSha256:sha(source),proofInputSha256:sha(source),removed:[],declarations:[]}};
 const remaining=(ast.statements??[]).filter(n=>!constants.includes(n)),leadingIncludes=[];
 while(remaining[0]?.kind===K.IncludeStatement)leadingIncludes.push(remaining.shift());
 const output=[...leadingIncludes,...sorted,...remaining];
 const text=output.map(n=>source.slice(n.pos,n.end)).join('\n');
 assert.equal(parseImmutableGalaxySyntax(text,'literal-global-constant-proof-output.galaxy').parseDiagnostics.length,0);
 return{text,proof:{kind:'LITERAL_GLOBAL_CONSTANT_PERMUTATION',sourceSha256:sha(source),proofInputSha256:sha(text),
  removed:removed.map(n=>({name:n.name.name,start:n.pos,end:n.end,text:source.slice(n.pos,n.end)})),
  declarations:constants.map(n=>({name:n.name.name,text:source.slice(n.pos,n.end)})),order:sorted.map(n=>n.name.name),
  mutableGlobalsIncludesAndBodiesStayOrdered:true,sourceChangedOnDisk:false,rawOracleReplaced:false,acceptanceOverride:false}};
}
