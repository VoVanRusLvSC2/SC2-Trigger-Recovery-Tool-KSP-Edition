import {withGalaxyDocument} from '../model/galaxy-program.collections.mjs';
// Reuse qualified scalar rules for archive-verified included sources as well as
// the main map script. Keep original packed files as the comparison reference.
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lowerScalarBitwiseAssignments} from '../passes/scalar-bitwise-assignment.mjs';
import {lowerScalarShiftAssignments} from '../passes/scalar-shift-assignment.mjs';
import {lowerExpressionIntegerComplements} from '../passes/expression-integer-complement.mjs';
import {lowerClosedIntegerExpressions} from '../passes/closed-integer-expressions.mjs';
const sha=text=>createHash('sha256').update(text).digest('hex');
export function lowerVerifiedOwnedScriptIntegerOperations(input,{declarations=[],documents}={}) {
 assert(Array.isArray(input.files)&&Array.isArray(input.proof?.records));
 assert.equal(input.proof.sourceOrPackedFilesWritten,false);
 if(!input.files.length){assert.equal(input.proof.records.length,0);return {files:[],proof:{kind:'NO_OWNED_SCRIPT_INTEGER_OPERATIONS',records:[],sourceOrPackedFilesWritten:false}};}
 assert.equal(input.proof.kind,'VERIFIED_MAP_OWNED_SCRIPT_LOOP_INPUTS');
 assert(/^[0-9a-f]{64}$/u.test(input.proof.archiveSha256));
 const astDocuments=[],records=[],files=input.files.map(file=>{
  const matching=input.proof.records.filter(r=>r.fileName===file.fileName&&r.originalPath===file.originalPath);
  assert.equal(matching.length,1,'OWNED_INTEGER_INPUT_PROVENANCE_AMBIGUOUS');const previous=matching[0];
  assert.equal(sha(file.text),previous.outputSha256,'OWNED_INTEGER_INPUT_CHANGED');
  const {bitwise,shift,complement,closed,astEvidence}=withGalaxyDocument(file,documents,document=>{
  const bitwise=document.run('bitwise',view=>lowerScalarBitwiseAssignments(file.text,declarations,view));
  const shift=document.run('shift',view=>lowerScalarShiftAssignments(bitwise.text,view));
  const complement=document.run('complement',view=>lowerExpressionIntegerComplements(shift.text,view));
  const closed=document.run('closed',view=>lowerClosedIntegerExpressions(complement.text,view));
   return {bitwise,shift,complement,closed,astEvidence:document.evidence()};
  });
  records.push({fileName:file.fileName,originalPath:file.originalPath,originalSourceSha256:previous.originalSourceSha256,
   inputSha256:sha(file.text),outputSha256:sha(closed.text),bitwise:bitwise.proof,shift:shift.proof,complement:complement.proof,closed:closed.proof});
  astDocuments.push(astEvidence);
  return {...file,text:closed.text};
 });
 return {files,astDocuments,proof:{kind:'VERIFIED_MAP_OWNED_SCRIPT_INTEGER_OPERATIONS',archiveSha256:input.proof.archiveSha256,records,
  changedFiles:records.filter(r=>r.inputSha256!==r.outputSha256).length,sourceOrPackedFilesWritten:false,persistentCache:false,wholeMapAccepted:false}};
}
