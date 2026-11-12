import {createPrivateRootResourceAlpha} from "./private-root-resource-alpha.factory.mjs";
import {inspectNonCodeTexturePayload} from "../../verification/non-code-texture-payload.bounded-ranges.mjs";
import {inspectNonCodeModelPayload} from "../../verification/non-code-model-payload.bounded-ranges.mjs";
import {inspectNonCodeTargaPayload} from "../../verification/non-code-targa-payload.bounded-ranges.mjs";
const implementation=createPrivateRootResourceAlpha({classifyResource:(name,bytes)=>inspectNonCodeTexturePayload(name,bytes)??inspectNonCodeModelPayload(name,bytes)??inspectNonCodeTargaPayload(name,bytes)});
export const {readPrivateRootArchiveScope,projectPrivateRootCallbackAlpha,qualifyArchiveBoundRootRoles,verifyProtectedRootSourcesUnchanged}=implementation;
