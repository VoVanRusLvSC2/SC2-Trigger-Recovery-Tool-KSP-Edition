import {AsyncLocalStorage} from 'node:async_hooks';
import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const scope=new AsyncLocalStorage(),printer=new Printer();

// A live semantic program owns the lookup. No second parser, name-based
// declaration search, result cache or cross-conversion state is introduced.
export function withBoundSourceCallReturns(program,operation){
 return scope.run(program,operation);
}
export function boundSourceCallReturn(node){
 const program=scope.getStore();
 if(!program||node?.kind!==K.CallExpression)return undefined;
 let callee=node.expression;while(callee?.kind===K.ParenthesizedExpression)callee=callee.expression;
 if(callee?.kind!==K.Identifier)return undefined;
 if(program.getBinding(callee).status!=='BOUND')return undefined;
 const declaration=program.declarationAt(callee);
 if(declaration?.kind!==K.FunctionDeclaration||declaration.parameters.length!==node.arguments.length)return undefined;
 let source=declaration;while(source.parent)source=source.parent;
 const owner=program.verifiedInputIdentity(source.fileName);
 if(!owner?.contentSha256)return undefined;
 return {galaxyType:printer.printNode(declaration.type),sourceFile:source.fileName,
  contentSha256:owner.contentSha256,declarationStart:declaration.pos,declarationEnd:declaration.end};
}

// Rich GUI domains/presets remain authoritative. Only an absent or unresolved
// relational result is refined from the source signature of this exact call.
export function refineBoundCallReturn(node,current,convert){
 if(current&&!['any','sameas','sameasparent','return'].includes(current.type))return current;
 const source=boundSourceCallReturn(node);
 return source?convert(source.galaxyType):current;
}
