import {qualifyGuiIntrinsicStorageShape} from './gui-intrinsic-storage-shape.mjs';
import {mapParameterTypeToGalaxy} from '../../map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/services/galaxy-conversion/internal/ttg-core.js';
import {nativeGuiCarrierFor} from '../bindings/native-gui-source-interfaces.carrier-evidence.mjs';
// GUI domains such as dialog/control/gamelink have an intrinsic Galaxy carrier.
// Keep the actual qualified GUI type as evidence; never edit its metadata or
// treat an unresolved nominal/reference/any domain as an intrinsic type.
export function qualifyGuiStorageCarrierShape(declaration,variable,{libraries,owner,catalog,carrierModel,sourceDocuments}){
 const type=variable.variableType;if(!type?.type||/^(?:any|sameas|struct)/iu.test(type.type)||variable.isReference)return;
 if(type.typeElement){if(type.type!=='preset'||type.typeElement.type!=='Preset')return;
  const preset=catalog.resolve(type.typeElement,owner,'Preset');if(!preset?.baseType)return;
 }
 const carrier=carrierModel?nativeGuiCarrierFor(carrierModel,type,owner,sourceDocuments):mapParameterTypeToGalaxy(type,libraries.get(owner),undefined,libraries);
 const result=qualifyGuiIntrinsicStorageShape(declaration,{...variable,variableType:{type:carrier}});
 if(!result)return;
 return{...result,qualifiedGuiType:structuredClone(type),resolvedGalaxyCarrier:carrier,
  guiMetadataChanged:false,actualExportCarrierAndModifiersStillRequired:true,storageIdentityIsNotGuiDomainEquivalence:true};
}
