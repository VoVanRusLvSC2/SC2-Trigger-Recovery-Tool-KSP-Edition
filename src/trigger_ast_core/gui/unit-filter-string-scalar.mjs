// UnitFilterStr is a constructor for an existing editor value type, not a
// user-defined GUI function. Admit only literal tokens proved by mounted engine
// declarations; an authored same-name implementation always takes precedence.
export function literalUnitFilterStringScalar(call, context) {
 const name=call?.expression?.name;
 if(name!=='UnitFilterStr'||call.arguments?.length!==1||!context.constants)return;
 const argument=call.arguments[0];
 if(argument?.kind!==115||typeof argument.value!=='string')return;
 const owned=context.funcNameToFuncDef?.get(name);
 if(owned&&(owned.library??context.libId)===context.libId&&
    !owned.flags?.includes('Native')&&!owned.nativeDeclarationOnly&&!owned.unresolvedGuiBinding)return;
 const halves=argument.value.split(';');if(halves.length!==2)return;
 const requested=new Set();
 for(const half of halves){
  if(half==='-')continue;
  if(!half)return;
  for(const token of half.split(',')){
   if(!/^[A-Za-z][A-Za-z0-9]*$/u.test(token))return;
   requested.add(token);
  }
 }
 const found=new Map();
 for(const declaration of context.constants.declarations?.keys()??[]){
  if(!/^c_targetFilter[A-Za-z][A-Za-z0-9]*$/u.test(declaration))continue;
  const token=context.constants.stringValue(declaration+'Name');
  if(!requested.has(token))continue;
  const bit=context.constants.evaluate({kind:113,name:declaration});
  if(!Number.isInteger(bit)||bit<0||bit>=64)return;
  if(found.has(token)&&found.get(token)!==bit)return;
  found.set(token,bit);
 }
 if([...requested].some(token=>!found.has(token)))return;
 return argument.value;
}
