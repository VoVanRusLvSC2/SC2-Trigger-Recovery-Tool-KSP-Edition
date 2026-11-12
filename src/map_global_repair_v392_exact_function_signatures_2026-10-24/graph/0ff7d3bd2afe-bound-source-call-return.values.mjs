import {AsyncLocalStorage} from 'node:async_hooks';
import {SyntaxKind as K,Printer} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v392_exact_function_signatures_2026-10-24/graph/e5745ffa8279-index.js';
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

// A complete scalar read from an actual global declaration. Whole arrays are
// never represented as a scalar result of an invented function.
export function boundSourceValueRead(node){
 const program=scope.getStore();if(!program)return undefined;
 let base=node;const indices=[];
 while(base?.kind===K.ParenthesizedExpression)base=base.expression;
 while(base?.kind===K.ElementAccessExpression){indices.unshift(base.argumentExpression);base=base.expression;while(base?.kind===K.ParenthesizedExpression)base=base.expression;}
 if(base?.kind!==K.Identifier||program.getBinding(base).status!=='BOUND')return undefined;
 const declaration=program.declarationAt(base);if(declaration?.kind!==K.VariableDeclaration)return undefined;
 let source=declaration;while(source.parent){source=source.parent;if(source.kind===K.FunctionDeclaration)return undefined;}
 if(declaration.modifiers?.some(m=>m.kind===K.StaticKeyword))return undefined;
 const owner=program.verifiedInputIdentity(source.fileName);if(!owner?.contentSha256)return undefined;
 let type=declaration.type;const dimensions=[];
 while(type?.kind===K.ArrayType){dimensions.push(printer.printNode(type.size));type=type.elementType;}
 if(indices.length!==dimensions.length)return undefined;
 for(const index of indices){const location=program.location(index);if(!location?.contentSha256||program.getBinding(index).carrier!=='int')return undefined;}
 return {name:base.name,sourceFile:source.fileName,contentSha256:owner.contentSha256,
  elementType:printer.printNode(type),rank:dimensions.length,dimensions,indices};
}
