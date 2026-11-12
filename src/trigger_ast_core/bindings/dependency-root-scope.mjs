/** Map is a document-local scope, not a published library. An empty implicit
 * dependency root contributes no ABI symbols; explicit libraries remain intact.
 * A populated root is never silently discarded or merged with another owner. */
export function isEmptyDependencyRoot(owner,library){
 return owner==='Map'&&library.id==='Map'&&library.implicit===true
  &&Object.keys(library.elements??{}).length===0
  &&Object.values(library.elementsByType??{}).every(t=>Object.keys(t).length===0)
  &&(library.items?.length??0)===0&&(library.rootRefs?.length??0)===0;
}
