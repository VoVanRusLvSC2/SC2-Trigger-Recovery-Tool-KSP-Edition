import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const loops=new Set([K.WhileStatement,K.ForStatement,K.DoStatement]);
const types=new Set([K.IntKeyword,K.UnitgroupKeyword,K.PlayergroupKeyword]);
function walk(n,f){f(n);forEachChild(n,c=>walk(c,f));}
const inside=(n,a,b)=>n.pos>=a&&n.end<=b;
const assignment=s=>{const e=un(s.kind===K.ExpressionStatement?s.expression:undefined);
  return e?.kind===K.BinaryExpression&&e.operatorToken.kind===K.EqualsToken&&un(e.left)?.kind===K.Identifier?e:undefined;};
const forInitializer=loop=>{
  const e=un(loop.kind===K.ForStatement?loop.initializer:undefined);
  return e?.kind===K.BinaryExpression&&e.operatorToken.kind===K.EqualsToken&&un(e.left)?.kind===K.Identifier?e:undefined;
};

// Hygienic renaming of a PRIVATE CELL in a closed reset+loop region. This does
// not copy/clear/create a group object or change any native call. Every value
// reference must belong to one nonoverlapping region and follow that region's
// full reset. By-reference/unknown calls and old-value reads refuse the cell.
// Region discovery uses syntax and bound types, never map/API names or hashes.
export function canonicalClosedLoopCaptureCells(source,context={}){
  const proof={kind:'CLOSED_RESET_AND_LOOP_PRIVATE_CAPTURE_CELLS',sourceSha256:sha(source),records:[],refused:[],
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false};
  const bound=openVerifiedSourceBindingProgram(source,context);
  if(bound.reason)return {text:source,proof:{...proof,reason:bound.reason,viewSha256:sha(source)}};
  const {program,ast,referenceFacts}=bound;
  try{
    const allNames=new Set(),renamed=new Map(),replaced=new Map(),edits=[];
    walk(ast,n=>{if(n.kind===K.Identifier)allNames.add(n.name);});
    let prefix='proofLoopCell';while([...allNames].some(n=>n.startsWith(prefix)))prefix+='X';
    for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
      const declarations=[];walk(fn.body,n=>{if(n.kind===K.VariableDeclaration)declarations.push(n);});
      if(new Set([...fn.parameters,...declarations].map(n=>n.name.name)).size!==fn.parameters.length+declarations.length)continue;
      const eligible=new Map(),byName=new Map(),prefixDeclarations=[];
      for(const s of fn.body.statements){if(s.kind!==K.VariableDeclaration)break;prefixDeclarations.push(s);}
      for(const local of prefixDeclarations)if(types.has(local.type.kind)&&!local.initializer&&!local.isReference&&!local.modifiers?.length){
        const binding=program.getBinding(local.name);if(binding.status==='BOUND'){
          const row={local,symbolId:binding.symbolId,refs:[],regions:[]};eligible.set(binding.symbolId,row);byName.set(local.name.name,row);
        }
      }
      const regions=[];
      walk(fn.body,block=>{
        if(block.kind!==K.Block)return;
        for(let i=0;i<block.statements.length;i++){
          const loop=block.statements[i];if(!loops.has(loop.kind))continue;
          const resets=[],seen=new Set();
          for(let j=i-1;j>=0;j--){
            const e=assignment(block.statements[j]);if(!e)break;
            const id=program.getBinding(un(e.left)).symbolId;
            if(!eligible.has(id)||seen.has(id))break;seen.add(id);resets.unshift({id,expression:e});
          }
          // The loop header is evaluated on every entry and can own the
          // dominating reset of a separate private counter. Keep its RHS,
          // condition, increment and entire loop untouched in the proof view.
          const header=forInitializer(loop),headerBinding=header&&program.getBinding(un(header.left));
          if(headerBinding?.status==='BOUND'&&eligible.has(headerBinding.symbolId)){
            const earlier=resets.findIndex(r=>r.id===headerBinding.symbolId);if(earlier>=0)resets.splice(earlier,1);
            resets.push({id:headerBinding.symbolId,expression:header});
          }
          if(!resets.length)continue;
          const region={start:Math.min(loop.pos,...resets.map(r=>r.expression.pos)),end:loop.end,loop,reset:resets};regions.push(region);
          for(const reset of resets)eligible.get(reset.id).regions.push({...region,ownReset:reset.expression});
        }
      });
      if(!regions.length)continue;
      walk(fn.body,n=>{
        if(n.kind!==K.Identifier||n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)return;
        const binding=program.getBinding(n),spelling=byName.get(n.name);
        if(spelling&&n!==spelling.local.name&&binding.status!=='BOUND')spelling.failure='UNRESOLVED_SAME_SPELLING_REFERENCE';
        const row=eligible.get(binding.symbolId);if(!row||n===row.local.name)return;
        row.refs.push(n);
      });
      const selected=[];
      for(const row of eligible.values()){
        if(!row.regions.length||!row.refs.length)continue;
        let failure=row.failure;const initialStores=[],uses=new Map(row.regions.map(r=>[r,[]]));
        for(const ref of row.refs){
          const owners=row.regions.filter(r=>inside(ref,r.start,r.end));
          if(owners.length!==1){
            const statement=ref.parent?.parent,store=statement&&assignment(statement),earliest=Math.min(...row.regions.map(r=>r.start));
            let selfRead=false;if(store)walk(store.right,n=>{if(n.kind===K.Identifier&&program.getBinding(n).symbolId===row.symbolId)selfRead=true;});
            if(owners.length===0&&store&&un(store.left)===ref&&statement.parent===fn.body&&statement.pos<earliest&&!selfRead){initialStores.push({start:statement.pos,end:statement.end});continue;}
            failure='REFERENCE_OUTSIDE_OR_OVERLAPPING_CAPTURE_REGIONS';break;
          }
          const owner=owners[0];
          if(ref.pos<owner.ownReset.pos||inside(ref,owner.ownReset.right.pos,owner.ownReset.right.end)){
            failure='CAPTURE_READ_BEFORE_DOMINATING_RESET';break;
          }
          const checked=referenceFacts(ref,fn.body);if(checked.reason){failure=checked.reason;break;}
          uses.get(owner).push({ref,facts:checked.facts});
        }
        if(failure){proof.refused.push({function:fn.name.name,name:row.local.name.name,reason:failure});continue;}
        if(row.regions.length===1&&!initialStores.length)continue; // One existing cell needs only the later bound lexical alpha view.
        row.initialStores=initialStores;for(const [region,refs]of uses)if(refs.length)selected.push({row,region,refs});
      }
      selected.sort((a,b)=>a.region.ownReset.pos-b.region.ownReset.pos);
      for(const [i,capture]of selected.entries()){
        const name=prefix+i;capture.name=name;
        for(const {ref}of capture.refs){renamed.set(ref,name);edits.push({start:ref.pos,end:ref.pos+ref.name.length,before:ref.name,replacement:name});}
        proof.records.push({function:fn.name.name,sourceSymbolId:capture.row.symbolId,from:capture.row.local.name.name,to:name,
          type:printer.printNode(capture.row.local.type),start:capture.region.start,end:capture.region.end,
          reset:capture.region.ownReset.pos,references:capture.refs.map(({ref,facts})=>({start:ref.pos,end:ref.pos+ref.name.length,byValueCalls:facts})),
          allValueReferencesExhausted:true,preservedDominatedEntryStores:capture.row.initialStores,resetDominatesAllReads:true,groupObjectIdentityAndMutationsPreserved:true});
      }
      for(const row of new Set(selected.map(c=>c.row))){
        const names=selected.filter(c=>c.row===row).map(c=>c.name),type=printer.printNode(row.local.type);
        replaced.set(row.local,[...(row.initialStores.length?[row.local]:[]),...names.map(name=>({...row.local,name:{...row.local.name,name}}))]);
        edits.push({start:row.local.pos,end:row.local.end,before:source.slice(row.local.pos,row.local.end),replacement:[...(row.initialStores.length?[source.slice(row.local.pos,row.local.end)]:[]),...names.map(n=>type+' '+n+';')].join('\n')});
      }
    }
    const applied=applyReversibleSourceEdits(source,edits),output=parse(applied.text,'closed-loop-capture-view');assert.equal(output.parseDiagnostics.length,0);
    function project(n){
      if(renamed.has(n))return {...n,name:renamed.get(n)};
      if(!n||typeof n!=='object')return n;
      if(Array.isArray(n))return n.flatMap(x=>replaced.has(x)?replaced.get(x).map(project):[project(x)]);
      return Object.fromEntries(Object.entries(n).filter(([k])=>k!=='parent').map(([k,v])=>[k,project(v)]));
    }
    assert.deepEqual(shape(output),shape(project(ast)),'CLOSED_CAPTURE_CHANGED_UNPLANNED_STRUCTURE');
    return {text:applied.text,proof:{...proof,viewSha256:sha(applied.text),closure:bound.closure,
      edits:applied.proof.edits,byteInverseVerified:applied.proof.byteInverseVerified,exactPlannedStructureVerified:true,
      allCallsStoresAndControlFlowRetained:true,newRuntimeOperations:0,newNative:0,newCustomScript:0,persistentCache:false}};
  }finally{bound.dispose();}
}
