import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {parseImmutableGalaxySyntax} from '../model/immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');

/** The finite oracle indexes functions by name. Two implementation bodies may
 * never be treated as a single function, even if their text is identical.
 * Compatible bodyless prototypes remain declarations, not extra bodies. */
export function verifyUniqueFunctionBodies(text){
 assert.equal(typeof text,'string');const ast=parseImmutableGalaxySyntax(text,'CompleteProgram.galaxy');
 const groups=new Map();let bodies=0;
 for(const node of ast.statements){
  if(node.kind!==K.FunctionDeclaration||!node.body)continue;bodies++;
  const rows=groups.get(node.name.name)??[];
  rows.push({start:node.pos,end:node.end,sha256:sha(text.slice(node.pos,node.end))});groups.set(node.name.name,rows);
 }
 const collisions=[...groups].filter(([,rows])=>rows.length>1).map(([name,declarations])=>({name,declarations}));
 return {kind:'COMPLETE_PROGRAM_UNIQUE_FUNCTION_BODY_PRECONDITION',valid:ast.parseDiagnostics.length===0&&collisions.length===0,
  sourceSha256:sha(text),syntaxDiagnostics:ast.parseDiagnostics.length,functionBodies:bodies,uniqueImplementationNames:groups.size,collisions,
  prototypesCountAsBodies:false,overloadEquivalenceAssumed:false,sourceChanged:false,wholeMapAccepted:false};
}
