import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {GalaxyProgramContext} from '../model/galaxy-program-context.lazy-carriers.mjs';
import {parseImmutableGalaxySyntax as parse} from '../model/immutable-galaxy-syntax.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const sha=value=>createHash('sha256').update(value).digest('hex');
const un=node=>{while(node?.kind===K.ParenthesizedExpression)node=node.expression;return node;};
export function canonicalTypedZeroSubtraction(source){
  const input={fileName:'typed-zero.galaxy',sourceId:'typed-zero',text:source,owned:true,contentSha256:sha(source)};
  const program=new GalaxyProgramContext([input],{files:[input]},sha,{checks:'binding'});
  try{
    const ast=program.documents.get(input.fileName);program.attachOriginal(ast);assert.equal(ast.parseDiagnostics.length,0);
    const render=new WeakMap(),records=[];
    function visit(node){
      const children=[];forEachChild(node,child=>{visit(child);children.push(child);});
      let text=source.slice(node.pos,node.end);
      for(const child of children.filter(child=>render.has(child)).sort((a,b)=>b.pos-a.pos))text=text.slice(0,child.pos-node.pos)+render.get(child)+text.slice(child.end-node.pos);
      const zero=node.kind===K.BinaryExpression&&node.operatorToken.kind===K.MinusToken&&un(node.left);
      if(zero?.kind===K.NumericLiteral&&/^0(?:\.0+)?$/u.test(zero.text??'')){
        const carrier=program.carrierAt(node),operandCarrier=program.carrierAt(node.right);
        if(['int','fixed'].includes(carrier)&&operandCarrier===carrier&&(carrier==='fixed'||!zero.text.includes('.'))){
          const operand=render.get(node.right)??source.slice(node.right.pos,node.right.end);
          text='(-('+operand+'))';records.push({start:node.pos,end:node.end,carrier,operandCarrier,operandEvaluations:1,
            literalZero:zero.text,operator:'ADDITIVE_INVERSE',noNumericReassociation:true,noIntegerToFixedDomainChange:true});
        }
      }
      if(text!==source.slice(node.pos,node.end))render.set(node,text);
    }
    visit(ast);const text=render.get(ast)??source;assert.equal(parse(text,'typed-zero-view').parseDiagnostics.length,0);
    return {text,proof:{kind:'SAME_CARRIER_ZERO_SUBTRACTION_TO_NEGATION',sourceSha256:sha(source),viewSha256:sha(text),records,
      sourceOrExportChanged:false,rawOracleReplaced:false,wholeMapAccepted:false,persistentCache:false}};
  }finally{program.dispose();}
}
