import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {projectedExpressionGroupingShape} from './projected-expression-grouping-shape.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
function walk(n,f){f(n);forEachChild(n,c=>walk(c,f));}

// The frozen oracle pairs common local SPELLINGS before positional locals.
// Compiler captures can reuse a spelling for a different local. Alpha-convert
// actual bound private cells first; never match globals or members by spelling.
export function canonicalBoundPrivateLocalNames(source,context={}){
  const proof={kind:'QUALIFIED_PRIVATE_LOCAL_ALPHA_RENAMING',sourceSha256:sha(source),records:[],refused:[],
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
  const bound=openVerifiedSourceBindingProgram(source,context);
  if(bound.reason)return {text:source,proof:{...proof,reason:bound.reason,viewSha256:sha(source)}};
  const {program,ast}=bound;
  try{
    const names=new Set(),renamed=new Map();
    for(const doc of program.documents.values())walk(doc,n=>{if(n.kind===K.Identifier)names.add(n.name);});
    let prefix='proofPrivateLocal';while([...names].some(n=>n.startsWith(prefix)))prefix+='X';
    for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
      const all=[];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)all.push(n);});
      if(new Set([...fn.parameters,...all].map(n=>n.name.name)).size!==fn.parameters.length+all.length){
        proof.refused.push({function:fn.name.name,reason:'AMBIGUOUS_LOCAL_SCOPE'});continue;
      }
      const locals=new Map(),byName=new Map();let ordinal=0,failure;
      for(const n of fn.body.statements){if(n.kind!==K.VariableDeclaration)break;
        const b=program.getBinding(n.name);if(b.status!=='BOUND'){failure='UNBOUND_LOCAL_DECLARATION';break;}
        const row={node:n,symbolId:b.symbolId,to:prefix+String(ordinal++).padStart(5,'0'),refs:[n.name]};locals.set(b.symbolId,row);byName.set(n.name.name,row);
      }
      if(failure){proof.refused.push({function:fn.name.name,reason:failure});continue;}
      walk(fn.body,n=>{
        if(n.kind!==K.Identifier||n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)return;
        const b=program.getBinding(n),spelling=byName.get(n.name);
        if(spelling&&n!==spelling.node.name&&b.status!=='BOUND')failure='UNRESOLVED_SAME_SPELLING_REFERENCE';
        const row=locals.get(b.symbolId);if(!row||n===row.node.name)return;
        if(n.parent?.kind===K.TypeReference){failure='LOCAL_IDENTITY_USED_AS_NOMINAL_TYPE';return;}
        row.refs.push(n);
      });
      if(failure){proof.refused.push({function:fn.name.name,reason:failure});continue;}
      for(const row of locals.values()){
        for(const ref of row.refs)renamed.set(ref,row.to);
        proof.records.push({function:fn.name.name,symbolId:row.symbolId,from:row.node.name.name,to:row.to,
          declaration:{start:row.node.pos,end:row.node.end},references:row.refs.map(n=>({start:n.pos,end:n.pos+n.name.length})),
          globalAndMemberNamesUnchanged:true,onlyOneBoundLocalIdentityRenamed:true});
      }
    }
    const applied=applyReversibleSourceEdits(source,[...renamed].map(([n,name])=>({start:n.pos,end:n.pos+n.name.length,before:n.name,replacement:name})));
    const output=parse(applied.text,'bound-private-local-alpha-view');assert.equal(output.parseDiagnostics.length,0);
    const expected=projectedExpressionGroupingShape(ast,n=>renamed.has(n)?{...n,name:renamed.get(n)}:n);
    assert.deepEqual(shape(output),expected,'PRIVATE_ALPHA_CHANGED_UNPLANNED_STRUCTURE');
    return {text:applied.text,proof:{...proof,viewSha256:sha(applied.text),closure:bound.closure,prefix,
      edits:applied.proof.edits,byteInverseVerified:applied.proof.byteInverseVerified,exactPlannedStructureVerified:true,
      everyTypeStatementLiteralAndCallRetained:true,newNative:0,newCustomScript:0,newRuntimeOperations:0,persistentCache:false}};
  }finally{bound.dispose();}
}
