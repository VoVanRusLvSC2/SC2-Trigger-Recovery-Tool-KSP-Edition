import {createSourceNativeApiFacts} from "./source-native-api-facts.identity-only.mjs";
import {bindNativeLibraryDeclaration} from "../shared-native-formal-abi/native-library-declaration-binding.mjs";
import {SyntaxKind as NativeBindingK} from "../exact-function-signatures/index-alternate-3.js";
import { GalaxyProgramContext, declaredCarrier } from "../exact-function-signatures/galaxy-program-context.js";
import { FunctionCandidateIndex } from "./function-candidates-alternate.mjs";
import { RecoveryPlan } from "../../sdk/array-values/modules/triggers/services/galaxy-conversion/recovery-plan.js";
const registry = new WeakMap();
export const recoverySessionFor = (elements) => registry.get(elements);
/** Registered by element-store identity, released in the synchronous G2T finally.
 * It cannot leak candidate/template state to another map or a new process.
 */
export class RecoverySession {
    program;
    candidates;
    plan;
    stores = new Set();
    frames = [];
    constructor(program, libraries, plan = new RecoveryPlan()) { this.program = program; this.candidates = new FunctionCandidateIndex(libraries); this.plan = plan; this.sourceNativeApis = createSourceNativeApiFacts(program, this.candidates.libraries); }
    attach(elements) { if (registry.has(elements))
        throw new Error('Element store already belongs to a recovery session'); registry.set(elements, this); this.stores.add(elements); }
    withNode(node, ctx, run, expectedGuiType) { this.frames.push({ node, ctx, expectedGuiType }); try {
        return run();
    }
    finally {
        this.frames.pop();
    } }
    recordCodeField(data) { const frame = this.frames.at(-1); if (data.scriptCode === undefined && data.expressionCode === undefined)
        return; const node = frame?.node, ctx = frame?.ctx ?? {}; this.record(node, ctx, 'CONVERTER_OPAQUE_FALLBACK', 'raw-code-field; safe editable representation not yet proved', [], data.id ? { type: data.type, id: data.id, library: data.library } : undefined); }
    resolveCall(call, ctx) {
        const name = call.expression?.name;
        if (!name)
            return { status: 'UNRESOLVED', candidateKeys: [], rejected: [] };
        const declaration = this.program.declarationAt(call.expression);
        const query = { name, ancestor: ctx.structuredAncestorDefinitions ?? [], ...(declaration?.parameters ? { declaration: { returnType: declaredCarrier(declaration.type), parameters: declaration.parameters.map((p) => declaredCarrier(p.type)) } } : {}) };
        const rawResolution = this.candidates.resolve(query);
        const nativeDeclaration = !!this.sourceNativeApis.declaration(call, ctx.nativeLibrary?.id);
        const resolution = nativeDeclaration ? bindNativeLibraryDeclaration(this.candidates, query, rawResolution, ctx.nativeLibrary?.id) : rawResolution;
        if (resolution.status === 'AMBIGUOUS')
            this.record(call, ctx, 'UNRESOLVED_OR_AMBIGUOUS', 'ambiguous-function-candidates', resolution.candidateKeys);
        return resolution;
    }
    record(node, ctx, classification, reason, candidates = [], generatedRef) {
        const location = this.program.location(node);
        let pos = location;
        if (!pos && ctx.structuredFunctionStatements?.length) {
            const start = this.program.location(ctx.structuredFunctionStatements[0]);
            const end = this.program.location(ctx.structuredFunctionStatements.at(-1));
            if (start && end)
                pos = { ...start, end: end.end };
        }
        const binding = location ? this.program.getBinding(node?.kind === 121 ? node.expression : node) : undefined;
        const libraryId = generatedRef?.library ?? candidates[0]?.split(':')[0];
        const source = this.program.snapshot?.dependencies.find(d => d.libraryId === libraryId);
        this.plan.record({ owner: pos?.owner ?? 'UNKNOWN_OWNER', sourceFile: pos?.sourceFile ?? 'UNKNOWN_SOURCE', start: Math.max(0, pos?.start ?? 0), end: Math.max(0, pos?.end ?? 0), expectedGuiType: this.frames.at(-1)?.expectedGuiType, libraryId, librarySha256: source?.contentSha256, candidates, reason: (location ? reason : reason + ';SOURCE_SPAN_INCOMPLETE') + (libraryId && !source ? ';LIBRARY_IDENTITY_INCOMPLETE' : ''), classification, bindings: binding?.declarations ?? [], generatedRef, recoverable: candidates.length > 0 });
    }
    report() { return { program: this.program.report(), recovery: this.plan.report(), sourceNativeApiFacts: this.sourceNativeApis.report() }; }
    dispose() { this.sourceNativeApis.dispose(); for (const elements of this.stores)
        registry.delete(elements); this.stores.clear(); this.frames = []; }
}
