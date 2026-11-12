import {resolveBoundTypeAlias} from '../types/bound-type-alias.mjs';
import {Printer,SyntaxKind as K} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
const printer=new Printer();
// Access-axis order follows the shared bound AST, not the printed GUI bounds.
export function boundStorageShape(program,type){
 const dimensions=[];let shape=resolveBoundTypeAlias(program,type);
 while(shape.status==='RESOLVED'&&shape.node.kind===K.ArrayType){
  dimensions.push(printer.printNode(shape.node.size));shape=resolveBoundTypeAlias(program,shape.node.elementType);
 }
 if(shape.status!=='RESOLVED')return shape;
 return {...shape,elementType:printer.printNode(shape.node),dimensions,rank:dimensions.length};
}
