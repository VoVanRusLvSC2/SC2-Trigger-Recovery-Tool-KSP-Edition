import assert from 'node:assert/strict';

// Same observable shape as recursive Object.keys/map cloning, without using
// the JavaScript call stack or allocating a second complete copy of each AST.
export function assertExactAstShape(actual,expected,{ignoredFields=new Set(),label='AST_SHAPE_CHANGED',maxPairs=10000000}={}){
 const stack=[{a:actual,b:expected,path:undefined}];let examined=0;
 const fail=(path,reason)=>{
  const keys=[];for(let p=path;p&&keys.length<64;p=p.parent)keys.push(p.key);
  assert.fail(label+': '+reason+' at '+keys.reverse().join('.'));
 };
 while(stack.length){
  assert(++examined<=maxPairs,label+': traversal bound');const {a,b,path}=stack.pop();
  if(a===null||b===null||typeof a!=='object'||typeof b!=='object'){if(!Object.is(a,b))fail(path,'primitive');continue;}
  const array=Array.isArray(a);if(array!==Array.isArray(b))fail(path,'array/object');
  if(array){
   if(a.length!==b.length)fail(path,'array length');
   for(let i=a.length-1;i>=0;i--){if((i in a)!==(i in b))fail(path,'array hole');if(i in a)stack.push({a:a[i],b:b[i],path:{parent:path,key:i}});}
  }else{
   const left=Object.keys(a).filter(k=>!ignoredFields.has(k)).sort(),right=Object.keys(b).filter(k=>!ignoredFields.has(k)).sort();
   if(left.length!==right.length||left.some((key,i)=>key!==right[i]))fail(path,'object keys');
   for(let i=left.length-1;i>=0;i--){const key=left[i];stack.push({a:a[key],b:b[key],path:{parent:path,key}});}
  }
 }
 return {exact:true,examinedPairs:examined,iterative:true};
}
