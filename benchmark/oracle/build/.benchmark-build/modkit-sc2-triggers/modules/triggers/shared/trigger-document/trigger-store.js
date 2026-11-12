/* eslint-disable no-extra-semi */
import * as xml from 'xml2js';
export var ElementFlag;
(function (ElementFlag) {
    ElementFlag[ElementFlag["Native"] = 2] = "Native";
    ElementFlag[ElementFlag["FuncAction"] = 4] = "FuncAction";
    ElementFlag[ElementFlag["FuncCall"] = 8] = "FuncCall";
    ElementFlag[ElementFlag["Event"] = 16] = "Event";
    ElementFlag[ElementFlag["Template"] = 32] = "Template";
    ElementFlag[ElementFlag["PresetGenConstVar"] = 64] = "PresetGenConstVar";
    ElementFlag[ElementFlag["PresetCustom"] = 128] = "PresetCustom";
    ElementFlag[ElementFlag["CustomScript"] = 256] = "CustomScript";
    ElementFlag[ElementFlag["Operator"] = 512] = "Operator";
    ElementFlag[ElementFlag["CustomAI"] = 1024] = "CustomAI";
    ElementFlag[ElementFlag["SubFunctions"] = 2048] = "SubFunctions";
    ElementFlag[ElementFlag["AllowBreak"] = 4096] = "AllowBreak";
    ElementFlag[ElementFlag["Hidden"] = 8192] = "Hidden";
    ElementFlag[ElementFlag["NoScriptPrefix"] = 16384] = "NoScriptPrefix";
    ElementFlag[ElementFlag["Deprecated"] = 32768] = "Deprecated";
    ElementFlag[ElementFlag["Internal"] = 65536] = "Internal";
    ElementFlag[ElementFlag["Restricted"] = 131072] = "Restricted";
})(ElementFlag || (ElementFlag = {}));
export class ElementReference {
    store;
    id;
    type;
    library;
    constructor(container) {
        this.store = container;
    }
    link() {
        return this.type.name + '/' + this.id;
    }
    globalLink() {
        let link = this.link();
        if (this.library) {
            link = this.library + '/' + link;
        }
        return link;
    }
    resolve() {
        if (this.library) {
            const lib = this.store.getLibraries().get(this.library);
            return lib?.findElementById(this.link());
        }
        return this.store.findElementById(this.link());
    }
}
export class ParameterType {
    type;
    gameType; // when type == gamelink; e.g. Model; (may be omitted - "any")
    typeElement; // e.g. preset type or structure type
    get galaxyType() {
        switch (this.type) {
            case 'anygamelink':
            case 'gamelink':
            case 'filepath':
            case 'actormsg':
            case 'aidef':
            case 'modelanim':
            case 'attributegame':
            case 'attributeplayer':
            case 'attributevalue':
            case 'catalogentry':
            case 'catalogfieldname':
            case 'catalogfieldpath':
            case 'reference':
            case 'catalogscope':
            case 'charge':
            case 'convcharacter':
            case 'convline':
            case 'convstateindex':
            case 'conversationtag':
            case 'cooldown':
            case 'fontstyle':
            case 'gameoption':
            case 'gameoptionvalue':
            case 'modelcamera':
            case 'timeofday':
            case 'layoutframe':
            case 'layoutframerel':
            case 'userfield':
            case 'userinstance':
            case 'water':
                {
                    return 'string';
                }
            case 'aidefwave':
            case 'cinematic':
            case 'conversation':
            case 'reply':
            case 'datatable':
            case 'dialog':
            case 'control':
            case 'difficulty':
            case 'objective':
            case 'path':
            case 'ping':
            case 'planet':
            case 'playercolor':
            case 'portrait':
            case 'transmission':
                {
                    return 'int';
                }
            case 'animlengthquery':
                {
                    return 'generichandle';
                }
            case 'targetfilter':
                {
                    return 'unitfilter';
                }
            case 'preset':
                return this.typeElement?.resolve()?.baseType ?? 'int';
            default:
                return this.type;
        }
    }
}
export class Tag {
    static prefix;
    libId;
    id;
    name;
    link() {
        return (this.libId ? this.libId + '/' : '') + (this.constructor.name + '/') + this.id;
    }
    toString() {
        const parts = [];
        if (this.libId) {
            parts.push('lib' + this.libId);
        }
        const prefix = this.constructor.prefix;
        if (prefix) {
            parts.push(prefix);
        }
        parts.push(this.name ? this.name : this.id);
        return parts.join('_');
    }
    textKey(kind) {
        const parts = [];
        parts.push(this.constructor.name);
        parts.push(kind);
        if (this.libId) {
            parts.push(['lib', this.libId, this.id].join('_'));
        }
        else {
            parts.push(this.id);
        }
        return parts.join('/');
    }
}
export class Element extends Tag {
    flags = 0;
    label;
    items = [];
    toString() {
        if (this.flags & 2 /* ElementFlag.Native */) {
            return this.name ? this.name : this.id;
        }
        return super.toString();
    }
}
export class ParamDef extends Element {
    type;
    isReference; // ParamFlagReference
    isMultiple; // ParamFlagMultiple
    default;
    get galaxyType() {
        const rtype = this.type.galaxyType;
        if (this.isReference) {
            switch (rtype) {
                case 'unit':
                    {
                        return 'unitref';
                    }
            }
        }
        return rtype;
    }
}
export class FunctionDef extends Element {
    static prefix = 'gf';
    parameters = [];
    returnType;
    scriptCode;
    eventResponses = [];
    /** SubFunctionType declarations — lists all sub-block roles this function accepts */
    subFunctionTypes = [];
    /** Body actions (FunctionCall children of FunctionDef in SC2 Editor XML) */
    actions = [];
    /** Local variables declared in the function body */
    localVariables = [];
    getParameters() {
        return this.parameters.map((paramRef) => {
            return paramRef.resolve();
        });
    }
}
export class Preset extends Element {
    baseType;
    values = [];
}
export class PresetValue extends Element {
    value;
}
export class Param extends Element {
    parameterDef;
    functionCall;
    preset;
    value;
    valueType;
    valueGameType;
    valueElement;
    variable;
    /** Struct member selection for struct-typed variable access */
    structMember;
    /** Array index or indices for array variable access. Single index: [0], 2D: [0][1] */
    array;
    /** References a FunctionDef's own ParamDef — encodes "use the function parameter lp_xxx" */
    paramRef;
}
export class FunctionCall extends Element {
    functionDef;
    parameters = [];
    subFunctions = [];
    subFunctionType;
    scriptCode;
}
export class Category extends Element {
}
;
export class Label extends Element {
    icon;
    color;
}
;
export class Trigger extends Element {
    events = [];
    conditions = [];
    actions = [];
    localVariables = [];
}
export class Variable extends Element {
    variableType;
    initialValue;
    isArray;
    isConstant;
    arraySizes;
}
export class Structure extends Element {
    variables = [];
}
const ElementClasses = {
    ParamDef,
    FunctionDef,
    Preset,
    PresetValue,
    Param,
    FunctionCall,
    Category,
    Label,
    Trigger,
    Variable,
    Structure,
};
// export class TriggerExplorer {
//     protected containers: ElementContainer;
// }
export class ElementContainer {
    items = [];
    elements = new Map();
    nameMap = new Map();
    addElement(identifier, el) {
        el.id = identifier;
        if (el instanceof FunctionDef && el.name) {
            this.nameMap.set(el.name, el);
        }
        this.elements.set(el.constructor.name + '/' + el.id, el);
    }
    findElementByName(name) {
        return this.nameMap.get(name);
    }
    findPresetValueByStr(value) {
        for (const el of this.elements.values()) {
            if (!(el instanceof PresetValue))
                continue;
            if (el.value && el.value === value) {
                return el;
            }
        }
        return undefined;
    }
    findPresetByValue(value) {
        for (const el of this.elements.values()) {
            if (!(el instanceof Preset))
                continue;
            const belongsTo = el.values.find((localVal) => {
                return value.id === localVal.id;
            });
            if (belongsTo) {
                return el;
            }
        }
        return undefined;
    }
    findElementById(id, type) {
        if (type && type.name !== 'Element') {
            id = type.name + '/' + id;
        }
        return this.elements.get(id);
    }
    getElements() {
        return this.elements;
    }
}
export class Library extends ElementContainer {
    id;
    constructor(id) {
        super();
        this.id = id;
    }
    addElement(identifier, el) {
        el.libId = this.id;
        super.addElement(identifier, el);
    }
    getId() {
        return this.id;
    }
}
export class TriggerStore extends ElementContainer {
    libraries = new Map();
    unresolvedReferences = new Map();
    addElementReference(ref) {
        const link = ref.globalLink();
        if (this.unresolvedReferences.has(link)) {
            const refList = this.unresolvedReferences.get(link);
            refList.push(ref);
        }
        else {
            this.unresolvedReferences.set(link, [ref]);
        }
    }
    addLibrary(library) {
        this.libraries.set(library.getId(), library);
    }
    // public findElementById<T extends Element>(elementId: string, libraryId?: string): T | undefined {
    //     if (libraryId) {
    //         return this.libraries.get(libraryId).findElementById(elementId) as T;
    //     }
    //     return super.findElementById(elementId) as T;
    // }
    getLibraries() {
        return this.libraries;
    }
}
export class XMLReader {
    store;
    parseReference(data, type) {
        const ref = new ElementReference(this.store);
        ref.id = data.$.Id;
        if (data.$.Library) {
            ref.library = data.$.Library;
        }
        ref.type = ElementClasses[type.name];
        this.store.addElementReference(ref);
        return ref;
    }
    parseParam(item) {
        const element = new Param();
        if (item.ParameterDef) {
            element.parameterDef = this.parseReference(item.ParameterDef[0], ParamDef);
        }
        if (item.FunctionCall) {
            element.functionCall = this.parseReference(item.FunctionCall[0], FunctionCall);
        }
        if (item.Preset) {
            element.preset = this.parseReference(item.Preset[0], PresetValue);
        }
        if (item.Value) {
            element.value = item.Value[0];
        }
        if (item.ValueType) {
            element.valueType = item.ValueType[0].$.Type;
            if (item.ValueGameType) {
                element.valueGameType = item.ValueGameType[0].$.Type;
            }
        }
        if (item.ValueElement) {
            element.valueElement = this.parseReference(item.ValueElement[0], Preset);
        }
        // Variable reference inside Param (e.g. variable as parameter value)
        if (item.Variable) {
            element.variable = this.parseReference(item.Variable[0], Variable);
        }
        if (item.StructMember) {
            element.structMember = this.parseReference(item.StructMember[0], Param);
        }
        // Array indices: one or more Param references for 1D/2D/etc array access
        if (item.Array) {
            element.array = item.Array.map((a) => this.parseReference(a, Param));
        }
        // <Parameter Type="ParamDef" ...> — encodes "use the function input parameter lp_xxx"
        if (item.Parameter) {
            for (const p of item.Parameter) {
                if (p.$?.Type === 'ParamDef') {
                    element.paramRef = this.parseReference(p, ParamDef);
                    break;
                }
            }
        }
        return element;
    }
    parseParamDef(item) {
        const paramDef = new ParamDef();
        paramDef.type = this.parseParameterType(item.ParameterType[0]);
        if (item.Default) {
            paramDef.default = this.parseReference(item.Default[0], Param);
        }
        if (item.ParamFlagReference) {
            paramDef.isReference = true;
        }
        if (item.ParamFlagMultiple) {
            paramDef.isMultiple = true;
        }
        return paramDef;
    }
    parseFunctionCall(item) {
        const element = new FunctionCall();
        if (item.FunctionDef) {
            // TODO: check one of the void story libraries - it doesn't have FunctionDef
            element.functionDef = this.parseReference(item.FunctionDef[0], FunctionDef);
        }
        if (item.Parameter) {
            for (const param of item.Parameter) {
                if (param.$.Type === 'Comment')
                    continue;
                element.parameters.push(this.parseReference(param, Param));
            }
        }
        // Inline sub-function blocks (for IfThenElse, WhileDo, PickEachInteger, etc.)
        if (item.FunctionCall) {
            for (const fc of item.FunctionCall) {
                element.subFunctions.push(this.parseReference(fc, FunctionCall));
            }
        }
        // SubFunctionType identifies the role of this sub-block (e.g. "If", "Then", "Else", "Actions")
        if (item.SubFunctionType) {
            element.subFunctionType = {
                library: item.SubFunctionType[0].$.Library,
                id: item.SubFunctionType[0].$.Id,
            };
        }
        if (item.ScriptCode) {
            let code = item.ScriptCode[0];
            const whitespace = code.match(/^\r?\n(\s+)/);
            if (whitespace) {
                code = code.trim().replace(/\r?\n/g, '\n').replace(new RegExp('^' + whitespace[1], 'gm'), '');
            }
            element.scriptCode = code.trim();
        }
        return element;
    }
    parseParameterType(item) {
        const element = new ParameterType();
        element.type = item.Type[0].$.Value;
        if (element.type === 'gamelink' && item.GameType) {
            element.gameType = item.GameType[0].$.Value;
        }
        if (item.TypeElement) {
            const typeName = item.TypeElement[0]?.$?.Type;
            if (typeName === 'Structure') {
                element.typeElement = this.parseReference(item.TypeElement[0], Structure);
            }
            else {
                element.typeElement = this.parseReference(item.TypeElement[0], Preset);
            }
        }
        return element;
    }
    parseCategory(_item) {
        const element = new Category();
        return element;
    }
    parseLabel(item) {
        const element = new Label();
        if (item.Icon) {
            element.icon = item.Icon[0];
        }
        if (item.Color) {
            element.color = item.Color[0];
        }
        return element;
    }
    parseElement(item) {
        let el;
        switch (item.$.Type) {
            case 'FunctionDef':
                {
                    const func = el = new FunctionDef();
                    func.flags |= item.FlagNative ? 2 /* ElementFlag.Native */ : 0;
                    func.flags |= item.FlagAction ? 4 /* ElementFlag.FuncAction */ : 0;
                    func.flags |= item.FlagCall ? 8 /* ElementFlag.FuncCall */ : 0;
                    func.flags |= item.FlagEvent ? 16 /* ElementFlag.Event */ : 0;
                    func.flags |= item.Template ? 32 /* ElementFlag.Template */ : 0;
                    func.flags |= item.FlagCustomScript ? 256 /* ElementFlag.CustomScript */ : 0;
                    func.flags |= item.FlagOperator ? 512 /* ElementFlag.Operator */ : 0;
                    func.flags |= item.FlagCustomAI ? 1024 /* ElementFlag.CustomAI */ : 0;
                    func.flags |= item.FlagSubFunctions ? 2048 /* ElementFlag.SubFunctions */ : 0;
                    func.flags |= item.FlagAllowBreak ? 4096 /* ElementFlag.AllowBreak */ : 0;
                    func.flags |= item.FlagHidden ? 8192 /* ElementFlag.Hidden */ : 0;
                    func.flags |= item.FlagNoScriptPrefix ? 16384 /* ElementFlag.NoScriptPrefix */ : 0;
                    func.flags |= item.Deprecated ? 32768 /* ElementFlag.Deprecated */ : 0;
                    func.flags |= item.Internal ? 65536 /* ElementFlag.Internal */ : 0;
                    func.flags |= item.FlagRestricted ? 131072 /* ElementFlag.Restricted */ : 0;
                    if (item.Parameter) {
                        for (const param of item.Parameter) {
                            if (param.$.Type === 'Comment')
                                continue;
                            func.parameters.push(this.parseReference(param, ParamDef));
                        }
                    }
                    if (item.ReturnType) {
                        func.returnType = this.parseParameterType(item.ReturnType[0]);
                    }
                    if (item.ScriptCode) {
                        let code = item.ScriptCode[0];
                        const whitespace = code.match(/^\r?\n(\s+)/);
                        if (whitespace) {
                            code = code.trim().replace(/\r?\n/g, '\n').replace(new RegExp('^' + whitespace[1], 'gm'), '');
                        }
                        func.scriptCode = code;
                    }
                    if (item.FunctionCall) {
                        for (const fc of item.FunctionCall) {
                            func.actions.push(this.parseReference(fc, FunctionCall));
                        }
                    }
                    if (item.Variable) {
                        for (const v of item.Variable) {
                            func.localVariables.push(this.parseReference(v, Variable));
                        }
                    }
                    if (item.EventResponse) {
                        for (const er of item.EventResponse) {
                            func.eventResponses.push(this.parseReference(er, FunctionDef));
                        }
                    }
                    if (item.SubFunctionType) {
                        for (const sft of item.SubFunctionType) {
                            func.subFunctionTypes.push({
                                library: sft.$.Library,
                                id: sft.$.Id,
                            });
                        }
                    }
                    break;
                }
            case 'ParamDef':
                {
                    el = this.parseParamDef(item);
                    break;
                }
            case 'Param':
                el = this.parseParam(item);
                break;
            case 'FunctionCall':
                el = this.parseFunctionCall(item);
                break;
            case 'Preset':
                {
                    const preset = el = new Preset();
                    preset.flags |= item.PresetGenConstVar ? 64 /* ElementFlag.PresetGenConstVar */ : 0;
                    preset.flags |= item.PresetCustom ? 128 /* ElementFlag.PresetCustom */ : 0;
                    preset.baseType = item.BaseType[0].$.Value;
                    if (item.Item) {
                        for (const val of item.Item) {
                            if (val.$.Type !== 'PresetValue')
                                continue;
                            preset.values.push(this.parseReference(val, PresetValue));
                        }
                    }
                    // item.$.PresetCustom
                    // item.$.PresetGenConstVar
                    // item.$.PresetAsBits
                    break;
                }
            case 'PresetValue':
                {
                    const presetValue = el = new PresetValue();
                    if (item.Value) {
                        presetValue.value = item.Value[0];
                    }
                    break;
                }
            case 'Trigger':
                {
                    const trigger = el = new Trigger();
                    if (item.Event) {
                        for (const ev of item.Event) {
                            trigger.events.push(this.parseReference(ev, FunctionCall));
                        }
                    }
                    if (item.Condition) {
                        for (const cond of item.Condition) {
                            trigger.conditions.push(this.parseReference(cond, FunctionCall));
                        }
                    }
                    if (item.Action) {
                        for (const action of item.Action) {
                            trigger.actions.push(this.parseReference(action, FunctionCall));
                        }
                    }
                    // SC2 uses <Variable Type="Variable"> for local vars (not LocalVariable)
                    if (item.Variable) {
                        for (const lv of item.Variable) {
                            if (lv.$.Type === 'Variable') {
                                trigger.localVariables.push(this.parseReference(lv, Variable));
                            }
                        }
                    }
                    break;
                }
            case 'Variable':
                {
                    const variable = el = new Variable();
                    if (item.VariableType) {
                        variable.variableType = this.parseParameterType(item.VariableType[0]);
                        // <Constant/> inside <VariableType> — SC2 Editor format
                        if (item.VariableType[0].Constant) {
                            variable.isConstant = true;
                        }
                        // <ArraySize> inside <VariableType> — SC2 Editor array format
                        if (item.VariableType[0].ArraySize) {
                            variable.isArray = true;
                            variable.arraySizes = item.VariableType[0].ArraySize
                                .map((arrItem) => {
                                const attrs = arrItem?.$ ?? {};
                                const dim = Number(attrs.Dim ?? 0);
                                const value = attrs.Value !== undefined ? String(attrs.Value) : undefined;
                                let variableRef;
                                if (attrs.Type === 'Variable' && attrs.Id) {
                                    variableRef = this.parseReference({ $: attrs }, Variable);
                                }
                                return { dim, value, variable: variableRef };
                            })
                                .sort((a, b) => a.dim - b.dim);
                        }
                    }
                    // SC2 Editor uses <Value Type="Param" ...> for the initial value.
                    // Fall back to <InitialValue> for compatibility with other tools.
                    if (item.Value && item.Value[0]?.$) {
                        variable.initialValue = this.parseReference(item.Value[0], Param);
                    }
                    else if (item.InitialValue) {
                        variable.initialValue = this.parseReference(item.InitialValue[0], Param);
                    }
                    if (item.Array) {
                        variable.isArray = true;
                    }
                    if (item.Const) {
                        variable.isConstant = true;
                    }
                    break;
                }
            case 'Structure':
                {
                    const structure = el = new Structure();
                    if (item.Variable) {
                        for (const v of item.Variable) {
                            if (v.$.Type === 'Variable') {
                                structure.variables.push(this.parseReference(v, Variable));
                            }
                        }
                    }
                    break;
                }
            case 'Category':
                el = this.parseCategory(item);
                break;
            case 'Label':
                el = this.parseLabel(item);
                break;
            default:
                {
                    return undefined;
                }
        }
        if (item.Item) {
            el.items = this.parseItems(item);
        }
        if (item.Label) {
            el.label = this.parseReference(item.Label[0], Label);
        }
        if (item.Identifier) {
            el.name = item.Identifier[0];
        }
        return el;
    }
    parseItems(data) {
        const elItems = [];
        for (const itEntry of data.Item) {
            const cls = ElementClasses[itEntry.$.Type];
            if (!cls)
                continue;
            elItems.push(this.parseReference(itEntry, cls));
        }
        return elItems;
    }
    parseTree(data, container) {
        if (data.Root && data.Root[0].Item) {
            container.items = this.parseItems(data.Root[0]);
        }
        if (!data.Element)
            return;
        for (const item of data.Element) {
            const el = this.parseElement(item);
            if (el) {
                container.addElement(item.$.Id, el);
            }
        }
    }
    parseLibrary(id, data) {
        const lib = new Library(id);
        this.parseTree(data, lib);
        return lib;
    }
    constructor(container) {
        this.store = container;
    }
    loadXML(content) {
        return new Promise((resolve, reject) => {
            xml.parseString(content, (err, result) => {
                if (err) {
                    reject(err);
                }
                else {
                    try {
                        resolve(result.TriggerData);
                    }
                    catch (err) {
                        reject(err);
                    }
                }
            });
        });
    }
    /** Parse XML once so archive workspaces can cache the expensive xml2js result. */
    parseXML(content) {
        return this.loadXML(content);
    }
    /** Build and register a library from a parsed or cached TriggerData document. */
    buildLibrary(data) {
        const lib = this.parseLibrary(data.Standard[0].$.Id, data);
        this.store.addLibrary(lib);
        return lib;
    }
    /** Build libraries and optional root elements from parsed or cached TriggerData. */
    buildStore(data, onlyLibraries = false) {
        if (data.Library) {
            for (const item of data.Library) {
                const lib = this.parseLibrary(item.$.Id, item);
                this.store.addLibrary(lib);
            }
        }
        if (!onlyLibraries) {
            this.parseTree(data, this.store);
        }
        return this.store;
    }
    async loadLibrary(content) {
        return this.buildLibrary(await this.parseXML(content));
    }
    async load(content, onlyLibraries = false) {
        return this.buildStore(await this.parseXML(content), onlyLibraries);
    }
}
// export function forEachElement(element: Element) {
//     function visitElement()
// }
