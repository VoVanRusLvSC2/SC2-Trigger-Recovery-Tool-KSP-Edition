// An explicit GUI initial-value reference must not lose its assignment merely
// because the expression equals a language default. This is not a proof that
// omitted writes are equivalent and does not alter comparison rules.
export function shouldEmitExplicitStructureInitializer(member,value){
 return !!member?.initialValue && value!==undefined && value!==null;
}
