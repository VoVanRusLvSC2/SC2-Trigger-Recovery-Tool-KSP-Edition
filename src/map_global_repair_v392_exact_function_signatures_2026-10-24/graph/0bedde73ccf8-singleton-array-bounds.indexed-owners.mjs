import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {xmlTree} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js';
import {parseImmutableGalaxySyntax} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/d38acb45983d-immutable-galaxy-syntax.collections.mjs';
import {SyntaxKind as K,forEachChild} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';

const sha=text=>createHash('sha256').update(text).digest('hex');
const child=(node,tag)=>node?.children.find(n=>n.tag===tag);
const groups=root=>[root,...root.children.filter(n=>n.tag==='Library')];
const owner=(node,implicit)=>node.attributes.Id??child(node,'Standard')?.attributes.Id??implicit;
const value=(xml,node)=>node&&xml.slice(node.openEnd,node.closeStart);
const arrays=element=>child(element,'VariableType')?.children.filter(n=>n.tag==='ArraySize')??[];
function index(root,implicit){
 const result=new Map();
 for(const group of groups(root)) {
  const library=owner(group,implicit);
  for(const e of group.children.filter(n=>n.tag==='Element')) {
   const key=JSON.stringify([library,e.attributes.Type,e.attributes.Id]);
   assert(!result.has(key),'ARRAY_BOUND_DUPLICATE_TYPED_ID');result.set(key,e);
  }
 }
 return result;
}
function sourceNames(files){
 const names=new Set();
 for(const [i,file]of files.entries()) {
  const ast=parseImmutableGalaxySyntax(file.text,file.fileName??'array-bound-source-'+i);
  assert.equal(ast.parseDiagnostics.length,0,'ARRAY_BOUND_SOURCE_SYNTAX');
  const visit=node=>{if(node.kind===K.Identifier||node.kind===K.StringLiteral)names.add(node.name??node.value);forEachChild(node,visit);};visit(ast);
 }
 return names;
}

/** Editor treats a literal inclusive bound 0 as scalar. A const-int reference
 * retains the dimension and generates [zero + 1]. Touch only dimensions newly
 * produced by the converter; unchanged authored XML, folders and IDs stay exact.
 * This is a representation repair, never an equivalence or acceptance verdict.
 */
export function repairGeneratedSingletonArrays({xml,existingXml='',implicitLibraryId='Map',sources=[]}) {
 const root=xmlTree(xml),prior=existingXml?index(xmlTree(existingXml),implicitLibraryId):new Map();
 const current=index(root,implicitLibraryId),plans=[];
 for(const group of groups(root)) {
  const library=owner(group,implicitLibraryId),dimensions=[];
  for(const e of group.children.filter(n=>n.tag==='Element'&&n.attributes.Type==='Variable')) {
   const old=prior.get(JSON.stringify([library,'Variable',e.attributes.Id])),seen=new Set();
   for(const a of arrays(e)) {
    assert(!seen.has(a.attributes.Dim),'ARRAY_BOUND_DUPLICATE_DIMENSION');seen.add(a.attributes.Dim);
    if(a.attributes.Value!=='0'||a.attributes.Type!==undefined||a.attributes.Id!==undefined)continue;
    const previous=arrays(old).find(n=>n.attributes.Dim===a.attributes.Dim);
    if(previous&&JSON.stringify(previous.attributes)===JSON.stringify(a.attributes))continue;
    assert(a.selfClosing&&/^\d+$/u.test(a.attributes.Dim),'ARRAY_BOUND_UNSUPPORTED_DIMENSION');
    dimensions.push({node:a,variableId:e.attributes.Id,dimension:Number(a.attributes.Dim)});
   }
  }
  if(dimensions.length)plans.push({group,library,dimensions});
 }
 if(!plans.length)return {xml,proof:{kind:'NATIVE_SINGLETON_ARRAY_BOUNDS',changed:false,records:[],newConstants:[],wholeProgramEquivalent:false}};
 const forbidden=sourceNames(sources),usedIds=new Set([...current.values()].map(e=>e.attributes.Id)),edits=[],records=[],constants=[];
 for(const {group,library,dimensions}of plans) {
  const libraryScoped=group.tag==='Library'||child(group,'Standard')!==undefined;
  const elements=group.children.filter(n=>n.tag==='Element'),by=new Map(elements.map(e=>[JSON.stringify([e.attributes.Type,e.attributes.Id]),e]));
  const localIds=new Set(elements.filter(e=>['Structure','Trigger','FunctionDef'].includes(e.attributes.Type)).flatMap(e=>e.children.filter(n=>n.tag==='Variable').map(n=>n.attributes.Id)));
  const reachable=new Set(),seen=new Set(),pending=[...(child(group,'Root')?.children??[])];
  while(pending.length) {
   const ref=pending.pop();if(ref.tag!=='Item'||ref.attributes.Library&&ref.attributes.Library!==library)continue;
   const key=JSON.stringify([ref.attributes.Type,ref.attributes.Id]);if(seen.has(key))continue;seen.add(key);
   const target=by.get(key);if(!target||child(target,'Disabled'))continue;
   if(target.attributes.Type==='Variable')reachable.add(target.attributes.Id);
   if(target.attributes.Type==='Category')pending.push(...target.children);
  }
  const eligible=e=>e.attributes.Type==='Variable'&&reachable.has(e.attributes.Id)&&!localIds.has(e.attributes.Id)&&!arrays(e).length&&child(child(e,'VariableType'),'Type')?.attributes.Value==='int'&&child(child(e,'VariableType'),'Constant')!==undefined;
  let constant=elements.find(e=>{
   if(!eligible(e))return false;
   const ref=child(e,'Value');if(!ref||ref.attributes.Library&&ref.attributes.Library!==library)return false;
   const p=by.get(JSON.stringify(['Param',ref.attributes.Id]));
   return p&&p.children.length===2&&child(p,'ValueType')?.attributes.Type==='int'&&value(xml,child(p,'Value'))==='0';
  });
  let id=constant?.attributes.Id;
  if(!constant) {
   const allocate=role=>{for(let salt=0;;salt++){const next=sha(xml+'\0'+library+'\0'+role+'\0'+salt).slice(0,8).toUpperCase();if(!usedIds.has(next)){usedIds.add(next);return next;}}};
   id=allocate('singleton-upper');const param=allocate('singleton-upper-value');let identifier='RecoveredArrayUpperZero';
   for(let suffix=0;;suffix++) {
    identifier='RecoveredArrayUpperZero'+(suffix||'');
    const generated=(libraryScoped?'lib'+library+'_gv_':'gv_')+identifier;
    if(!forbidden.has(identifier)&&!forbidden.has(generated)&&!elements.some(e=>value(xml,child(e,'Identifier'))===identifier))break;
   }
   forbidden.add(identifier);forbidden.add((libraryScoped?'lib'+library+'_gv_':'gv_')+identifier);
   const ref=`Type="Variable" Id="${id}"`,rootNode=child(group,'Root');assert(rootNode,'ARRAY_BOUND_ROOT_MISSING');
   const item=`<Item ${ref}/>`;
   if(rootNode.selfClosing)edits.push({start:rootNode.start,end:rootNode.end,text:'<Root>'+item+'</Root>'});
   else edits.push({start:rootNode.closeStart,end:rootNode.closeStart,text:item});
   const added=`<Element ${ref}><Identifier>${identifier}</Identifier><VariableType><Type Value="int"/><Constant/></VariableType><Value Type="Param" Id="${param}"/></Element>`+
    `<Element Type="Param" Id="${param}"><Value>0</Value><ValueType Type="int"/></Element>`;
   assert(!group.selfClosing,'ARRAY_BOUND_GROUP_EMPTY');edits.push({start:group.closeStart,end:group.closeStart,text:added});
   constants.push({library,libraryScoped,id,paramId:param,identifier,value:0,type:'int',newRuntimeFunction:false});
  }
  for(const d of dimensions) {
   const reference=`<ArraySize Dim="${d.dimension}" Type="Variable" Id="${id}"/>`;
   edits.push({start:d.node.start,end:d.node.end,text:reference});records.push({library,variableId:d.variableId,dimension:d.dimension,constantId:id,originalLength:1});
  }
 }
 let result='',cursor=0;const inverse=[];
 for(const e of edits.toSorted((a,b)=>a.start-b.start||a.end-b.end)) {
  assert(e.start>=cursor,'ARRAY_BOUND_OVERLAPPING_EDITS');result+=xml.slice(cursor,e.start);inverse.push({at:result.length,size:e.text.length,original:xml.slice(e.start,e.end)});result+=e.text;cursor=e.end;
 }
 result+=xml.slice(cursor);xmlTree(result);
 let restored=result;for(const e of inverse.toReversed())restored=restored.slice(0,e.at)+e.original+restored.slice(e.at+e.size);assert.equal(restored,xml,'ARRAY_BOUND_INVERSE');
 return {xml:result,proof:{kind:'NATIVE_SINGLETON_ARRAY_BOUNDS',changed:true,beforeSha256:sha(xml),afterSha256:sha(result),records,newConstants:constants,
  allOtherBytesExactByInverse:true,newNative:0,newCustomScript:0,newRuntimeFunctions:0,wholeProgramEquivalent:false}};
}
