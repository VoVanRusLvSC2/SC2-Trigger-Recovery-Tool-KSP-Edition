import {createHash} from 'node:crypto';
import {Parser,Scanner,SyntaxKind as K,forEachChild} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {declaredCarrier} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/galaxy-program-context.js';

const sha=s=>createHash('sha256').update(s).digest('hex');
const un=n=>{while(n?.kind===K.ParenthesizedExpression)n=n.expression;return n;};
const walk=(n,fn)=>{fn(n);forEachChild(n,c=>walk(c,fn));};
const owner=n=>{while(n&&n.kind!==K.FunctionDeclaration)n=n.parent;return n;};
const symbol=(p,n)=>{const b=p.getBinding(n);return b.status==='BOUND'?b.symbolId:undefined;};
const native=(p,call)=>{
  const name=un(call?.expression),d=name?.kind===K.Identifier&&p.declarationAt(name);
  if(!d||!symbol(p,name)||d.kind!==K.FunctionDeclaration||d.body||
     !d.modifiers?.some(m=>m.kind===K.NativeKeyword)||d.parameters.length!==call.arguments.length)return;
  let a=d;while(a.parent)a=a.parent;
  return p.verifiedInputIdentity(a.fileName)?.owned===false?d:undefined;
};
function apply(text,edits){
  edits.sort((a,b)=>b.start-a.start||b.end-a.end);let boundary=text.length;
  for(const e of edits){if(e.end>boundary||e.start<0||e.end<e.start)throw Error('OVERLAPPING_INLINE_EDITS');
    text=text.slice(0,e.start)+e.text+text.slice(e.end);boundary=e.start;}
  return text;
}
function lexicalEnd(text){
  let tokens;
  return node=>{
    if(!tokens){tokens=[];const scanner=new Scanner(()=>{throw Error('INLINE_SCANNER_ERROR');});scanner.setText(text);
      for(let kind;(kind=scanner.scan())!==K.EndOfFileToken;)if(kind!==K.SingleLineCommentTrivia)
        tokens.push({start:scanner.getTokenPos(),end:scanner.getCurrentPos()});}
    let lo=0,hi=tokens.length;while(lo<hi){const mid=(lo+hi)>>>1;if(tokens[mid].start<node.end)lo=mid+1;else hi=mid;}
    const token=tokens[lo-1];if(!token||token.start<node.pos||token.end>node.end)throw Error('INLINE_TOKEN_SPAN_MISMATCH');
    return token.end;
  };
}

/** Eliminate an otherwise unrepresentable *source-owned* unitref formal.
 * Only native consumers of a snapshot are allowed. The unit operand is captured
 * once; each read retains the exact UnitRefFromUnit snapshot projection. This
 * is ordinary source inlining, never authority to emit an unsupported GUI API.
 * Input identities and lexical symbols, rather than names, determine ownership.
 */
export function inlineSnapshotReferenceActions(program,{maxCalls=64,maxExpandedBytes=512000}={}){
  if(typeof program?.verifiedInputIdentity!=='function')throw Error('VERIFIED_INLINE_PROGRAM_REQUIRED');
  const documents=[],identifiers=[],strings=[],names=new Set();
  for(const ast of program.documents.values()){
    program.attachOriginal(ast);const identity=program.verifiedInputIdentity(ast.fileName);
    if(!identity)throw Error('INLINE_INPUT_IDENTITY_REQUIRED');
    if(!ast.text||sha(ast.text)!==identity.contentSha256)throw Error('INLINE_SOURCE_IDENTITY_MISMATCH');
    if(ast.parseDiagnostics.length)throw Error('INLINE_SOURCE_PARSE_ERRORS');
    if(identity.owned)documents.push(ast);walk(ast,n=>{
      if(n.kind===K.Identifier){identifiers.push(n);names.add(n.name);}
      if(n.kind===K.StringLiteral)strings.push(n);
    });
  }
  const plans=[],rejected=[];
  const ends=new Map(documents.map(a=>[a.fileName,lexicalEnd(a.text)]));
  for(const ast of documents)for(const fn of ast.statements){
    if(fn.kind!==K.FunctionDeclaration||!fn.body||declaredCarrier(fn.type)!=='void'||fn.parameters.length!==1||
       declaredCarrier(fn.parameters[0].type)!=='unitref')continue;
    const at=program.location(fn),fnId=symbol(program,fn.name),formal=fn.parameters[0],paramId=symbol(program,formal.name);
    let reason;const bodyNodes=[];walk(fn.body,n=>bodyNodes.push(n));
    if(!fnId||!paramId)reason='UNBOUND_SOURCE_FORMAL';
    if(bodyNodes.some(n=>n.kind===K.ReturnStatement))reason='RETURN_WOULD_CHANGE_CALLER';
    const locals=bodyNodes.filter(n=>n.kind===K.VariableDeclaration),localIds=new Set(locals.map(n=>symbol(program,n.name)));
    if(localIds.has(undefined)||locals.some(n=>n.parent!==fn.body||!n.initializer||
       n.modifiers?.length||!['int','bool','fixed','unit','trigger','string','text','actor','actorscope'].includes(declaredCarrier(n.type))))reason='UNSUPPORTED_LOCAL_STORAGE';
    const declarations=identifiers.filter(n=>symbol(program,n)===fnId&&n.parent?.kind===K.FunctionDeclaration&&n.parent.name===n).map(n=>n.parent);
    if(declarations.some(n=>n!==fn&&(n.body||n.modifiers?.some(m=>m.kind===K.NativeKeyword)||
       declaredCarrier(n.type)!=='void'||n.parameters.length!==1||declaredCarrier(n.parameters[0].type)!=='unitref'||
       program.location(n).sourceFile!==at.sourceFile)))reason='CONFLICTING_SOURCE_FORWARD_DECLARATION';
    const refs=identifiers.filter(n=>symbol(program,n)===fnId&&!(n.parent?.kind===K.FunctionDeclaration&&n.parent.name===n));
    const callSites=refs.map(n=>n.parent?.kind===K.CallExpression&&un(n.parent.expression)===n?n.parent:undefined);
    if(!refs.length||callSites.some(c=>!c)||callSites.length>maxCalls)reason='FUNCTION_ESCAPE_OR_CALL_BUDGET';
    if(strings.some(n=>String(n.value??n.text).includes(fn.name.name)))reason='NAMED_DISPATCH_NOT_CLOSED';
    const uses=bodyNodes.filter(n=>n.kind===K.Identifier&&symbol(program,n)===paramId);
    if(uses.some(n=>{
      let value=n;while(value.parent?.kind===K.ParenthesizedExpression)value=value.parent;
      const call=value.parent,index=call?.kind===K.CallExpression?call.arguments.indexOf(value):-1;
      return index<0||declaredCarrier(native(program,call)?.parameters[index]?.type)!=='unitref';
    }))reason='FORMAL_IS_NOT_A_NATIVE_SNAPSHOT_READ';
    // Inlining an unknown source call could create a cycle, change a capture,
    // or hide a second source-owned ABI. Keep this first rule deliberately closed.
    if(bodyNodes.some(n=>n.kind===K.CallExpression&&!native(program,n)))reason='SOURCE_BODY_CALL_CLOSURE_NOT_NATIVE';
    const freeNames=new Set(bodyNodes.filter(n=>n.kind===K.Identifier&&
      symbol(program,n)!==paramId&&!localIds.has(symbol(program,n))).map(n=>n.name));
    const siteRows=[];
    for(const call of callSites.filter(Boolean)){
      const caller=owner(call),where=program.location(call),arg=un(call.arguments[0]),api=native(program,arg);
      let siteReason;
      if(call.parent?.kind!==K.ExpressionStatement||call.parent.expression!==call||
         call.parent.parent?.kind!==K.Block||!caller||caller===fn)siteReason='CALL_IS_NOT_A_SEPARATE_BLOCK_STATEMENT';
      if(where.sourceFile!==at.sourceFile||call.arguments.length!==1)siteReason='CROSS_DOCUMENT_OR_ARGUMENT_ARITY';
      if(!api||api.name.name!=='UnitRefFromUnit'||declaredCarrier(api.type)!=='unitref'||
         declaredCarrier(api.parameters[0]?.type)!=='unit'||arg.arguments.length!==1||
         program.getBinding(arg.arguments[0]).carrier!=='unit')siteReason='ARGUMENT_IS_NOT_A_VERIFIED_UNIT_SNAPSHOT';
      const callerLocals=[...(caller?.parameters??[])];if(caller?.body)walk(caller.body,n=>{if(n.kind===K.VariableDeclaration)callerLocals.push(n);});
      if(callerLocals.some(n=>freeNames.has(n.name?.name)))siteReason='CALLER_SHADOWS_A_FREE_SOURCE_BINDING';
      if(siteReason)reason=siteReason;
      siteRows.push({call,caller,arg,source:where});
    }
    if(reason){rejected.push({source:at,reason});continue;}
    const end=ends.get(ast.fileName),bodyEnd=end(fn.body);
    if(ast.text[fn.body.pos]!=='{'||ast.text[bodyEnd-1]!=='}')throw Error('INLINE_BODY_BRACE_SPAN_MISMATCH');
    let size=0;const edits=[],instances=[],hoists=new Map();
    for(const site of siteRows){
      const key=sha(JSON.stringify([at.contentSha256,at.start,site.source.start])).slice(0,12),renames=new Map();
      const fresh=name=>{let result=`lv_inline_${key}_${name}`,i=0;while(names.has(result))result=`lv_inline_${key}_${name}_${++i}`;names.add(result);return result;};
      const capture=fresh(formal.name.name);renames.set(paramId,capture);
      for(const local of locals)renames.set(symbol(program,local.name),fresh(local.name.name));
      const inner=[];
      const declarations=[`unit ${capture};`];
      for(const local of locals){
        // The Galaxy grammar requires locals at the entry of a function.
        // Hoist declarations only; retain each initializer at the call site.
        declarations.push(`${ast.text.slice(local.type.pos,end(local.type))} ${renames.get(symbol(program,local.name))};`);
        inner.push({start:local.pos-fn.body.pos-1,end:local.name.pos-fn.body.pos-1,text:''});
      }
      for(const node of bodyNodes)if(node.kind===K.Identifier&&renames.has(symbol(program,node))){
        const id=symbol(program,node),text=id===paramId?`UnitRefFromUnit(${capture})`:renames.get(id);
        inner.push({start:node.pos-fn.body.pos-1,end:end(node)-fn.body.pos-1,text});
      }
      const body=apply(ast.text.slice(fn.body.pos+1,bodyEnd-1),inner);
      const operand=ast.text.slice(site.arg.arguments[0].pos,end(site.arg.arguments[0]));
      const text=`\n${capture} = (${operand});\n${body}\n`;
      size+=text.length;
      edits.push({start:site.call.parent.pos,end:end(site.call.parent),text});
      const position=site.caller.body.pos+1;
      hoists.set(position,[...(hoists.get(position)??[]),...declarations]);
      instances.push({source:site.source,caller:program.location(site.caller),capture,operand:program.location(site.arg.arguments[0]),
        argumentEvaluations:1,snapshotConsumers:uses.length,localBindings:locals.length});
    }
    if(size>maxExpandedBytes){rejected.push({source:at,reason:'INLINE_EXPANSION_BUDGET'});continue;}
    for(const [position,declarations]of hoists)edits.push({start:position,end:position,text:'\n'+declarations.join('\n')+'\n'});
    for(const declaration of declarations)edits.push({start:declaration.pos,end:end(declaration),text:''});
    plans.push({fileName:ast.fileName,edits,record:{kind:'SOURCE_BOUND_SNAPSHOT_FORMAL_INLINE',source:at,instances,
      callbackOrNamedDispatch:false,returnControlUnchanged:true,freeBindingsUnchanged:true,newRuntimeFunctions:0,newNative:0,newCustomScript:0,
      guiBindingAuthorized:false,originalFilesChanged:false}});
  }
  const files=[],records=[];
  for(const ast of documents){
    const selected=plans.filter(p=>p.fileName===ast.fileName);if(!selected.length)continue;
    const text=apply(ast.text,selected.flatMap(p=>p.edits));
    if(new Parser().parseFile(ast.fileName,text).parseDiagnostics.length)throw Error('INLINE_OUTPUT_PARSE_ERRORS');
    files.push({fileName:ast.fileName,text,originalSha256:sha(ast.text),sha256:sha(text)});
    records.push(...selected.map(p=>p.record));
  }
  return {files,records,rejected,originalFilesChanged:false,converterInputChanged:files.length>0,emissionAuthorized:false};
}
