import {matchesConstLoopCapture as matchesOriginalCapture} from "./compiler-constant-capture.mjs";

// A const stores a value once; its initializer is not necessarily invariant.
// Only a proven context-independent initializer may move into a loop template.
export function matchesConstLoopCapture(input) {
 return input.initializerStable === true && matchesOriginalCapture(input);
}
