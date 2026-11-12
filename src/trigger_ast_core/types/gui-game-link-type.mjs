// GUI Game Link domains share the Galaxy string carrier but retain a catalog
// category. Never infer Unit from a Weapon/Actor/string-shaped argument.
export function guiGameLinkTypeIdentity(type){
 return type?.type==='gamelink'&&!type.typeElement&&typeof type.gameType==='string'&&/^[A-Za-z_]\w*$/u.test(type.gameType)?'gui:gamelink:'+type.gameType:undefined;
}
export function guiGameLinkLiteralType(param){
 const type=guiGameLinkTypeIdentity(param.valueType);
 return type&&typeof param.value==='string'&&param.valueId===undefined&&param.valueTypeInfo===undefined&&!param.arrayIndexes?.length&&!['variable','paramRef','functionCall','preset','valueElement','expressionText','expressionCode','scriptCode','structMember'].some(k=>param[k]!==undefined)?type:undefined;
}
export function declaredGuiGameLinkType(param,actualType){
 const actual=guiGameLinkTypeIdentity(actualType);if(!actual)return;
 return !param.valueType||guiGameLinkTypeIdentity(param.valueType)===actual?actual:undefined;
}