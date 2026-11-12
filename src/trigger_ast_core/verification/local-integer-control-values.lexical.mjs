import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lexical-parameters.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {applyReversibleSourceEdits} from '../model/reversible-source-edits.mjs';
import {readCanonicalInt32Literal} from '../types/inclusive-literal-int-comparison.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=x=>createHash('sha256').update(x).digest('hex');
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,visit)=>{visit(n);forEachChild(n,child=>{walk(child,visit);});};
function programFor(text){const input={fileName:'integer-control.galaxy',text,owned:true,contentSha256:sha(text)};
  const program=new GalaxyProgramContext([input],{files:[input],dependencies:[]},sha),ast=program.documents.get(input.fileName);
  program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length,0);return {program,ast};}
function projectConstants(source){
  const {program,ast}=programFor(source),edits=[],qualified=[],refused=[];
  try{
    for(const fn of ast.statements.filter(n=>n.kind===K.FunctionDeclaration&&n.body)){
      const locals=new Map();
      for(const decl of fn.body.statements)if(decl.kind===K.VariableDeclaration&&decl.type.kind===K.IntKeyword&&
        decl.modifiers?.length===1&&decl.modifiers[0].kind===K.ConstKeyword){const value=readCanonicalInt32Literal(un(decl.initializer));if(value!==undefined)locals.set(decl,{value,refs:[],unsafe:false});}
      if(!locals.size)continue;
      walk(fn.body,node=>{
        if(node.kind!==K.Identifier)return;const decl=program.declarationAt(node),row=locals.get(decl);if(!row||node===decl.name)return;
        row.refs.push(node);
        for(let parent=node.parent;parent&&parent!==fn.body;parent=parent.parent){
          if(parent.kind===K.CallExpression){row.unsafe=true;break;}
          if(parent.kind===K.BinaryExpression&&un(parent.left)===node&&!['EqualsEqualsToken','ExclamationEqualsToken','LessThanToken','LessThanEqualsToken','GreaterThanToken','GreaterThanEqualsToken','PlusToken','MinusToken','AsteriskToken','SlashToken','PercentToken','AmpersandAmpersandToken','BarBarToken'].some(name=>K[name]===parent.operatorToken.kind)){row.unsafe=true;break;}
          if([K.PrefixUnaryExpression,K.PostfixUnaryExpression].includes(parent.kind)&&[K.PlusPlusToken,K.MinusMinusToken].includes(parent.operator?.kind)){row.unsafe=true;break;}
        }
      });
      for(const [decl,row]of locals){
        if(row.unsafe){refused.push({function:fn.name.name,name:decl.name.name,reason:'CALL_ARGUMENT_OR_WRITE_USE'});continue;}
        edits.push({start:decl.pos,end:decl.end,before:source.slice(decl.pos,decl.end),replacement:'',role:'private-int-constant-declaration'});
        for(const ref of row.refs)edits.push({start:ref.pos,end:ref.end,before:source.slice(ref.pos,ref.end),replacement:'('+row.value+')',role:'bound-private-int-read'});
        qualified.push({function:fn.name.name,name:decl.name.name,value:String(row.value),start:decl.pos,end:decl.end,references:row.refs.length});
      }
    }
    const result=applyReversibleSourceEdits(source,edits);return {...result,proof:{...result.proof,qualified,refused,globalDeclarationsRemoved:false,callArgumentsNeverSubstituted:true}};
  }finally{program.dispose();}
}
const comparisons=new Set([K.EqualsEqualsToken,K.ExclamationEqualsToken,K.LessThanToken,K.LessThanEqualsToken,K.GreaterThanToken,K.GreaterThanEqualsToken]);
const compare=(a,b,op)=>op===K.EqualsEqualsToken?a===b:op===K.ExclamationEqualsToken?a!==b:op===K.LessThanToken?a<b:op===K.LessThanEqualsToken?a<=b:op===K.GreaterThanToken?a>b:a>=b;
function projectConditions(source){
  const {program,ast}=programFor(source),render=new WeakMap(),truth=new WeakMap(),changes=[];
  try{
    const stack=[{node:ast,done:false}];
    const boolean=node=>{
      node=un(node);if(!node)return false;
      if([K.TrueKeyword,K.FalseKeyword].includes(node.kind)||node.kind===K.PrefixUnaryExpression&&node.operator.kind===K.ExclamationToken)return true;
      if(node.kind===K.BinaryExpression&&(comparisons.has(node.operatorToken.kind)||[K.AmpersandAmpersandToken,K.BarBarToken].includes(node.operatorToken.kind)))return true;
      return node.kind===K.Identifier&&program.declarationAt(node)?.type?.kind===K.BoolKeyword;
    };
    while(stack.length){
      const {node,done}=stack.pop(),children=[];forEachChild(node,child=>{children.push(child);});
      if(!done){stack.push({node,done:true});for(const child of children)stack.push({node:child,done:false});continue;}
      let value=source.slice(node.pos,node.end),role;
      for(const child of children.filter(c=>render.has(c)).sort((a,b)=>b.pos-a.pos))value=value.slice(0,child.pos-node.pos)+render.get(child)+value.slice(child.end-node.pos);
      const output=n=>render.get(un(n))??source.slice(un(n).pos,un(n).end),known=n=>truth.get(un(n));
      if(node.kind===K.TrueKeyword||node.kind===K.FalseKeyword)truth.set(node,node.kind===K.TrueKeyword);
      if(node.kind===K.ParenthesizedExpression&&known(node.expression)!==undefined)truth.set(node,known(node.expression));
      if(node.kind===K.PrefixUnaryExpression&&node.operator.kind===K.ExclamationToken&&known(node.operand)!==undefined){truth.set(node,!known(node.operand));value=known(node.operand)?'false':'true';role='closed-boolean-negation';}
      if(node.kind===K.BinaryExpression){
        const op=node.operatorToken.kind,left=un(node.left),right=un(node.right),a=readCanonicalInt32Literal(left),b=readCanonicalInt32Literal(right);
        if(comparisons.has(op)&&a!==undefined&&b!==undefined){const result=compare(a,b,op);truth.set(node,result);value=result?'true':'false';role='closed-int32-comparison';}
        else if([K.LessThanToken,K.GreaterThanToken].includes(op)&&b!==undefined&&left.kind===K.Identifier&&program.declarationAt(left)?.type?.kind===K.IntKeyword&&
          (op===K.LessThanToken?b> -2147483648n:b<2147483647n)){
          value='('+output(left)+(op===K.LessThanToken?' <= ':' >= ')+(op===K.LessThanToken?b-1n:b+1n)+')';role='exact-int32-strict-bound';
        }else if([K.AmpersandAmpersandToken,K.BarBarToken].includes(op)){
          const l=known(left),r=known(right),and=op===K.AmpersandAmpersandToken;
          if(l!==undefined){
            if(and&&!l||!and&&l){truth.set(node,l);value=l?'true':'false';role='originally-skipped-right-operand';}
            else if(boolean(right)){value='('+output(right)+')';if(r!==undefined)truth.set(node,r);role='left-neutral-boolean';}
          }else if((and&&r===true||!and&&r===false)&&boolean(left)){value='('+output(left)+')';role='right-neutral-boolean';}
        }
      }
      if(role)changes.push({start:node.pos,end:node.end,before:source.slice(node.pos,node.end),replacement:value,role,evaluationOrderPreserved:true});
      if(value!==source.slice(node.pos,node.end))render.set(node,value);
    }
    const edits=[];for(const edit of changes.sort((a,b)=>a.start-b.start||b.end-a.end)){if(edits.at(-1)?.end>edit.start){assert(edits.at(-1).end>=edit.end);continue;}edits.push(edit);}
    const result=applyReversibleSourceEdits(source,edits);
    assert.equal(result.text,source.slice(0,ast.pos)+(render.get(ast)??source.slice(ast.pos,ast.end))+source.slice(ast.end));
    return {...result,proof:{...result.proof,changes,numericTruthinessUsed:false,fixedPointStrictBoundsChanged:false}};
  }finally{program.dispose();}
}
export function canonicalLocalIntegerControlValues(source){
  const constants=projectConstants(source),conditions=projectConditions(constants.text);
  assert.equal(parse(conditions.text,'integer-control-result').parseDiagnostics.length,0);
  return {text:conditions.text,proof:{kind:'PRIVATE_INT32_CONTROL_VALUES',sourceSha256:sha(source),proofInputSha256:sha(conditions.text),
    constants:constants.proof,conditions:conditions.proof,byteInverseVerified:true,sourceOrExportChanged:false,wholeMapAccepted:false}};
}
