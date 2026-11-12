import {resolveAuthoredSourceValue,resolveAuthoredSourceAggregate} from "./authored-storage-interfaces.mjs";
import {resolvePreservedSourceValue as includedValue,resolvePreservedSourceAggregate as includedAggregate} from "./preserved-source-aggregate-interfaces.dependency-functions.mjs";

// Both ownership paths retain their original checks. An authored-section
// binding needs its live AST proof; an include binding keeps its closed file.
export const resolvePreservedSourceValue=binding=>resolveAuthoredSourceValue(binding)??includedValue(binding);
export const resolvePreservedSourceAggregate=binding=>resolveAuthoredSourceAggregate(binding)??includedAggregate(binding);
