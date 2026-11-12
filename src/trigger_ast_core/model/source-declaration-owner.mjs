/** Resolve declaration ownership through actual lexical/nominal parents.
 * A field or local is owned by its original top-level source declaration;
 * it must not be mistaken for a foreign GUI declaration solely because it is
 * referenced from another authored section. No lookup by spelling is used. */
export function boundSourceDeclarationOwner(program,declaration,ownerOf){
 const initial=program.location(declaration);if(!initial)return;
 let node=declaration;
 for(let depth=0;node&&depth<128;depth++,node=node.parent){
  const where=program.location(node);if(!where||where.sourceFile!==initial.sourceFile||where.contentSha256!==initial.contentSha256)return;
  const owner=ownerOf(node,where.sourceFile);if(owner!==undefined)return owner;
 }
}
