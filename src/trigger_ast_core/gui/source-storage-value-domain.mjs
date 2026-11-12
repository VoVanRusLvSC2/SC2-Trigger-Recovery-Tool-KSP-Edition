import {selectSourceValueType} from './concrete-source-value-type.mjs';

// The Galaxy carrier alone cannot distinguish integer GUI domains such as a
// Dialog Item. Keep the expected concrete GUI domain when its real ABI agrees.
export function sourceStorageGuiType(source,hint,ctx,tools){
 const own={id:ctx.libId,elements:ctx.elements,elementsByType:{}},libraries=new Map(ctx.dependencyLibraries??[]);
 if(ctx.nativeLibrary)libraries.set(ctx.nativeLibrary.id,ctx.nativeLibrary);
 libraries.set(ctx.libId,own);
 return selectSourceValueType(source,hint,{
  fromGalaxy:type=>tools.triggerType(type,ctx),
  carrier:type=>{try{return tools.mapType(type,own,ctx.nativeLibrary,libraries);}catch{return undefined;}}
 });
}
