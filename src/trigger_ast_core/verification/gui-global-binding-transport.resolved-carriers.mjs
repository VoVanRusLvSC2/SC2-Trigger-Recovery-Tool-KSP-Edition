import {createGuiGlobalBindingTransport} from './gui-global-binding-transport.factory.mjs';
import {qualifyGuiStorageCarrierShape} from './gui-storage-carrier-shape.mjs';
export const transportGuiGlobalBindings=createGuiGlobalBindingTransport({qualifyStorageShape:qualifyGuiStorageCarrierShape});
