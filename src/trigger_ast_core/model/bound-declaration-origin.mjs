import {createHash} from 'node:crypto';
import {Printer,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer(),sha=text=>createHash('sha256').update(text).digest('hex');

// Provenance facts for an already bound declaration, not an ABI authorization.
// Full source SHA plus declaration/owner ranges retain nominal field identity.
export function boundDeclarationOrigin(program,declaration){
 const location=program.location(declaration);if(!location)return;
 const input=program.verifiedInputIdentity(location.sourceFile),source=program.inputs.get(location.sourceFile);
 if(!input?.contentSha256||input.contentSha256!==location.contentSha256||!source)return;
 const owner=declaration.parent,ownerLocation=owner&&program.location(owner);
 return {sourceDeclaration:{...location,kind:K[declaration.kind],name:declaration.name?.name,
  declarationSha256:sha(source.text.slice(declaration.pos,declaration.end)),
  ...(declaration.type?{type:printer.printNode(declaration.type)}:{}),
  ...(ownerLocation?{scopeOwner:{...ownerLocation,kind:K[owner.kind],name:owner.name?.name}}:{}),
  guiBindingAuthorized:false}};
}
