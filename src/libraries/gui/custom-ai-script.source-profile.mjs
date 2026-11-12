export {generateCustomAiMapScriptSection,customAiScriptName} from "../../ast/custom-ai-script.mjs";
import {generateCustomAiScript as current} from "../../ast/custom-ai-script.mjs";
import {generateCustomAiScript as trainedSend} from "./custom-ai-script.empty-trained-send.mjs";
import {sourceCustomAiProfile} from "./source-custom-ai-profile.mjs";
// Existing native metadata stays unchanged. The source archive supplies the
// otherwise ambiguous compiler behavior; the exact reverse codec still checks
// its whole regenerated file and complete root dispatch, byte for byte.
export function generateCustomAiScript(definition,names){
 return(sourceCustomAiProfile(definition.id)==='EMPTY_TRAINED_WAVE_SEND'?trainedSend:current)(definition,names);
}
