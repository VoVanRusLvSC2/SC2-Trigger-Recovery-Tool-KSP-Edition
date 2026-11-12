import assert from 'node:assert/strict';
import {nativeGuiInterfacesFor} from './native-gui-source-interfaces.r1748.mjs';
import {Parser,bindSourceFile,forEachChild,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
/** Private type/index nodes. Not documents, input identities, includes or code.
 * A derived ABI deliberately has no native modifier and no source location. */
export function bindNativeGuiInterfaceSymbols(program,inputs,model,host){
 const records=nativeGuiInterfacesFor(model,inputs),byNode=new WeakMap();
 const source=new Parser().parseFile('@catalog-interface','');
 const type=t=>new Parser().parseFile('@catalog-type',t+' catalogValue;').statements[0].type;
 source.statements=records.map((record,i)=>{assert(!program.globals.has(record.name)&&!program.conflicts.has(record.name),'NATIVE_GUI_INTERFACE_SHADOWS_REAL_DECLARATION');const node={kind:K.FunctionDeclaration,pos:i,end:i+1,name:{kind:K.Identifier,pos:i,end:i+1,name:record.name},type:type(record.signature.returnType),parameters:record.signature.parameters.map((t,j)=>({kind:K.ParameterDeclaration,pos:i,end:i+1,name:{kind:K.Identifier,pos:i,end:i+1,name:'arg'+j},type:type(t)})),modifiers:[]};const parent=(n,p)=>{n.parent=p;byNode.set(n,record);forEachChild(n,c=>parent(c,n));};parent(node,source);return node;});
 bindSourceFile(source,host);
 for(const [name,symbol]of source.symbol.members)program.globals.set(name,symbol);
 return {byNode,count:records.length};
}
