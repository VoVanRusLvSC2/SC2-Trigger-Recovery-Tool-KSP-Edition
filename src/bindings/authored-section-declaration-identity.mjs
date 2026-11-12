import assert from 'node:assert/strict';import {createHash} from 'node:crypto';import {parseImmutableGalaxySyntax as parse} from "../model/immutable-galaxy-syntax.mjs";import {declaredCarrier} from "../model/galaxy-program-context.lexical-parameters.mjs";import {SyntaxKind as K} from "../sdk/array-values/modules/galaxy/language-core/index.js";
const sha=s=>createHash('sha256').update(s).digest('hex'),abi=f=>JSON.stringify({name:f.name,returnType:f.returnType,parameters:f.parameters.map(p=>({name:p.name,type:p.type}))});
// A source section owns declarations. Its public-call frontier is a projection
// of the current compilation scope and can differ in a parent and partition.
// Equal source ownership requires every projected ABI to match the actual code.
export function authoredSectionDeclarationIndex(section){
 assert.equal(sha(section.code),section.sha256,'PARTITION_SECTION_CODE_SHA');const ast=parse(section.code,'authored-partition-section');assert.equal(ast.parseDiagnostics.length,0,'PARTITION_SECTION_SYNTAX');const declarations=new Map();
 for(const n of ast.statements)if(n.kind===K.FunctionDeclaration&&n.body){assert(!declarations.has(n.name.name),'PARTITION_SECTION_DUPLICATE_BODY');declarations.set(n.name.name,{name:n.name.name,returnType:declaredCarrier(n.type),parameters:n.parameters.map(p=>({name:p.name.name,type:declaredCarrier(p.type)}))});}
 const seen=new Set();for(const f of section.functions){assert(!seen.has(f.name),'PARTITION_FRONTIER_DUPLICATE_ABI');seen.add(f.name);assert(declarations.has(f.name),'PARTITION_FRONTIER_UNDECLARED_FUNCTION');assert.equal(abi(f),abi(declarations.get(f.name)),'PARTITION_FRONTIER_ABI_NOT_SOURCE');}
 return declarations;
}
export function sameAuthoredSectionSource(parent,child){
 if(parent.library!==child.library||parent.sha256!==child.sha256||parent.code!==child.code)return false;authoredSectionDeclarationIndex(parent);authoredSectionDeclarationIndex(child);return true;
}
