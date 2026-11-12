import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';

// One sequence for map roots and owned libraries. Implementations are supplied
// by the qualified runtime, keeping its parser and scoped binding identities.
const stages=[
 ['lowerExpressionIntegerComplements','EXPRESSION_INTEGER_COMPLEMENT_PROOF.json','plain'],
 ['lowerLiteralBooleanIfPredicates','LITERAL_BOOLEAN_IF_PREDICATE_PROOF.json','plain'],
 ['lowerTypedIntegerPredicates','TYPED_INTEGER_PREDICATE_PROOF.json','declarations'],
 ['promoteReadonlyLiteralStringGlobals','READONLY_LITERAL_STRING_GLOBAL_PROOF.json','texts'],
 ['lowerRedundantGlobalIntegerZeros','REDUNDANT_GLOBAL_INT_ZERO_PROOF.json','plain'],
 ['lowerScalarBitwiseAssignments','SCALAR_BITWISE_ASSIGNMENT_PROOF.json','declarations'],
 ['lowerScalarShiftAssignments','SCALAR_SHIFT_LOWERING_PROOF.json','plain'],
];
const sha=text=>createHash('sha256').update(text).digest('hex');
export function createGuiExpressionPreparation(implementations){
 for(const[name]of stages)assert.equal(typeof implementations[name],'function','GUI_PREPARATION_STAGE_REQUIRED:'+name);
 return (source,{declarations=[],document}={})=>{
  assert.equal(typeof source,'string');assert(document&&typeof document.run==='function','GUI_PREPARATION_SHARED_DOCUMENT_REQUIRED');
  assert(Array.isArray(declarations)&&declarations.every(d=>typeof d.fileName==='string'&&typeof d.text==='string'),'GUI_PREPARATION_DECLARATIONS_REQUIRED');
  let text=source;const records=[];
  for(const[name,proofFile,context]of stages){
   const args=context==='plain'?[]:[context==='texts'?declarations.map(d=>d.text):declarations];
   const result=document.run(name,view=>implementations[name](text,...args,view));
   assert(typeof result.text==='string'&&result.proof,'GUI_PREPARATION_STAGE_RESULT_REQUIRED:'+name);
   records.push({name,proofFile,proof:result.proof});text=result.text;
  }
  return {text,stages:records,proof:{kind:'SHARED_GUI_EXPRESSION_PREPARATION',sourceSha256:sha(source),outputSha256:sha(text),
   stages:records.map(r=>r.name),declarationContext:declarations.map(d=>({fileName:d.fileName,sha256:sha(d.text)})),
   persistentCache:false,sourceOrArchivesChanged:false,wholeProgramClosureAsserted:false,wholeMapAccepted:false}};
 };
}
