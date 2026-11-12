import {SyntaxKind as K,Printer} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/galaxy/language-core/index.js';
import {isIntrinsicScalarType} from '../model/passive-function-entry-storage.mjs';
const printer=new Printer(),decimal=/^(0|[1-9][0-9]*)$/u;

// GUI dimensions store an inclusive upper bound; Galaxy stores a count.
// Only independently exact fixed intrinsic shapes qualify here. Unknown
// nominal/reference storage and symbolic GUI dimensions need another proof.
export function qualifyGuiIntrinsicStorageShape(declaration,variable){
  const extents=[];let type=declaration.type;
  while(type?.kind===K.ArrayType){
    if(type.size?.kind!==K.NumericLiteral||!decimal.test(type.size.text))return;
    const size=BigInt(type.size.text);if(size<1n||size>2147483647n)return;
    // The parser nests later suffixes outside earlier suffixes.
    extents.unshift(size);type=type.elementType;
  }
  if(!isIntrinsicScalarType(type)||variable.variableType?.typeElement||variable.isReference||
    variable.variableType?.type!==printer.printNode(type))return;
  const dims=[...(variable.arraySizes??[])].sort((a,b)=>a.dim-b.dim);
  if(!!variable.isArray!==(extents.length>0)||dims.length!==extents.length)return;
  for(let i=0;i<dims.length;i++){
    const dim=dims[i];if(dim.dim!==i||dim.variable||typeof dim.value!=='string'||!decimal.test(dim.value)||
      BigInt(dim.value)+1n!==extents[i])return;
  }
  return {kind:'EXACT_GUI_INTRINSIC_STORAGE_SHAPE',rank:extents.length,elementType:printer.printNode(type),
    extents:extents.map(String),guiInclusiveUpperBounds:dims.map(d=>d.value),allAxesAndCarriersExact:true};
}
