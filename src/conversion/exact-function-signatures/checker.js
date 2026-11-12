import * as lsp from "../../vendor/vscode-languageserver-types/lib/esm/main.js";
import { URI } from "../../vendor/vscode-uri/lib/esm/index.mjs";
import * as gt from "../../sdk/array-values/modules/galaxy/language-core/types.js";
import { isComplexTypeKind, isDeclarationKind, isPartOfExpression, isRightSideOfPropertyAccess, findAncestor, createDiagnosticForNode, isAssignmentOperator, isComparisonOperator, isReferenceKeywordKind, findAncestorByKind, getLineAndCharacterOfPosition, } from "../../sdk/array-values/modules/galaxy/language-core/utils.js";
import { tokenToString } from "../../sdk/array-values/modules/galaxy/language-core/scanner.js";
import { declareSymbol, unbindSourceFile } from "./binder-alternate-4.js";
let nextSymbolId = 1;
let nextNodeId = 1;
// The exact-pin checker only needs join/basename. Keep those operations portable so
// the semantic core does not pull Node's path module into browser-worker variants.
function joinPath(...parts) {
    return parts.filter(part => part.length > 0).join('/').replace(/[\\/]+/g, '/');
}
function basenamePath(value) {
    const portable = value.replaceAll('\\', '/');
    return portable.slice(portable.lastIndexOf('/') + 1);
}
export function getNodeId(node) {
    if (!node.id) {
        node.id = nextNodeId;
        nextNodeId++;
    }
    return node.id;
}
export function getSymbolId(symbol) {
    if (!symbol.id) {
        symbol.id = nextSymbolId;
        nextSymbolId++;
    }
    return symbol.id;
}
var CheckMode;
(function (CheckMode) {
    CheckMode[CheckMode["Normal"] = 0] = "Normal";
    CheckMode[CheckMode["SkipContextSensitive"] = 1] = "SkipContextSensitive";
})(CheckMode || (CheckMode = {}));
export class AbstractType {
    flags;
    symbol;
    isValidBinaryOperation(_operation, _rightType) {
        return false;
    }
    isValidPrefixOperation(_operation) {
        return false;
    }
    isValidPostfixOperation(_operation) {
        return false;
    }
    getName() {
        return this.constructor.name;
    }
}
export class UnknownType extends AbstractType {
    flags = 1 /* gt.TypeFlags.Unknown */;
    isAssignableTo(_target) {
        return false;
    }
    isComparableTo(_target) {
        return false;
    }
    isBoolExpression(_negation) {
        return false;
    }
}
export class IntrinsicType extends AbstractType {
    name;
    constructor(flags, name) {
        super();
        this.flags = flags;
        this.name = name;
    }
    isAssignableTo(target) {
        if (this === target)
            return true;
        if (target instanceof IntrinsicType) {
            if (target.flags & 32 /* gt.TypeFlags.Fixed */ &&
                (this.flags & 4 /* gt.TypeFlags.Integer */ || this.flags & 8 /* gt.TypeFlags.Byte */))
                return true;
            if (target.flags & 4 /* gt.TypeFlags.Integer */ && this.flags & 8 /* gt.TypeFlags.Byte */)
                return true;
            if (target.flags & 8 /* gt.TypeFlags.Byte */ && this.flags & 4 /* gt.TypeFlags.Integer */)
                return true;
            if (this.flags & 64 /* gt.TypeFlags.Boolean */ && target.flags & 64 /* gt.TypeFlags.Boolean */)
                return true;
        }
        else if (target instanceof ComplexType) {
            if (this.flags & 2 /* gt.TypeFlags.String */ && target.kind === 87 /* gt.SyntaxKind.HandleKeyword */)
                return true;
        }
        if (this.flags & 4096 /* gt.TypeFlags.Null */ && target.flags & 128 /* gt.TypeFlags.Nullable */)
            return true;
        return false;
    }
    isComparableTo(target) {
        if (this === target)
            return true;
        // A comparison is checked right against left, so a literal on the left is this
        // type's target: `"Marine" == gv_name[1]` and `(28.5 * 60.0) < Time()` are valid
        // Galaxy, and the literal is the side that knows which types it compares with.
        if (target instanceof LiteralType)
            return target.isComparableTo(this);
        if (target instanceof IntrinsicType) {
            if ((this.flags & 4 /* gt.TypeFlags.Integer */ ||
                this.flags & 8 /* gt.TypeFlags.Byte */ ||
                this.flags & 32 /* gt.TypeFlags.Fixed */) &&
                (target.flags & 4 /* gt.TypeFlags.Integer */ ||
                    target.flags & 8 /* gt.TypeFlags.Byte */ ||
                    target.flags & 32 /* gt.TypeFlags.Fixed */)) {
                return true;
            }
            if (this.flags & 64 /* gt.TypeFlags.Boolean */ && target.flags & 64 /* gt.TypeFlags.Boolean */)
                return true;
        }
        if (this.flags & 4096 /* gt.TypeFlags.Null */ && target.flags & 128 /* gt.TypeFlags.Nullable */)
            return true;
        return false;
    }
    isBoolExpression(_negation) {
        return true;
    }
    isValidBinaryOperation(operation, rightType) {
        if (this === rightType ||
            (rightType instanceof LiteralType && rightType.value.kind === 3 /* gt.SyntaxKind.StringLiteral */)) {
            switch (operation) {
                case 20 /* gt.SyntaxKind.PlusToken */:
                    if (this.flags & 2 /* gt.TypeFlags.String */)
                        return true;
            }
        }
        if (this === rightType ||
            rightType.flags & 44 /* gt.TypeFlags.Numeric */ ||
            (rightType instanceof LiteralType && rightType.value.kind === 2 /* gt.SyntaxKind.NumericLiteral */)) {
            switch (operation) {
                case 20 /* gt.SyntaxKind.PlusToken */:
                case 21 /* gt.SyntaxKind.MinusToken */:
                case 22 /* gt.SyntaxKind.AsteriskToken */:
                case 24 /* gt.SyntaxKind.PercentToken */:
                case 23 /* gt.SyntaxKind.SlashToken */: {
                    if (this.flags & 44 /* gt.TypeFlags.Numeric */) {
                        return true;
                    }
                    break;
                }
                case 29 /* gt.SyntaxKind.AmpersandToken */:
                case 30 /* gt.SyntaxKind.BarToken */:
                case 31 /* gt.SyntaxKind.CaretToken */: {
                    // must be same type (either byte and byte, or int and int)
                    if ((this.flags & 12 /* gt.TypeFlags.IntLike */) === (rightType.flags & 12 /* gt.TypeFlags.IntLike */)) {
                        return true;
                    }
                    break;
                }
                case 27 /* gt.SyntaxKind.LessThanLessThanToken */:
                case 28 /* gt.SyntaxKind.GreaterThanGreaterThanToken */: {
                    // no strict type checking, can implictly cast from byte to int
                    if (this.flags & 12 /* gt.TypeFlags.IntLike */ && rightType.flags & 12 /* gt.TypeFlags.IntLike */) {
                        return true;
                    }
                    break;
                }
                // case gt.SyntaxKind.BarBarToken:
                // case gt.SyntaxKind.AmpersandAmpersandToken:
                // {
                //     return false;
                //     break;
                // }
            }
        }
        return false;
    }
    isValidPrefixOperation(operation) {
        switch (operation) {
            case 20 /* gt.SyntaxKind.PlusToken */:
            case 21 /* gt.SyntaxKind.MinusToken */:
                if (this.flags & 4 /* gt.TypeFlags.Integer */ ||
                    this.flags & 8 /* gt.TypeFlags.Byte */ ||
                    this.flags & 32 /* gt.TypeFlags.Fixed */)
                    return true;
            // falls through
            case 33 /* gt.SyntaxKind.TildeToken */:
                if (this.flags & 4 /* gt.TypeFlags.Integer */ || this.flags & 8 /* gt.TypeFlags.Byte */)
                    return true;
            // falls through
            case 32 /* gt.SyntaxKind.ExclamationToken */:
                if (this.flags & 4 /* gt.TypeFlags.Integer */ ||
                    this.flags & 8 /* gt.TypeFlags.Byte */ ||
                    this.flags & 32 /* gt.TypeFlags.Fixed */ ||
                    this.flags & 64 /* gt.TypeFlags.Boolean */ ||
                    this.flags & 2 /* gt.TypeFlags.String */)
                    return true;
        }
        return false;
    }
    isValidPostfixOperation(_operation) {
        return false;
    }
    getName() {
        return this.name;
    }
}
export class ComplexType extends AbstractType {
    kind;
    constructor(kind) {
        super();
        this.flags = 32768 /* gt.TypeFlags.Complex */;
        this.kind = kind;
        switch (this.kind) {
            case 84 /* gt.SyntaxKind.ColorKeyword */:
                break;
            default:
                this.flags |= 128 /* gt.TypeFlags.Nullable */;
                break;
        }
    }
    get extendsHandle() {
        switch (this.kind) {
            case 77 /* gt.SyntaxKind.AbilcmdKeyword */:
            case 78 /* gt.SyntaxKind.ActorKeyword */:
            case 79 /* gt.SyntaxKind.ActorscopeKeyword */:
            case 80 /* gt.SyntaxKind.AifilterKeyword */:
            case 81 /* gt.SyntaxKind.BankKeyword */:
            case 82 /* gt.SyntaxKind.BitmaskKeyword */:
            case 83 /* gt.SyntaxKind.CamerainfoKeyword */:
            case 85 /* gt.SyntaxKind.DatetimeKeyword */:
            case 88 /* gt.SyntaxKind.GenerichandleKeyword */:
            case 89 /* gt.SyntaxKind.EffecthistoryKeyword */:
            case 90 /* gt.SyntaxKind.MarkerKeyword */:
            case 91 /* gt.SyntaxKind.OrderKeyword */:
            case 92 /* gt.SyntaxKind.PlayergroupKeyword */:
            case 93 /* gt.SyntaxKind.PointKeyword */:
            case 94 /* gt.SyntaxKind.RegionKeyword */:
            case 96 /* gt.SyntaxKind.SoundKeyword */:
            case 97 /* gt.SyntaxKind.SoundlinkKeyword */:
            case 98 /* gt.SyntaxKind.TextKeyword */:
            case 99 /* gt.SyntaxKind.TimerKeyword */:
            case 100 /* gt.SyntaxKind.TransmissionsourceKeyword */:
            case 103 /* gt.SyntaxKind.UnitfilterKeyword */:
            case 104 /* gt.SyntaxKind.UnitgroupKeyword */:
            case 105 /* gt.SyntaxKind.UnitrefKeyword */:
            case 108 /* gt.SyntaxKind.WaveinfoKeyword */:
            case 109 /* gt.SyntaxKind.WavetargetKeyword */:
                return true;
            default:
                return false;
        }
    }
    isAssignableTo(target) {
        if (this === target)
            return true;
        if (target instanceof ComplexType) {
            if (target.kind === 87 /* gt.SyntaxKind.HandleKeyword */)
                return this.extendsHandle;
            if (this.kind === 87 /* gt.SyntaxKind.HandleKeyword */)
                return target.extendsHandle;
        }
        else {
            if (this.kind === 87 /* gt.SyntaxKind.HandleKeyword */ && target.flags & 2 /* gt.TypeFlags.String */)
                return true;
        }
        // if (target.flags && gt.TypeFlags.Null && this.flags & gt.TypeFlags.Nullable) return true;
        return false;
    }
    isComparableTo(target) {
        if (this === target)
            return true;
        if (target.flags & 4096 /* gt.TypeFlags.Null */ && this.flags & 128 /* gt.TypeFlags.Nullable */)
            return true;
        return false;
    }
    isBoolExpression(negation) {
        if (negation) {
            switch (this.kind) {
                case 101 /* gt.SyntaxKind.TriggerKeyword */:
                case 102 /* gt.SyntaxKind.UnitKeyword */:
                    return false;
            }
        }
        return true;
    }
    isValidBinaryOperation(operation, rightType) {
        if (this !== rightType)
            return false;
        switch (operation) {
            case 20 /* gt.SyntaxKind.PlusToken */: {
                switch (this.kind) {
                    case 98 /* gt.SyntaxKind.TextKeyword */:
                    case 93 /* gt.SyntaxKind.PointKeyword */:
                        return true;
                }
                break;
            }
            case 21 /* gt.SyntaxKind.MinusToken */: {
                switch (this.kind) {
                    case 93 /* gt.SyntaxKind.PointKeyword */:
                        return true;
                }
                break;
            }
        }
        return false;
    }
    isValidPrefixOperation(operation) {
        switch (operation) {
            case 32 /* gt.SyntaxKind.ExclamationToken */:
                return this.isBoolExpression(true);
        }
        return false;
    }
    getName() {
        return tokenToString(this.kind);
    }
}
export class LiteralType extends AbstractType {
    value;
    constructor(flags, value) {
        super();
        this.flags = flags;
        this.value = value;
    }
    isAssignableTo(target) {
        if (this === target)
            return true;
        if (this.value.kind === 3 /* gt.SyntaxKind.StringLiteral */ && target.flags & 2 /* gt.TypeFlags.String */) {
            return true;
        }
        if (this.value.kind === 2 /* gt.SyntaxKind.NumericLiteral */ &&
            (target.flags & 8 /* gt.TypeFlags.Byte */ ||
                target.flags & 4 /* gt.TypeFlags.Integer */ ||
                target.flags & 32 /* gt.TypeFlags.Fixed */)) {
            if (this.value.text.indexOf('.') !== -1 && !(target.flags & 32 /* gt.TypeFlags.Fixed */)) {
                return false;
            }
            return true;
        }
        if (this.flags & 4096 /* gt.TypeFlags.Null */ && target.flags & 128 /* gt.TypeFlags.Nullable */) {
            return true;
        }
        return false;
    }
    isComparableTo(target) {
        if (this === target)
            return true;
        if (this.value.kind === 2 /* gt.SyntaxKind.NumericLiteral */ &&
            (target.flags & 8 /* gt.TypeFlags.Byte */ ||
                target.flags & 4 /* gt.TypeFlags.Integer */ ||
                target.flags & 32 /* gt.TypeFlags.Fixed */)) {
            return true;
        }
        if (target instanceof LiteralType && this.value.kind === target.value.kind)
            return true;
        return this.isAssignableTo(target);
    }
    isBoolExpression(_negation) {
        return true;
    }
    isValidBinaryOperation(operation, rightType) {
        let type;
        if (this.value.kind === 2 /* gt.SyntaxKind.NumericLiteral */) {
            if (this.flags & 32 /* gt.TypeFlags.Fixed */) {
                type = fixedType;
            }
            else {
                type = integerType;
            }
        }
        else if (this.value.kind === 3 /* gt.SyntaxKind.StringLiteral */) {
            type = stringType;
        }
        else {
            return false;
        }
        return type.isValidBinaryOperation(operation, rightType);
    }
    isValidPrefixOperation(operation) {
        let type;
        if (this.value.kind === 2 /* gt.SyntaxKind.NumericLiteral */) {
            if (this.flags & 32 /* gt.TypeFlags.Fixed */) {
                type = fixedType;
            }
            else {
                type = integerType;
            }
        }
        else if (this.value.kind === 3 /* gt.SyntaxKind.StringLiteral */) {
            type = stringType;
        }
        else {
            return false;
        }
        return type.isValidPrefixOperation(operation);
    }
    getName() {
        let typeDesc = 'unknown';
        if (this.flags & 2 /* gt.TypeFlags.String */) {
            typeDesc = 'string';
        }
        else if (this.flags & 4 /* gt.TypeFlags.Integer */) {
            typeDesc = 'integer';
        }
        else if (this.flags & 8 /* gt.TypeFlags.Byte */) {
            typeDesc = 'byte';
        }
        else if (this.flags & 32 /* gt.TypeFlags.Fixed */) {
            typeDesc = 'fixed';
        }
        else if (this.flags & 64 /* gt.TypeFlags.Boolean */) {
            typeDesc = 'bool';
        }
        return `${this.value.text} [${typeDesc}]`;
    }
}
export class StructType extends AbstractType {
    constructor(symbol) {
        super();
        this.flags = 8192 /* gt.TypeFlags.Struct */;
        this.symbol = symbol;
    }
    isAssignableTo(target) {
        if (target instanceof ReferenceType &&
            target.kind === 111 /* gt.SyntaxKind.StructrefKeyword */ &&
            this.symbol === target.declaredType.symbol) {
            return true;
        }
        return false;
    }
    isComparableTo(target) {
        if (this === target)
            return true;
        if (target instanceof StructType && target.symbol === this.symbol)
            return true;
        return false;
    }
    isBoolExpression(_negation) {
        return false;
    }
    getName() {
        return this.symbol.escapedName;
    }
}
export class SignatureMeta {
    returnType;
    args;
    constructor(returnType, args) {
        this.returnType = returnType;
        this.args = args;
    }
    match(other) {
        if (this.returnType !== other.returnType)
            return false;
        if (this.args.length !== other.args.length)
            return false;
        for (const [key, arg] of this.args.entries()) {
            if (other.args[key] !== arg)
                return false;
        }
        return true;
    }
    toString() {
        const params = [];
        for (const p of this.args) {
            params.push(p.getName());
        }
        return `${this.returnType.getName()} (${params.join(',')})`;
    }
}
export class FunctionType extends AbstractType {
    signature;
    constructor(symbol, signature) {
        super();
        this.flags = 16384 /* gt.TypeFlags.Function */;
        this.symbol = symbol;
        this.signature = signature;
    }
    isAssignableTo(target) {
        if (target instanceof ReferenceType && target.kind === 112 /* gt.SyntaxKind.FuncrefKeyword */) {
            if (!(target.declaredType.flags & 16384 /* gt.TypeFlags.Function */))
                return false;
            return this.isComparableTo(target.declaredType);
        }
        return false;
    }
    isComparableTo(target) {
        if (target instanceof ReferenceType && target.kind === 112 /* gt.SyntaxKind.FuncrefKeyword */) {
            if (!(target.declaredType.flags & 16384 /* gt.TypeFlags.Function */))
                return false;
            return this.isComparableTo(target.declaredType);
        }
        if (target instanceof FunctionType) {
            if (this.symbol === target.symbol)
                return true;
            if (this.signature.match(target.signature))
                return true;
        }
        return false;
    }
    isBoolExpression(_negation) {
        return false;
    }
    getName() {
        return this.symbol.escapedName;
    }
}
export class ReferenceType extends AbstractType {
    kind;
    declaredType;
    constructor(kind, declaredType) {
        super();
        this.flags = 262144 /* gt.TypeFlags.Reference */;
        this.kind = kind;
        this.declaredType = declaredType;
        if (this.kind === 112 /* gt.SyntaxKind.FuncrefKeyword */) {
            this.flags |= 128 /* gt.TypeFlags.Nullable */;
        }
    }
    isAssignableTo(target) {
        if (target instanceof ReferenceType && this.kind === target.kind) {
            return this.declaredType.isAssignableTo(target);
        }
        return false;
    }
    isComparableTo(target) {
        if (target === nullType)
            return true;
        if (target instanceof ReferenceType && this.kind === target.kind) {
            return this.isAssignableTo(target);
        }
        if (target instanceof FunctionType) {
            if (this.kind === 112 /* gt.SyntaxKind.FuncrefKeyword */) {
                return this.declaredType.signature.match(target.signature);
            }
        }
        return false;
    }
    isBoolExpression(_negation) {
        return false;
    }
    getName() {
        return tokenToString(this.kind) + '<' + this.declaredType.getName() + '>';
    }
}
export class ArrayType extends AbstractType {
    elementType;
    constructor(elementType) {
        super();
        this.flags = 65536 /* gt.TypeFlags.Array */;
        this.elementType = elementType;
    }
    isAssignableTo(target) {
        if (target instanceof ReferenceType && target.kind === 110 /* gt.SyntaxKind.ArrayrefKeyword */) {
            // multi-dimensional array
            if (this.elementType instanceof ArrayType) {
                return this.getName() === target.declaredType.getName();
            }
            // intrinsic type / whatever else
            if (this.elementType === target.declaredType.elementType)
                return true;
        }
        return false;
    }
    isComparableTo(_target) {
        return false;
    }
    isBoolExpression(_negation) {
        return false;
    }
    getName() {
        return this.elementType.getName() + '[]';
    }
}
export class TypedefType extends AbstractType {
    referencedType;
    constructor(referencedType) {
        super();
        this.flags = 2097152 /* gt.TypeFlags.Typedef */;
        this.referencedType = referencedType;
    }
    isAssignableTo(_target) {
        return false;
    }
    isComparableTo(_target) {
        return false;
    }
    isBoolExpression(_negation) {
        return false;
    }
    getName() {
        return this.referencedType.getName();
    }
}
const unknownType = new UnknownType();
const nullType = new IntrinsicType(4096 /* gt.TypeFlags.Null */ | 128 /* gt.TypeFlags.Nullable */, 'null');
const boolType = new IntrinsicType(64 /* gt.TypeFlags.Boolean */, 'bool');
const trueType = new IntrinsicType(64 /* gt.TypeFlags.Boolean */, 'true');
const falseType = new IntrinsicType(64 /* gt.TypeFlags.Boolean */, 'false');
const stringType = new IntrinsicType(2 /* gt.TypeFlags.String */ | 128 /* gt.TypeFlags.Nullable */, 'string');
const integerType = new IntrinsicType(4 /* gt.TypeFlags.Integer */, 'integer');
const byteType = new IntrinsicType(8 /* gt.TypeFlags.Byte */, 'byte');
const fixedType = new IntrinsicType(32 /* gt.TypeFlags.Fixed */, 'fixed');
const voidType = new IntrinsicType(2048 /* gt.TypeFlags.Void */, 'void');
const complexTypes = generateComplexTypes();
/** Shared keyword types for bounded consumers which do not run a linker. */
export function getKeywordType(kind) {
    switch (kind) {
        case 76 /* gt.SyntaxKind.StringKeyword */: return stringType;
        case 74 /* gt.SyntaxKind.IntKeyword */: return integerType;
        case 72 /* gt.SyntaxKind.ByteKeyword */: return byteType;
        case 75 /* gt.SyntaxKind.FixedKeyword */: return fixedType;
        case 71 /* gt.SyntaxKind.BoolKeyword */: return boolType;
        case 106 /* gt.SyntaxKind.VoidKeyword */: return voidType;
        case 69 /* gt.SyntaxKind.NullKeyword */: return nullType;
        case 67 /* gt.SyntaxKind.TrueKeyword */: return trueType;
        case 68 /* gt.SyntaxKind.FalseKeyword */: return falseType;
        default: return complexTypes.get(kind);
    }
}
/** Result typing shared with the conversion validator. Operand validity is
 * supplied by AbstractType's assignability/comparability/operator predicates. */
export function getBinaryResultType(left, right, operator) {
    if (isComparisonOperator(operator) || operator === 35 /* gt.SyntaxKind.BarBarToken */ || operator === 34 /* gt.SyntaxKind.AmpersandAmpersandToken */)
        return boolType;
    if ([20 /* gt.SyntaxKind.PlusToken */, 21 /* gt.SyntaxKind.MinusToken */, 22 /* gt.SyntaxKind.AsteriskToken */, 24 /* gt.SyntaxKind.PercentToken */, 23 /* gt.SyntaxKind.SlashToken */].includes(operator) && left.flags & 44 /* gt.TypeFlags.Numeric */) {
        if (right.flags & 32 /* gt.TypeFlags.Fixed */ && !(left.flags & 32 /* gt.TypeFlags.Fixed */))
            return fixedType;
        if ((left.flags & 8 /* gt.TypeFlags.Byte */ && !(right.flags & 8 /* gt.TypeFlags.Byte */)) || (right.flags & 8 /* gt.TypeFlags.Byte */ && !(left.flags & 8 /* gt.TypeFlags.Byte */)))
            return integerType;
    }
    return left;
}
/** Canonical identity used by the binder/store for Galaxy include document names. */
export function normalizeGalaxyIncludeIdentity(path) {
    return path.replace(/\\/gu, '/').replace(/^\/+|\/+$/gu, '').replace(/\.galaxy$/iu, '').toLowerCase();
}
function generateComplexTypes() {
    const map = new Map();
    for (let i = 77 /* gt.SyntaxKindMarker.FirstComplexType */; i <= 109 /* gt.SyntaxKindMarker.LastComplexType */; i++) {
        const ckind = i;
        map.set(ckind, new ComplexType(ckind));
    }
    return map;
}
export class TypeChecker {
    host;
    nodeLinks = [];
    diagnostics = new Map();
    currentSymbolContainer = null;
    currentSymbolReferences = new Map();
    currentDocuments = new Map();
    activeIncludeFiles = new Set();
    constructor(host) {
        this.host = host;
        this.currentDocuments = this.host.documents;
    }
    report(location, msg, category = gt.DiagnosticCategory.Error, tags) {
        const d = createDiagnosticForNode(location, category, msg, tags);
        const c = this.diagnostics.get(d.file.fileName);
        if (c)
            c.push(d);
    }
    getNodeLinks(node) {
        const nodeId = getNodeId(node);
        return this.nodeLinks[nodeId] || (this.nodeLinks[nodeId] = { flags: 0 });
    }
    checkTypeAssignableTo(source, target, node) {
        // TODO: error when using local var as reference
        if (source === unknownType || target === unknownType)
            return;
        if (!source.isAssignableTo(target)) {
            this.report(node, "Type '" + source.getName() + "' is not assignable to type '" + target.getName() + "'");
        }
    }
    checkTypeComparableTo(source, target, node) {
        if (source === unknownType || target === unknownType)
            return;
        if (!source.isComparableTo(target)) {
            this.report(node, "Type '" + source.getName() + "' is not comparable to type '" + target.getName() + "'");
        }
    }
    checkTypeBoolExpression(source, negation, node) {
        if (source === unknownType)
            return;
        if (!source.isBoolExpression(negation)) {
            this.report(node, "Type '" + source.getName() + "' can not be used as boolean expression");
        }
    }
    getTypeFromArrayTypeNode(node) {
        const links = this.getNodeLinks(node);
        if (!links.resolvedType) {
            links.resolvedType = new ArrayType(this.getTypeFromTypeNode(node.elementType));
        }
        return links.resolvedType;
    }
    getTypeFromMappedTypeNode(node) {
        const links = this.getNodeLinks(node);
        if (!links.resolvedType) {
            links.resolvedType = new ReferenceType(node.returnType.kind, node.typeArguments.length
                ? this.getTypeFromTypeNode(node.typeArguments[0])
                : unknownType);
        }
        return links.resolvedType;
    }
    resolveMappedReference(type) {
        if (type.flags & 262144 /* gt.TypeFlags.Reference */) {
            type = type.declaredType;
        }
        return type;
    }
    getPropertyOfType(type, name) {
        if (type && type.flags & 8192 /* gt.TypeFlags.Struct */) {
            if (type.symbol.members.has(name)) {
                return type.symbol.members.get(name);
            }
        }
    }
    getDeclaredTypeOfStruct(symbol) {
        // TODO: persist in map<symbol,type>
        return new StructType(symbol);
    }
    getSignatureOfFunction(fnDecl) {
        return new SignatureMeta(this.getTypeFromTypeNode(fnDecl.type), fnDecl.parameters.map(param => {
            return this.getTypeFromTypeNode(param.type);
        }));
    }
    getTypeOfFunction(symbol) {
        const fnDecl = symbol.declarations[0];
        // TODO: persist in map<symbol,type>
        return new FunctionType(symbol, this.getSignatureOfFunction(fnDecl));
    }
    getTypeOfTypedef(symbol) {
        const refType = this.getTypeFromTypeNode(symbol.declarations[0].type);
        return new TypedefType(refType);
    }
    getDeclaredTypeOfSymbol(symbol) {
        if (symbol.flags & 64 /* gt.SymbolFlags.Struct */) {
            return this.getDeclaredTypeOfStruct(symbol);
        }
        else if (symbol.flags & 14 /* gt.SymbolFlags.Variable */) {
            return this.getTypeOfSymbol(symbol);
        }
        else if (symbol.flags & 32 /* gt.SymbolFlags.Function */) {
            // should we introduce SignatureType that describes fn declaration and return it instead?
            return this.getTypeOfFunction(symbol);
        }
        else if (symbol.flags & 128 /* gt.SymbolFlags.Typedef */) {
            return this.getTypeFromTypeNode(symbol.declarations[0].type);
        }
        return unknownType;
    }
    getTypeFromTypeNode(node) {
        const keyword = getKeywordType(node.kind);
        if (keyword)
            return keyword;
        switch (node.kind) {
            // case gt.SyntaxKind.LiteralType:
            //     return getTypeFromLiteralTypeNode(<LiteralTypeNode>node);
            case 117 /* gt.SyntaxKind.ArrayType */:
                return this.getTypeFromArrayTypeNode(node);
            case 116 /* gt.SyntaxKind.MappedType */:
                return this.getTypeFromMappedTypeNode(node);
            case 113 /* gt.SyntaxKind.Identifier */: {
                const symbol = this.getSymbolAtLocation(node);
                if (symbol) {
                    return this.getDeclaredTypeOfSymbol(symbol);
                }
                else {
                    return unknownType;
                }
            }
            default:
                if (isComplexTypeKind(node.kind)) {
                    return complexTypes.get(node.kind);
                }
                return unknownType;
        }
    }
    getTypeOfSymbol(symbol) {
        if (symbol.flags & 14 /* gt.SymbolFlags.Variable */ || symbol.flags & 16 /* gt.SymbolFlags.Property */) {
            return this.getTypeOfVariableOrParameterOrProperty(symbol);
        }
        else if (symbol.flags & 32 /* gt.SymbolFlags.Function */) {
            return this.getTypeOfFunction(symbol);
        }
        else if (symbol.flags & 128 /* gt.SymbolFlags.Typedef */) {
            return this.getTypeOfTypedef(symbol);
        }
        return unknownType;
    }
    getTypeOfVariableOrParameterOrProperty(symbol) {
        return this.getTypeFromTypeNode(symbol.declarations[0].type);
    }
    getTypeOfNode(node, followRef = false) {
        // TODO:
        // if (isPartOfTypeNode(node)) {
        //     return this.getTypeFromTypeNode(<TypeNode>node);
        // }
        if (isPartOfExpression(node)) {
            let type = this.getRegularTypeOfExpression(node);
            if (followRef) {
                type = this.resolveMappedReference(type);
            }
            return type;
        }
        return unknownType;
    }
    getRegularTypeOfExpression(expr) {
        return this.getTypeOfExpression(expr);
    }
    getTypeOfExpression(node, _cache) {
        return this.checkExpression(node);
    }
    clear() {
        this.diagnostics.clear();
        this.currentSymbolReferences.clear();
    }
    checkSourceFile(sourceFile, bindSymbols = false) {
        this.clear();
        this.diagnostics.set(sourceFile.fileName, []);
        this.currentDocuments = this.host.documents;
        if (bindSymbols) {
            unbindSourceFile(sourceFile, { resolveGlobalSymbol: this.resolveGlobalSymbol.bind(this) });
            this.currentSymbolContainer = declareSymbol(sourceFile, { resolveGlobalSymbol: this.resolveGlobalSymbol.bind(this) }, undefined);
        }
        sourceFile.statements.forEach(this.checkSourceElement.bind(this));
        if (bindSymbols) {
            this.checkForUnusedLocalDefinitions(this.currentSymbolContainer);
        }
        return Array.from(this.diagnostics.values()).pop();
    }
    checkSourceFileRecursivelyWorker(sourceFile) {
        this.activeIncludeFiles.add(sourceFile);
        unbindSourceFile(sourceFile, { resolveGlobalSymbol: this.resolveGlobalSymbol.bind(this) });
        this.currentSymbolContainer = declareSymbol(sourceFile, { resolveGlobalSymbol: this.resolveGlobalSymbol.bind(this) }, undefined);
        this.diagnostics.set(sourceFile.fileName, []);
        this.currentDocuments.set(sourceFile.fileName, sourceFile);
        for (const statement of sourceFile.statements) {
            if (statement.kind === 136 /* gt.SyntaxKind.IncludeStatement */) {
                const qsFile = this.checkIncludeStatement(statement);
                if (qsFile && this.activeIncludeFiles.has(qsFile)) {
                    this.report(statement, `Circular include reaches ${qsFile.fileName}`, gt.DiagnosticCategory.Warning);
                }
                else if (qsFile && !this.currentDocuments.has(qsFile.fileName)) {
                    const currentSymbolContainer = this.currentSymbolContainer;
                    this.checkSourceFileRecursivelyWorker(qsFile);
                    this.currentSymbolContainer = currentSymbolContainer;
                }
                continue;
            }
            this.checkSourceElement(statement);
        }
        this.activeIncludeFiles.delete(sourceFile);
    }
    checkSourceFileRecursively(sourceFile) {
        this.clear();
        this.activeIncludeFiles.clear();
        this.currentDocuments = new Map();
        if (this.host.s2workspace) {
            const coreMod = this.host.s2workspace.allArchives.find(archive => archive.name === 'mods/core.sc2mod');
            if (coreMod) {
                const corePath = joinPath(coreMod.directory, 'base.sc2data', 'TriggerLibs');
                const nativeScripts = [
                    joinPath(corePath, 'natives_missing.galaxy'),
                    joinPath(corePath, 'natives.galaxy'),
                ];
                for (const fpath of nativeScripts) {
                    const uri = URI.file(fpath).toString();
                    // Lazy-aware lookup: natives may not be parsed yet on a warm start.
                    const qFile = this.host.getDocument
                        ? this.host.getDocument(uri)
                        : this.host.documents.get(uri);
                    if (qFile) {
                        this.checkSourceFileRecursivelyWorker(qFile);
                    }
                }
            }
        }
        this.checkSourceFileRecursivelyWorker(sourceFile);
        this.checkForIdentifierDefinitions();
        this.checkForUnusedLocalDefinitions(this.currentSymbolContainer);
        return {
            success: Array.from(this.diagnostics.values()).findIndex(value => value.length > 0) === -1,
            diagnostics: this.diagnostics,
            sourceFiles: this.currentDocuments,
        };
    }
    checkForIdentifierDefinitions() {
        for (const [symbol, symRef] of this.currentSymbolReferences) {
            if (symbol.flags & 32 /* gt.SymbolFlags.Function */) {
                if (symbol.flags & 2048 /* gt.SymbolFlags.Native */)
                    continue;
                if (!symRef.size)
                    continue;
                if (symbol.valueDeclaration)
                    continue;
                for (const identifier of symRef) {
                    this.report(identifier, `Referenced function '${identifier.name}' hasn't been defined.`);
                }
            }
        }
    }
    checkIsSymbolDeclarationDefined(symbol) {
        const symRef = this.currentSymbolReferences.get(symbol);
        if (symbol.flags & 14 /* gt.SymbolFlags.Variable */) {
            if (symRef && symRef.size > 1)
                return;
            if ((symbol.flags & 8 /* gt.SymbolFlags.GlobalVariable */ && !(symbol.flags & 1024 /* gt.SymbolFlags.Static */)) ||
                (symbol.flags & 2 /* gt.SymbolFlags.LocalVariable */ &&
                    !((symbol.parent?.flags ?? 0) & 32 /* gt.SymbolFlags.Function */)) ||
                (symbol.flags & 4 /* gt.SymbolFlags.FunctionParameter */ &&
                    (symbol.parent?.flags ?? 0) & 32 /* gt.SymbolFlags.Function */)) {
                return;
            }
            for (const nodeDecl of symbol.declarations) {
                const nameDecl = nodeDecl;
                if (nameDecl) {
                    this.report(nameDecl.name, `'${symbol.escapedName}' variable is defined but never used.`, gt.DiagnosticCategory.Hint, [lsp.DiagnosticTag.Unnecessary]);
                }
            }
        }
    }
    checkForUnusedLocalDefinitions(rootSym) {
        if (!rootSym)
            return;
        for (const currSym of this.currentSymbolContainer.members.values()) {
            this.checkIsSymbolDeclarationDefined(currSym);
            if (currSym.flags & 32 /* gt.SymbolFlags.Function */ && currSym.valueDeclaration) {
                for (const childSym of currSym.members.values()) {
                    this.checkIsSymbolDeclarationDefined(childSym);
                    // this.checkForUnusedLocalDefinitions(childSym);
                }
            }
        }
    }
    checkSourceElement(node) {
        let prevSymbolContainer = null;
        if (this.currentSymbolContainer && isDeclarationKind(node.kind)) {
            prevSymbolContainer = this.currentSymbolContainer;
            this.currentSymbolContainer = declareSymbol(node, { resolveGlobalSymbol: this.resolveGlobalSymbol.bind(this) }, prevSymbolContainer);
            if (this.currentSymbolContainer.declarations.length > 1) {
                let previousDeclaration;
                if (node.kind === 142 /* gt.SyntaxKind.FunctionDeclaration */) {
                    for (const pd of this.currentSymbolContainer.declarations) {
                        if (pd === node)
                            continue;
                        if (pd.kind === 142 /* gt.SyntaxKind.FunctionDeclaration */ &&
                            (!pd.body || !node.body)) {
                            continue;
                        }
                        previousDeclaration = pd;
                        break;
                    }
                }
                else if (node.kind === 143 /* gt.SyntaxKind.ParameterDeclaration */) {
                    for (const pd of this.currentSymbolContainer.declarations) {
                        if (pd === node)
                            continue;
                        if (pd.parent !== node.parent)
                            continue;
                        previousDeclaration = pd;
                        break;
                    }
                }
                else {
                    previousDeclaration =
                        this.currentSymbolContainer.declarations[this.currentSymbolContainer.declarations.length - 2];
                }
                if (previousDeclaration) {
                    const prevSourceFile = (findAncestorByKind(previousDeclaration, 127 /* gt.SyntaxKind.SourceFile */));
                    const prevPos = getLineAndCharacterOfPosition(prevSourceFile, previousDeclaration.pos);
                    this.report(node.name, `Symbol redeclared, previous declaration in ${prevSourceFile.fileName}:${prevPos.line + 1},${prevPos.character + 1}`);
                }
            }
        }
        switch (node.kind) {
            case 136 /* gt.SyntaxKind.IncludeStatement */:
                this.checkIncludeStatement(node);
                break;
            case 145 /* gt.SyntaxKind.TypedefDeclaration */:
                this.checkTypedefDeclaration(node);
                break;
            case 128 /* gt.SyntaxKind.Block */:
                this.checkBlock(node);
                break;
            case 142 /* gt.SyntaxKind.FunctionDeclaration */:
                this.checkFunction(node);
                break;
            case 141 /* gt.SyntaxKind.VariableDeclaration */:
                this.checkVariableDeclaration(node);
                break;
            case 144 /* gt.SyntaxKind.PropertyDeclaration */:
                this.checkPropertyDeclaration(node);
                break;
            case 143 /* gt.SyntaxKind.ParameterDeclaration */:
                this.checkParameterDeclaration(node);
                break;
            case 140 /* gt.SyntaxKind.StructDeclaration */:
                this.checkStructDeclaration(node);
                break;
            case 138 /* gt.SyntaxKind.ExpressionStatement */:
                this.checkExpressionStatement(node);
                break;
            case 129 /* gt.SyntaxKind.IfStatement */:
                this.checkIfStatement(node);
                break;
            case 132 /* gt.SyntaxKind.ForStatement */:
                this.checkForStatement(node);
                break;
            case 131 /* gt.SyntaxKind.WhileStatement */:
            case 130 /* gt.SyntaxKind.DoStatement */:
                this.checkWhileStatement(node);
                break;
            case 133 /* gt.SyntaxKind.BreakStatement */:
            case 134 /* gt.SyntaxKind.ContinueStatement */:
                this.checkBreakOrContinueStatement(node);
                break;
            case 137 /* gt.SyntaxKind.ReturnStatement */:
                this.checkReturnStatement(node);
                break;
        }
        if (prevSymbolContainer) {
            this.currentSymbolContainer = prevSymbolContainer;
        }
    }
    checkIncludeStatement(node) {
        const rawPath = node.path.value.toLowerCase();
        const segments = rawPath.split('.');
        const path = normalizeGalaxyIncludeIdentity(rawPath);
        if (segments.length > 1 && segments[segments.length - 1] !== 'galaxy') {
            this.report(node.path, `Dot in a script name is not allowed, unless path ends with ".galaxy"`, gt.DiagnosticCategory.Warning);
        }
        else {
        }
        // Lazy-aware lookup: the include target may be a not-yet-parsed dependency file.
        const qsMap = this.host.resolveQualifiedDocuments
            ? this.host.resolveQualifiedDocuments(path)
            : this.host.qualifiedDocuments.get(path);
        if (!qsMap) {
            this.report(node.path, `Given filename couldn't be matched`);
            return;
        }
        const qsFile = Array.from(qsMap.values())[0];
        const currCourceFile = findAncestorByKind(node, 127 /* gt.SyntaxKind.SourceFile */);
        if (currCourceFile === qsFile) {
            this.report(node, `Self-include`, gt.DiagnosticCategory.Warning);
            return;
        }
        return qsFile;
    }
    checkTypedefDeclaration(node) {
        this.checkDeclarationType(node.type);
        this.checkIdentifier(node.name);
    }
    checkDeclarationType(node) {
        switch (node.kind) {
            case 116 /* gt.SyntaxKind.MappedType */:
                return this.checkMappedType(node);
            case 117 /* gt.SyntaxKind.ArrayType */:
                return this.checkArrayType(node);
            case 113 /* gt.SyntaxKind.Identifier */:
                return this.checkIdentifier(node, false, false)[1];
        }
    }
    checkFunction(node) {
        this.checkDeclarationType(node.type);
        this.checkIdentifier(node.name, false, false);
        this.checkTypeNoRefs(node.type);
        const currentSignature = this.getSignatureOfFunction(node);
        for (const prevDecl of node.symbol.declarations) {
            if (node === prevDecl)
                continue;
            if (prevDecl.kind !== 142 /* gt.SyntaxKind.FunctionDeclaration */)
                break;
            const previousSignature = this.getSignatureOfFunction(prevDecl);
            if (!currentSignature.match(previousSignature)) {
                this.report(node, `Function signature doesn't match it's previous declaration '${previousSignature.toString()}'`);
                break;
            }
        }
        node.parameters.forEach(this.checkSourceElement.bind(this));
        if (node.body && node.body.kind === 128 /* gt.SyntaxKind.Block */) {
            const rtype = this.getTypeFromTypeNode(node.type);
            this.checkBlock(node.body);
            if (!(rtype.flags & 2048 /* gt.TypeFlags.Void */) && !node.body.hasReturn) {
                this.report(node.name, 'Expected return statement');
            }
        }
    }
    checkLocalDeclaration(node, symbol) {
        const sourceFile = findAncestorByKind(node, 127 /* gt.SyntaxKind.SourceFile */);
        if (symbol.flags & 6 /* gt.SymbolFlags.FunctionScopedVariable */ ||
            symbol.flags & 16 /* gt.SymbolFlags.Property */) {
            const globalSym = this.resolveName(sourceFile, node.name.name, true);
            if (globalSym) {
                if (globalSym.flags & 32 /* gt.SymbolFlags.Function */ || globalSym.flags & 128 /* gt.SymbolFlags.Typedef */) {
                    const orgSourceFile = (findAncestorByKind(globalSym.declarations[0], 127 /* gt.SyntaxKind.SourceFile */));
                    const orgPos = getLineAndCharacterOfPosition(orgSourceFile, globalSym.declarations[0].pos);
                    this.report(node.name, [
                        `Name '${node.name.name}' redefined. Already in use in global scope.`,
                        `See: ${basenamePath(URI.parse(orgSourceFile.fileName).fsPath)}:${orgPos.line + 1},${orgPos.character + 1}`,
                    ].join(' '));
                }
            }
        }
    }
    checkParameterDeclaration(node) {
        this.checkDeclarationType(node.type);
        const [symbol] = this.checkIdentifier(node.name);
        // const isNative = (<gt.FunctionDeclaration>node.parent).modifiers.some((value) => value.kind === gt.SyntaxKind.NativeKeyword);
        // if ((<gt.FunctionDeclaration>node.parent).body || isNative) {
        // }
        if (symbol) {
            this.checkLocalDeclaration(node, symbol);
        }
        const type = this.getTypeFromTypeNode(node.type);
        if (type instanceof StructType || type instanceof FunctionType) {
            this.report(node.type, 'Can only pass basic types');
        }
    }
    checkVariableDeclaration(node) {
        const declType = this.checkDeclarationType(node.type);
        const [symbol] = this.checkIdentifier(node.name);
        if (node.initializer) {
            const varType = this.getTypeFromTypeNode(node.type);
            const exprType = this.checkExpression(node.initializer);
            this.checkTypeAssignableTo(exprType, varType, node.initializer);
        }
        const isConstant = node.modifiers?.some(value => value.kind === 53 /* gt.SyntaxKind.ConstKeyword */);
        if (isConstant && declType instanceof TypedefType) {
            this.report(node.type, `Constant variables cannot reference Typedefs`);
        }
        if (symbol) {
            this.checkLocalDeclaration(node, symbol);
        }
        if (symbol.flags & 8 /* gt.SymbolFlags.GlobalVariable */) {
            this.checkTypeNoRefs(node.type);
        }
    }
    checkTypeNoRefs(node) {
        if (node.kind === 116 /* gt.SyntaxKind.MappedType */) {
            switch (node.returnType.kind) {
                case 111 /* gt.SyntaxKind.StructrefKeyword */:
                case 110 /* gt.SyntaxKind.ArrayrefKeyword */: {
                    this.report(node, `Can not use arrayref/structref as a global, a field, or a return value (only as a local or a parameter).`);
                    break;
                }
            }
        }
    }
    checkPropertyDeclaration(node) {
        this.checkDeclarationType(node.type);
        const [symbol] = this.checkIdentifier(node.name);
        if (symbol) {
            this.checkLocalDeclaration(node, symbol);
        }
        this.checkTypeNoRefs(node.type);
    }
    checkStructDeclaration(node) {
        node.members.forEach(this.checkSourceElement.bind(this));
    }
    checkIfStatement(node) {
        const exprType = this.checkExpression(node.expression);
        this.checkTypeBoolExpression(exprType, false, node.expression);
        this.checkSourceElement(node.thenStatement);
        if (node.elseStatement) {
            this.checkSourceElement(node.elseStatement);
            node.hasReturn =
                Boolean(node.thenStatement.hasReturn) &&
                    Boolean(node.elseStatement.hasReturn);
        }
    }
    checkForStatement(node) {
        if (node.initializer) {
            this.checkExpression(node.initializer);
        }
        if (node.condition) {
            const exprType = this.checkExpression(node.condition);
            this.checkTypeBoolExpression(exprType, false, node.condition);
        }
        if (node.incrementor) {
            this.checkExpression(node.incrementor);
        }
        this.checkSourceElement(node.statement);
    }
    checkWhileStatement(node) {
        if (node.expression) {
            const exprType = this.checkExpression(node.expression);
            this.checkTypeBoolExpression(exprType, false, node.expression);
        }
        this.checkSourceElement(node.statement);
    }
    checkBreakOrContinueStatement(node) {
        const loop = findAncestor(node, parent => {
            switch (parent.kind) {
                case 132 /* gt.SyntaxKind.ForStatement */:
                case 131 /* gt.SyntaxKind.WhileStatement */:
                case 130 /* gt.SyntaxKind.DoStatement */:
                    return true;
            }
            return false;
        });
        if (!loop) {
            this.report(node, `${tokenToString(node.syntaxTokens[0].kind)} statement used outside of loop boundaries`);
        }
    }
    checkReturnStatement(node) {
        const fn = findAncestorByKind(node, 142 /* gt.SyntaxKind.FunctionDeclaration */);
        const rtype = this.getTypeFromTypeNode(fn.type);
        if (rtype.flags & 2048 /* gt.TypeFlags.Void */ && node.expression) {
            this.report(node, 'Unexpected value returned for void function');
        }
        else if (!(rtype.flags & 2048 /* gt.TypeFlags.Void */) && !node.expression) {
            this.report(node, 'Expected a return value');
        }
        if (node.expression) {
            const exprType = this.checkExpression(node.expression);
            this.checkTypeAssignableTo(exprType, rtype, node.expression);
        }
    }
    checkArrayType(node) {
        this.checkExpression(node.size);
        this.checkDeclarationType(node.elementType);
    }
    checkMappedType(node) {
        if (!isReferenceKeywordKind(node.returnType.kind)) {
            this.report(node.returnType, 'Invalid keyword for reference type provided - use funcref, arrayref or structref');
        }
        if (node.typeArguments.length !== 1) {
            this.report(node, 'Expected exactly 1 argument');
        }
        node.typeArguments.forEach(this.checkDeclarationType.bind(this));
        if (node.typeArguments.length > 0) {
            const type = this.getTypeFromMappedTypeNode(node);
            let invalid = false;
            switch (type.kind) {
                case 111 /* gt.SyntaxKind.StructrefKeyword */:
                    invalid = !(type.declaredType.flags & 8192 /* gt.TypeFlags.Struct */);
                    break;
                case 112 /* gt.SyntaxKind.FuncrefKeyword */:
                    invalid = !(type.declaredType.flags & 16384 /* gt.TypeFlags.Function */);
                    break;
                case 110 /* gt.SyntaxKind.ArrayrefKeyword */:
                    invalid = !(type.declaredType.flags & 65536 /* gt.TypeFlags.Array */);
                    break;
            }
            if (invalid) {
                this.report(node, "Type '" +
                    type.declaredType.getName() +
                    "' is not a valid reference for '" +
                    tokenToString(node.returnType.kind) +
                    "'");
            }
        }
    }
    checkBlock(node) {
        let returnFound = false;
        node.statements.forEach(child => {
            this.checkSourceElement(child);
            switch (child.kind) {
                case 137 /* gt.SyntaxKind.ReturnStatement */:
                    returnFound = true;
                    break;
                case 129 /* gt.SyntaxKind.IfStatement */:
                    // if (returnFoundExplict === true) break;
                    returnFound = child.hasReturn;
                    break;
            }
        });
        node.hasReturn = returnFound;
    }
    checkExpressionStatement(node) {
        this.checkExpression(node.expression);
    }
    checkExpression(node, checkMode) {
        return this.checkExpressionWorker(node, checkMode);
    }
    checkExpressionWorker(node, checkMode) {
        switch (node.kind) {
            case 113 /* gt.SyntaxKind.Identifier */:
                return this.checkIdentifier(node)[1];
            case 69 /* gt.SyntaxKind.NullKeyword */:
                return nullType;
            case 3 /* gt.SyntaxKind.StringLiteral */:
            case 2 /* gt.SyntaxKind.NumericLiteral */:
            case 67 /* gt.SyntaxKind.TrueKeyword */:
            case 68 /* gt.SyntaxKind.FalseKeyword */:
                return this.checkLiteralExpression(node);
            case 120 /* gt.SyntaxKind.PropertyAccessExpression */:
                return this.checkPropertyAccessExpression(node);
            case 119 /* gt.SyntaxKind.ElementAccessExpression */:
                return this.checkIndexedAccess(node);
            case 121 /* gt.SyntaxKind.CallExpression */:
                return this.checkCallExpression(node);
            case 126 /* gt.SyntaxKind.ParenthesizedExpression */:
                return this.checkParenthesizedExpression(node, checkMode);
            case 122 /* gt.SyntaxKind.PrefixUnaryExpression */:
                return this.checkPrefixUnaryExpression(node);
            case 123 /* gt.SyntaxKind.PostfixUnaryExpression */:
                return this.checkPostfixUnaryExpression(node);
            case 124 /* gt.SyntaxKind.BinaryExpression */:
                return this.checkBinaryExpression(node, checkMode);
        }
        return unknownType;
    }
    checkLiteralExpression(node) {
        switch (node.kind) {
            case 3 /* gt.SyntaxKind.StringLiteral */:
                return new LiteralType(256 /* gt.TypeFlags.StringLiteral */ | 2 /* gt.TypeFlags.String */ | 128 /* gt.TypeFlags.Nullable */, node);
            case 2 /* gt.SyntaxKind.NumericLiteral */:
                if (node.text.indexOf('.') !== -1) {
                    return new LiteralType(512 /* gt.TypeFlags.NumericLiteral */ | 32 /* gt.TypeFlags.Fixed */, node);
                }
                else {
                    return new LiteralType(512 /* gt.TypeFlags.NumericLiteral */ | 4 /* gt.TypeFlags.Integer */, node);
                }
            case 67 /* gt.SyntaxKind.TrueKeyword */:
                return trueType;
            case 68 /* gt.SyntaxKind.FalseKeyword */:
                return falseType;
        }
        return unknownType;
    }
    checkBinaryExpression(node, _checkMode) {
        const leftType = this.checkExpression(node.left);
        const rightType = this.checkExpression(node.right);
        if (isAssignmentOperator(node.operatorToken.kind)) {
            this.checkTypeAssignableTo(rightType, leftType, node.right);
        }
        else if (isComparisonOperator(node.operatorToken.kind)) {
            this.checkTypeComparableTo(rightType, leftType, node.right);
            return boolType;
        }
        else if (node.operatorToken.kind === 35 /* gt.SyntaxKind.BarBarToken */ ||
            node.operatorToken.kind === 34 /* gt.SyntaxKind.AmpersandAmpersandToken */) {
            this.checkTypeAssignableTo(leftType, boolType, node.left);
            this.checkTypeAssignableTo(rightType, boolType, node.right);
            return boolType;
        }
        else {
            const valid = leftType.isValidBinaryOperation(node.operatorToken.kind, rightType);
            if (!valid) {
                this.report(node, [
                    `Binary expression '${tokenToString(node.operatorToken.kind)}' not supported between '${leftType.getName()}' and '${rightType.getName()}'.`,
                ].join(' '));
            }
        }
        return getBinaryResultType(leftType, rightType, node.operatorToken.kind);
    }
    checkParenthesizedExpression(node, _checkMode) {
        return this.checkExpression(node.expression);
    }
    checkPrefixUnaryExpression(node, _checkMode) {
        const type = this.checkExpression(node.operand);
        if (!type.isValidPrefixOperation(node.operator.kind)) {
            this.report(node, `Prefix '${tokenToString(node.operator.kind)}' operation not supported for '${type.getName()}' type`);
        }
        return type;
    }
    checkPostfixUnaryExpression(node, _checkMode) {
        return this.checkExpression(node.operand);
    }
    isTypeIdentifier(node) {
        switch (node.parent.kind) {
            case 144 /* gt.SyntaxKind.PropertyDeclaration */:
            case 143 /* gt.SyntaxKind.ParameterDeclaration */:
            case 141 /* gt.SyntaxKind.VariableDeclaration */: {
                const namedDecl = node.parent;
                if (namedDecl.type === node)
                    return true;
            }
        }
        return false;
    }
    checkIdentifier(node, _checkSymbol = false, definitionReferenced = true) {
        const symbol = this.getSymbolOfEntityNameOrPropertyAccessExpression(node);
        if (!symbol) {
            this.report(node, `Undeclared symbol: '${node.name}'`);
            return [symbol, unknownType];
        }
        if (definitionReferenced && symbol) {
            let symRef = this.currentSymbolReferences.get(symbol);
            if (!symRef) {
                symRef = new Set();
                this.currentSymbolReferences.set(symbol, symRef);
            }
            symRef.add(node);
        }
        if (symbol.flags & 1024 /* gt.SymbolFlags.Static */) {
            const sourceFile = findAncestorByKind(node, 127 /* gt.SyntaxKind.SourceFile */);
            if (symbol.parent && symbol.parent.declarations[0] !== sourceFile) {
                this.report(node, `Attempting to reference symbol with static modifier outside the scope of its definition.`);
            }
        }
        return [symbol, this.getTypeOfSymbol(symbol)];
    }
    checkCallExpression(node) {
        const leftType = this.checkExpression(node.expression);
        let returnType = leftType;
        let func;
        if (leftType !== unknownType) {
            let fnType = leftType;
            if (fnType.flags & 262144 /* gt.TypeFlags.Reference */) {
                fnType = this.resolveMappedReference(fnType);
            }
            if (fnType.flags & 16384 /* gt.TypeFlags.Function */) {
                func = fnType.symbol.declarations[0];
                if (node.arguments.length !== func.parameters.length) {
                    this.report(node, `Expected ${func.parameters.length} arguments, got ${node.arguments.length}`);
                }
                returnType = this.getTypeFromTypeNode(func.type);
            }
            else {
                this.report(node, `Type '${fnType.getName()}' is not calllable`);
                returnType = unknownType;
            }
        }
        if (func) {
            for (const [key, arg] of node.arguments.entries()) {
                const exprType = this.checkExpression(arg);
                if (func.parameters.length > key) {
                    const expectedType = this.getTypeFromTypeNode(func.parameters[key].type);
                    this.checkTypeAssignableTo(exprType, expectedType, arg);
                }
            }
        }
        return returnType;
    }
    checkIndexedAccess(node) {
        let objectType = this.checkExpression(node.expression);
        const indexType = this.checkExpression(node.argumentExpression);
        if (!(indexType.flags & 4 /* gt.TypeFlags.Integer */) &&
            !(indexType.flags & 512 /* gt.TypeFlags.NumericLiteral */)) {
            this.report(node.argumentExpression, 'Array index require an integer value');
        }
        if (objectType.flags & 262144 /* gt.TypeFlags.Reference */) {
            objectType = this.resolveMappedReference(objectType);
        }
        if (objectType.flags & 65536 /* gt.TypeFlags.Array */) {
            return objectType.elementType;
        }
        else {
            this.report(node, 'Index access on non-array type');
        }
        return unknownType;
    }
    checkPropertyAccessExpression(node) {
        let type = this.checkExpression(node.expression);
        type = this.resolveMappedReference(type);
        if (!(type.flags & 8192 /* gt.TypeFlags.Struct */)) {
            this.report(node.name, "Cannot access property on '" + type.getName() + "' type");
        }
        else {
            const prop = this.getPropertyOfType(type, node.name.name);
            if (prop) {
                this.getNodeLinks(node).resolvedSymbol = prop;
                const propType = this.getTypeOfSymbol(prop);
                return propType;
            }
            else {
                this.report(node.name, 'Undeclared property');
            }
        }
        return unknownType;
    }
    resolveName(location, name, limitScopeToDocument = false) {
        if (location) {
            const currentContext = (findAncestor(location, (element) => {
                return (element.kind === 142 /* gt.SyntaxKind.FunctionDeclaration */ ||
                    element.kind === 140 /* gt.SyntaxKind.StructDeclaration */);
            }));
            if (currentContext && currentContext.symbol.members.has(name)) {
                return currentContext.symbol.members.get(name);
            }
            const sourceFile = findAncestorByKind(location, 127 /* gt.SyntaxKind.SourceFile */);
            if (sourceFile.symbol.members.has(name)) {
                return sourceFile.symbol.members.get(name);
            }
        }
        if (limitScopeToDocument && !location) {
            throw new Error(`Expected location when limitScopeToDocument is set to true`);
        }
        if (limitScopeToDocument)
            return;
        return this.resolveGlobalSymbol(name);
    }
    resolveGlobalSymbol(name) {
        // Loose mode (currentDocuments IS the host's live map): delegate to the host — it
        // owns the document set and, with lazy indexing, may hydrate a dependency file on
        // first reference to one of its symbols (PLAN_lazy_lsp_index Phase 2). For an eager
        // host this is behavior-identical (same first-match loop).
        if (this.currentDocuments === this.host.documents) {
            return this.host.resolveGlobalSymbol(name);
        }
        // Recursive mode: `checkSourceFileRecursively` deliberately narrows resolution to
        // the include-reachable subset it collected — keep iterating that subset only.
        for (const document of this.currentDocuments.values()) {
            const symbol = document.symbol.members.get(name);
            if (symbol) {
                return symbol;
            }
        }
        return undefined;
    }
    resolveEntityName(entityName, _meaning, _ignoreErrors) {
        let symbol;
        if (entityName.kind === 113 /* gt.SyntaxKind.Identifier */) {
            if (!this.isTypeIdentifier(entityName)) {
                symbol = this.resolveName(entityName, entityName.name);
            }
            else {
                symbol = this.resolveName(findAncestorByKind(entityName, 127 /* gt.SyntaxKind.SourceFile */), entityName.name);
            }
        }
        return symbol;
    }
    getSymbolOfEntityNameOrPropertyAccessExpression(entityName) {
        if (isRightSideOfPropertyAccess(entityName)) {
            entityName = entityName.parent;
        }
        if (entityName.kind === 113 /* gt.SyntaxKind.Identifier */) {
            return this.resolveEntityName(entityName, null, false);
        }
        else if (entityName.kind === 120 /* gt.SyntaxKind.PropertyAccessExpression */) {
            const links = this.getNodeLinks(entityName);
            if (links.resolvedSymbol) {
                return links.resolvedSymbol;
            }
            this.checkPropertyAccessExpression(entityName).symbol;
            return links.resolvedSymbol;
        }
    }
    getSymbolAtLocation(node) {
        switch (node.kind) {
            case 113 /* gt.SyntaxKind.Identifier */:
            case 120 /* gt.SyntaxKind.PropertyAccessExpression */:
                return this.getSymbolOfEntityNameOrPropertyAccessExpression(node);
        }
    }
}
//# sourceMappingURL=checker.js.map