import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha = text => createHash('sha256').update(text).digest('hex');
const walk = (node, visit) => {visit(node);forEachChild(node, child => {walk(child, visit);});};

// Comparison only: an unused intrinsic scalar slot has no constructor or
// address identity. Never erase an initializer, array, reference or nominal
// storage, and refuse a same-spelling value reference whose binding is unknown.
export function canonicalUnreferencedIntrinsicLocals(source) {
  const input = {fileName:'private-unused.galaxy',text:source,contentSha256:sha(source),owned:true};
  const program = new GalaxyProgramContext([input],{files:[input]},sha,{checks:'binding'});
  const edits=[], refused=[];
  try {
    const ast=program.documents.get(input.fileName);program.attachOriginal(ast);
    assert.equal(ast.parseDiagnostics.length,0);
    for(const fn of ast.statements) {
      if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
      for(const local of fn.body.statements) {
        if(local.kind!==K.VariableDeclaration)break;
        if(local.initializer||local.modifiers?.length||local.isReference||
          !(local.type.kind>=K.BoolKeyword&&local.type.kind<=K.WavetargetKeyword)||local.type.kind===K.VoidKeyword)continue;
        const binding=program.getBinding(local.name);
        if(binding.status!=='BOUND')continue;
        let used=false,unknown=false;
        walk(fn.body,node=>{
          if(node.kind!==K.Identifier||node.name!==local.name.name||node===local.name||
            node.parent?.kind===K.PropertyAccessExpression&&node.parent.name===node) return;
          const value=program.getBinding(node);
          if(value.status!=='BOUND')unknown=true;
          else if(value.symbolId===binding.symbolId)used=true;
        });
        if(used||unknown){if(unknown)refused.push({function:fn.name.name,name:local.name.name,reason:'UNBOUND_SAME_SPELLING_REFERENCE'});continue;}
        const terminal=local.syntaxTokens?.filter(token=>token.kind===K.SemicolonToken).at(-1);
        assert(terminal&&source[terminal.pos]===';','UNUSED_LOCAL_TERMINATOR_RANGE');
        const end=terminal.pos+1;
        edits.push({start:local.pos,end,before:source.slice(local.pos,end),replacement:'',
          function:fn.name.name,symbolId:binding.symbolId,type:K[local.type.kind],role:'unreferenced-intrinsic-local-slot'});
      }
    }
    const result=applyReversibleSourceEdits(source,edits);
    return {...result,proof:{...result.proof,kind:'UNREFERENCED_INTRINSIC_LOCAL_SLOTS',refused,
      initializersErased:0,globalDeclarationsErased:0,sourceOrExportChanged:false,wholeMapAccepted:false}};
  } finally {program.dispose();}
}
