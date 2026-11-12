// Comparison view only. A dead, scalar int local initialized by a bound global
// literal constant has no observable Galaxy-side effect. Never change a map or
// infer equivalence from this pass alone; compare the complete program afterward.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.linear.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const walk=(n,visit)=>{visit(n);forEachChild(n,c=>walk(c,visit));};
export function canonicalUnusedConstantSnapshotLocals(source){
 const input={fileName:'expanded-program.galaxy',text:source,contentSha256:sha(source),owned:true};
 const program=new GalaxyProgramContext([input],{files:[input]},sha,{checks:'binding'}),edits=[],refused=[];
 try{
  const ast=program.documents.get(input.fileName);program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length,0,'UNUSED_SNAPSHOT_INPUT_SYNTAX');
  for(const fn of ast.statements){if(fn.kind!==K.FunctionDeclaration||!fn.body)continue;
   const locals=fn.body.statements.filter(n=>n.kind===K.VariableDeclaration&&n.type?.kind===K.IntKeyword&&!n.isReference&&n.modifiers?.length===1&&n.modifiers[0].kind===K.ConstKeyword&&n.initializer?.kind===K.Identifier);
   if(!locals.length)continue;
   const pending=[];
   for(const local of locals){
    const value=local.initializer,global=program.declarationAt(value),localBinding=program.getBinding(local.name),globalBinding=program.getBinding(value);
    if(localBinding.status!=='BOUND'||globalBinding.status!=='BOUND'||global?.kind!==K.VariableDeclaration||global.parent?.kind!==K.SourceFile||global.type?.kind!==K.IntKeyword||global.isReference||global.modifiers?.length!==1||global.modifiers[0].kind!==K.ConstKeyword||readCanonicalInt32Literal(global.initializer)===undefined)continue;
    pending.push({local,global,localBinding,used:false,unknown:false});
   }
   if(!pending.length)continue;
   const byName=new Map();for(const p of pending){const list=byName.get(p.local.name.name)??[];list.push(p);byName.set(p.local.name.name,list);}
   walk(fn.body,node=>{if(node.kind!==K.Identifier||!byName.has(node.name)||node.parent?.kind===K.PropertyAccessExpression&&node.parent.name===node)return;
    const binding=program.getBinding(node);for(const p of byName.get(node.name)){if(node===p.local.name)continue;if(binding.status!=='BOUND')p.unknown=true;else if(binding.symbolId===p.localBinding.symbolId)p.used=true;}
   });
   for(const p of pending){if(p.used||p.unknown){if(p.unknown)refused.push({function:fn.name.name,reason:'LOCAL_REFERENCE_UNBOUND'});continue;}
    const terminal=p.local.syntaxTokens?.filter(t=>t.kind===K.SemicolonToken).at(-1);assert(terminal&&source[terminal.pos]===';','UNUSED_SNAPSHOT_TERMINATOR');
    const end=terminal.pos+1;edits.push({start:p.local.pos,end,before:source.slice(p.local.pos,end),replacement:'',function:fn.name.name,
     symbolId:p.localBinding.symbolId,initializerGlobal:p.global.name.name,globalLiteral:String(readCanonicalInt32Literal(p.global.initializer))});
   }
  }
  const result=applyReversibleSourceEdits(source,edits);
  return {...result,proof:{...result.proof,kind:'UNREFERENCED_PURE_INTEGER_SNAPSHOT_LOCALS',refused,
   boundary:'Complete expanded Galaxy comparison view; excludes debugger, profiler and VM resource accounting.',
   globalsChanged:0,sourceOrExportChanged:false,wholeProgramOracleStillRequired:true,wholeMapAccepted:false}};
 }finally{program.dispose();}
}
