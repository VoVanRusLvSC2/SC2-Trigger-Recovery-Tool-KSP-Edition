import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {openVerifiedSourceBindingProgram} from '../model/verified-source-binding-program.lexical-parameters.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.collections.mjs';
import {proveClosedProtocolNameAbsence} from '../analysis/protocol-name-flow.linear-terminals.mjs';
import {expressionGroupingShape as shape} from './expression-grouping-proof.typedef-terminators.mjs';
import {projectedExpressionGroupingShape} from './projected-expression-grouping-shape.mjs';
import {SyntaxKind as K,Printer,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex'),printer=new Printer();
const walk=(n,f)=>{f(n);forEachChild(n,c=>walk(c,f));};
const abi=n=>JSON.stringify({type:printer.printNode(n.type),parameters:n.parameters.map(p=>({type:printer.printNode(p.type),reference:!!p.isReference})),modifiers:(n.modifiers??[]).filter(m=>m.kind!==K.StaticKeyword).map(m=>m.kind)});

// Closed-program comparison only. A private function's visibility is neutral
// only with one exact body/ABI, no external declaration or name observer and
// exclusively bound direct calls. A bodiless prototype disappears only when
// it has no source reference and no possible function-name dispatch.
export function canonicalClosedFunctionDeclarations(source,context={}){
  const proof={kind:'CLOSED_FUNCTION_LINKAGE_AND_UNUSED_PROTOTYPES',sourceSha256:sha(source),records:[],refused:[],
    sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false,
    boundary:'Complete supplied Galaxy and declared core function-name consumers; no arbitrary external engine entry or debugger linkage observations.'};
  const bound=openVerifiedSourceBindingProgram(source,context);
  if(bound.reason)return {text:source,proof:{...proof,reason:bound.reason,viewSha256:sha(source)}};
  const {program,ast}=bound,groups=new Map(),selected=new Map(),removed=new Set(),stripped=new Set(),edits=[];
  try{
    const documents=new Map([...program.documents].map(([fileName,doc])=>[fileName,fileName===ast.fileName?ast:doc]));
    for(const [fileName,doc]of documents)for(const node of doc.statements)if(node.name?.name){
      const rows=groups.get(node.name.name)??[];rows.push({fileName,node});groups.set(node.name.name,rows);
    }
    const entries=new Set(context.entryPoints??['InitMap']);
    for(const [name,rows]of groups){
      if(entries.has(name)||rows.some(r=>r.fileName!==ast.fileName||r.node.kind!==K.FunctionDeclaration))continue;
      const declarations=rows.map(r=>r.node),bodies=declarations.filter(n=>n.body);
      if(declarations.some(n=>n.modifiers?.some(m=>m.kind!==K.StaticKeyword))||new Set(declarations.map(abi)).size!==1||bodies.length>1)continue;
      const staticRows=declarations.filter(n=>n.modifiers?.some(m=>m.kind===K.StaticKeyword));
      if(bodies.length===1&&!staticRows.length)continue;
      if(bodies.length&&staticRows.length!==declarations.length){proof.refused.push({function:name,reason:'MIXED_SOURCE_LINKAGE_DECLARATIONS'});continue;}
      const refs=[],names=new Set(declarations.map(n=>n.name));let failure;
      for(const doc of documents.values())walk(doc,n=>{
        if(n.kind!==K.Identifier||n.name!==name||names.has(n))return;
        if(n.parent?.kind===K.PropertyAccessExpression&&n.parent.name===n)return;
        if(!bodies.length){failure='BODYLESS_PROTOTYPE_HAS_SOURCE_REFERENCE';return;}
        const target=program.declarationAt(n),call=n.parent;
        const location=target&&program.location(target);
        const own=location?.sourceFile===ast.fileName&&declarations.some(d=>d.kind===target.kind&&d.pos===target.pos&&d.end===target.end);
        if(program.getBinding(n).status!=='BOUND'||!own||call?.kind!==K.CallExpression||call.expression!==n||call.arguments.length!==bodies[0].parameters.length){failure='FUNCTION_REFERENCE_OR_ABI_NOT_CLOSED';return;}
        refs.push({start:n.pos,end:n.end});
      });
      if(failure){proof.refused.push({function:name,reason:failure});continue;}
      selected.set(name,{declarations,bodies,refs,staticRows});
    }
    // Prove each name independently: a legitimately observed callback cannot
    // grant permission for itself or block unrelated independently private code.
    for(const [name,row]of selected){
      let protocol;try{protocol=proveClosedProtocolNameAbsence([...documents.values()],[name]);}
      catch(error){proof.refused.push({function:name,reason:String(error.message)});continue;}
      if(!row.bodies.length){for(const n of row.declarations){removed.add(n);edits.push({start:n.pos,end:n.end,before:source.slice(n.pos,n.end),replacement:''});}}
      else for(const n of row.staticRows){
        stripped.add(n);for(const m of n.modifiers.filter(m=>m.kind===K.StaticKeyword))edits.push({start:m.pos,end:m.end,before:source.slice(m.pos,m.end),replacement:''});
      }
      proof.records.push({function:name,kind:row.bodies.length?'UNOBSERVED_PRIVATE_FUNCTION_LINKAGE':'UNREFERENCED_BODYLESS_PROTOTYPE',
        declarations:row.declarations.map(n=>({start:n.pos,end:n.end})),boundCalls:row.refs,protocol,
        bodyBytesRetained:true,typesAndCallAbiExact:true,allReachableSourceUnitsVerified:true});
    }
    const applied=applyReversibleSourceEdits(source,edits),output=parse(applied.text,'closed-function-declaration-view');assert.equal(output.parseDiagnostics.length,0);
    const expected=projectedExpressionGroupingShape(ast,n=>{
      if(n.kind===K.SourceFile)return {...n,statements:n.statements.filter(s=>!removed.has(s))};
      return stripped.has(n)?{...n,modifiers:n.modifiers.filter(m=>m.kind!==K.StaticKeyword)}:n;
    });
    assert.deepEqual(shape(output),expected,'CLOSED_DECLARATION_CHANGED_OTHER_AST');
    return {text:applied.text,proof:{...proof,viewSha256:sha(applied.text),edits:applied.proof.edits,
      byteInverseVerified:applied.proof.byteInverseVerified,allOtherAstExact:true,wholeProgramOracleStillRequired:true}};
  }finally{bound.dispose();}
}
