import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {createGalaxyDocument} from './galaxy-document.collections.mjs';
import {SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';

const sha=text=>createHash('sha256').update(text).digest('hex');
const separator=/^\/\/[-=]{16,}$/u;
function codeEnd(text,node) {
  // Parser .end includes subsequent comment trivia. The actual closing token
  // position belongs to this declaration; nested braces cannot close its span.
  if(node.kind===K.IncludeStatement && typeof node.path?.text==='string') {
    const end=node.path.pos+node.path.text.length;
    assert.equal(text.slice(node.path.pos,end),node.path.text,'SOURCE_INCLUDE_TOKEN_POSITION');
    return end;
  }
  const tokens=(node.body??node).syntaxTokens??[];
  const ends=tokens.filter(t=>t.kind===K.CloseBraceToken||t.kind===K.SemicolonToken);
  const token=ends.at(-1);
  if(!token)return undefined;
  const expected=token.kind===K.CloseBraceToken?'}':';';
  assert.equal(text[token.pos],expected,'SOURCE_SECTION_TOKEN_POSITION');
  return token.pos+1;
}

/** Recover evidence for authored raw sections when Triggers is absent.
 * This is an index, NOT permission to add ScriptCode, a GUI binding, or an
 * equivalence proof. Lowering still needs source ownership and call contracts.
 * No names of maps/APIs, runtime mutation, or persistent cache are involved. */
export function indexAuthoredScriptSections({fileName,text,expectedSha256}) {
  assert.equal(typeof text,'string');
  assert.match(expectedSha256??'',/^[a-f0-9]{64}$/u,'SOURCE_SECTION_SHA_REQUIRED');
  assert.equal(sha(text),expectedSha256,'SOURCE_SECTION_SHA_CHANGED');
  const document=createGalaxyDocument({fileName,text});
  try {
    const ast=document.ast,lines=text.split(/\r?\n/u),starts=[];
    let offset=0;for(const line of text.matchAll(/[^\n]*(?:\n|$)/gu)){
      if(!line[0])break;starts.push(offset);offset+=line[0].length;
    }
    const statements=ast.statements.map(n=>({node:n,start:n.pos,end:codeEnd(text,n)}));
    const markers=[],rejected=[];
    for(const [line,comment]of ast.commentsLineMap) {
      if(comment.kind!==K.SingleLineCommentTrivia)continue;
      const value=lines[line],named=/^\/\/ Custom Script: (\S.*)$/u.exec(value??'');
      if(!named&&value!=='// Custom Script Initialization')continue;
      const record={line:line+1,offset:starts[line],label:named?.[1],initialization:!named};
      // Both border comments must be the actual lexer comments on adjacent
      // lines, rather than text in a string, block comment, or arbitrary label.
      const borders=[line-1,line+1].map(i=>ast.commentsLineMap.get(i));
      if(!separator.test(lines[line-1]??'')||lines[line-1]!==lines[line+1]||
        borders.some(c=>c?.kind!==K.SingleLineCommentTrivia)||
        statements.some(s=>s.start<record.offset&&record.offset<(s.end??s.node.end))) {
        rejected.push({...record,reason:'NOT_A_COMPLETE_TOP_LEVEL_GENERATED_SECTION_HEADER'});continue;
      }
      record.start=starts[line-1];record.bodyStart=starts[line+2]??text.length;
      markers.push(record);
    }
    const sections=[];
    for(let i=0;i<markers.length;i++) {
      const marker=markers[i];if(marker.initialization)continue;
      // Embedded libraries often omit the printed initialization HEADER.
      // Anchor ownership and the section's end to the actual AST declaration,
      // including an invalid first candidate rather than skipping it for a
      // later library's valid initializer.
      const finish=statements.find(s=>s.start>=marker.bodyStart &&
        s.node.kind===K.FunctionDeclaration && /^(?:lib[A-Za-z0-9]+_)?InitCustomScript$/u.test(s.node.name?.name??''));
      if(!finish){rejected.push({...marker,reason:'MISSING_CUSTOM_SCRIPT_INITIALIZER_ANCHOR'});continue;}
      const initializer=finish.node;
      const match=/^(?:lib([A-Za-z0-9]+)_)?InitCustomScript$/u.exec(initializer.name.name);
      if(!initializer.body||initializer.type?.kind!==K.VoidKeyword||initializer.parameters?.length!==0) {
        rejected.push({...marker,reason:'INVALID_CUSTOM_SCRIPT_INITIALIZER_ANCHOR'});continue;
      }
      const printedFinish=markers.find(m=>m.initialization&&m.start>=marker.bodyStart&&m.start<finish.start);
      const end=Math.min(markers[i+1]?.start??finish.start,printedFinish?.start??finish.start,finish.start);
      const members=statements.filter(s=>s.start>=marker.bodyStart&&s.start<end);
      const library=match[1]??'Map';
      const foreign=members.some(s=>{
        const owner=/^(?:auto_)?lib([A-Za-z0-9]+)_/u.exec(s.node.name?.name??'');
        return owner&&owner[1]!==library;
      });
      if(foreign||members.some(s=>s.end===undefined||s.end>end)){
        rejected.push({...marker,reason:foreign?'FOREIGN_LIBRARY_DECLARATION':'UNBOUNDED_OR_CROSSING_DECLARATION'});continue;
      }
      // An intervening standard section header is a fence, never raw fallback.
      const gap=text.slice(marker.bodyStart,end);
      if(/^\/\/ (?:Global Functions|Global Variables|Trigger Variables|Trigger Initialization|Library:|Library Initialization)/mu.test(gap)){
        rejected.push({...marker,reason:'INTERVENING_GENERATED_SECTION_FENCE'});continue;
      }
      const declarations=members.map(s=>({kind:s.node.kind,name:s.node.name?.name,start:s.start,end:s.end,sha256:sha(text.slice(s.start,s.end))}));
      const calls=[];
      for(const s of members) {
        const visit=n=>{if(n.kind===K.CallExpression&&n.expression.kind===K.Identifier)calls.push({name:n.expression.name,position:n.pos,owner:s.node.name?.name});forEachChild(n,visit);};
        visit(s.node);
      }
      sections.push({library,label:marker.label,start:marker.bodyStart,end,offsetUnit:'UTF16_CODE_UNIT',
        sha256:sha(text.slice(marker.bodyStart,end)),declarations,calls,
        initializer:{name:initializer.name.name,position:initializer.pos},
        provenance:'SHA_BOUND_ORIGINAL_GENERATED_CUSTOM_SCRIPT_SECTION',reconstructsOriginalGuiIds:false});
    }
    return {fileName,sourceSha256:expectedSha256,sections,rejected,sharedAst:true,persistentCache:false,
      sourceChanged:false,bindingPermissionGranted:false,benchmarkVerdictChanged:false,actualEditor:false};
  } finally {document.dispose();}
}
