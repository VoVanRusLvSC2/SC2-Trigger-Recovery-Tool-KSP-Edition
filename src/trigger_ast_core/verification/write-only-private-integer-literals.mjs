import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
function walk(n,f){f(n);forEachChild(n,c=>walk(c,f));}

// Only a private int that is NEVER READ and never passed/returned/addressed.
// Its writes must be standalone assignments of closed int32 literals in blocks.
// Calls, computed RHS, loop heads, array/member/global writes and controls stay.
export function canonicalWriteOnlyPrivateIntegerLiterals(source,context={}){
  const proof={kind:'WRITE_ONLY_PRIVATE_INTEGER_LITERAL_STORES',sourceSha256:sha(source),records:[],refused:[],
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
  const bound=openVerifiedSourceBindingProgram(source,context);
  if(bound.reason)return {text:source,proof:{...proof,reason:bound.reason,viewSha256:sha(source)}};
  const {program,ast}=bound,removed=new Set();
  try{
    for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
      const declarations=[];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)declarations.push(n);});
      if(new Set([...fn.parameters,...declarations].map(n=>n.name.name)).size!==fn.parameters.length+declarations.length)continue;
      const locals=new Map(),byName=new Map();
      for(const n of fn.body.statements){if(n.kind!==K.VariableDeclaration)break;
        if(n.type.kind!==K.IntKeyword||n.initializer||n.isReference||n.modifiers?.length)continue;
        const binding=program.getBinding(n.name);if(binding.status!=='BOUND')continue;
        const row={declaration:n,symbolId:binding.symbolId,refs:[]};locals.set(binding.symbolId,row);byName.set(n.name.name,row);
      }
      walk(fn.body,n=>{
        if(n.kind!==K.Identifier||n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)return;
        const b=program.getBinding(n),spelling=byName.get(n.name);
        if(spelling&&n!==spelling.declaration.name&&b.status!=='BOUND')spelling.failure='UNRESOLVED_SAME_SPELLING_REFERENCE';
        const row=locals.get(b.symbolId);if(row&&n!==row.declaration.name)row.refs.push(n);
      });
      for(const row of locals.values()){
        if(!row.refs.length)continue;let failure=row.failure;const stores=[];
        for(const ref of row.refs){
          let lhs=ref;while(lhs.parent?.kind===K.ParenthesizedExpression)lhs=lhs.parent;
          const e=lhs.parent;let statement=e;while(statement?.parent?.kind===K.ParenthesizedExpression)statement=statement.parent;statement=statement?.parent;
          const value=e?.kind===K.BinaryExpression&&e.operatorToken.kind===K.EqualsToken&&un(e.left)===ref?readCanonicalInt32Literal(un(e.right)):undefined;
          if(value===undefined||statement?.kind!==K.ExpressionStatement||statement.parent?.kind!==K.Block){failure='READ_COMPUTED_WRITE_OR_NONSTANDALONE_STORE';break;}
          stores.push({node:statement,value:String(value)});
        }
        if(failure){proof.refused.push({function:fn.name.name,name:row.declaration.name.name,reason:failure});continue;}
        removed.add(row.declaration);for(const s of stores)removed.add(s.node);
        proof.records.push({function:fn.name.name,symbolId:row.symbolId,name:row.declaration.name.name,
          declaration:{start:row.declaration.pos,end:row.declaration.end},stores:stores.map(s=>({start:s.node.pos,end:s.node.end,value:s.value})),
          noValueReadOrReferenceExposure:true,allRhsClosedInt32Literals:true});
      }
    }
    const applied=applyReversibleSourceEdits(source,[...removed].map(n=>({start:n.pos,end:n.end,before:source.slice(n.pos,n.end),replacement:''})));
    const output=parse(applied.text,'write-only-int-view');assert.equal(output.parseDiagnostics.length,0);
    function project(n){
      if(!n||typeof n!=='object')return n;if(Array.isArray(n))return n.filter(x=>!removed.has(x)).map(project);
      return Object.fromEntries(Object.entries(n).filter(([k])=>k!=='parent').map(([k,v])=>[k,project(v)]));
    }
    assert.deepEqual(shape(output),shape(project(ast)),'WRITE_ONLY_INT_CHANGED_UNPLANNED_STRUCTURE');
    return {text:applied.text,proof:{...proof,viewSha256:sha(applied.text),closure:bound.closure,
      edits:applied.proof.edits,byteInverseVerified:applied.proof.byteInverseVerified,exactPlannedStructureVerified:true,
      noCallGlobalArrayMemberOrControlRemoved:true,newNative:0,newCustomScript:0,newRuntimeOperations:0,persistentCache:false}};
  }finally{bound.dispose();}
}
