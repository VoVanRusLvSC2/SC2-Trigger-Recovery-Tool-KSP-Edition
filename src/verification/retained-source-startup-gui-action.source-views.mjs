import assert from 'node:assert/strict';
import {partitionDeclarationViews} from "../model/source-ownership.mjs";
import {indexRetainedSourceStartupGuiActions as index} from "./retained-source-startup-gui-action.mjs";
export {verifyRetainedSourceStartupGuiAction} from "./retained-source-startup-gui-action.mjs";

export function indexRetainedSourceStartupGuiActions(input){
 const views=partitionDeclarationViews(input.additionalScripts??[],input.galaxyDeclarations??[]);
 assert.equal(views.conflicts.length,0,'INITIALIZER_SOURCE_DECLARATION_VIEW_CONFLICT');
 return index({...input,galaxyDeclarations:views.external});
}
