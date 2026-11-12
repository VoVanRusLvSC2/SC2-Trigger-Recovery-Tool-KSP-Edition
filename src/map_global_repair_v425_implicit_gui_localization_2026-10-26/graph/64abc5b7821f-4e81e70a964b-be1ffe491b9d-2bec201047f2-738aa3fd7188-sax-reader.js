import {readEditorTextBlock} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v422_comment_owner_scope_2026-10-26/graph/43d9fa44f769-fa927e175e95-editor-text-blocks.mjs';
import {guiTypeQualifiers,retainedGuiType} from 'file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/trigger_ast_core/model/gui-type-qualifiers.mjs';
import sax from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/node_modules/sax/lib/sax.js";
import { serializeTriggerLibraryCanonical } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_global_repair_v425_implicit_gui_localization_2026-10-26/graph/ad0c3fc10329-24b39db09796-3fa60ba02de4-8b5d5013555c-667e8c11a224-trigger-xml.js";
import { xmlTree } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/lossless-xml.js";
import { parseTriggerStrings, applyTriggerStringsByType } from "file:///K:/SC2_MAP_Workspace/sc2_editor_C%2B%2B/map_build_validation_2026-10-01/bundle/modkit-extensions-blizzard/starcraft2-trigger-ast-array-values-2026-10-07/dist/modules/triggers/shared/trigger-document/trigger-strings.js";
function mkRef(a) {
  return { id: a.Id ?? a.id, library: a.Library ?? a.library ?? void 0, type: a.Type ?? a.type ?? void 0 };
}
function extractScriptCodeCatalogRefs(code, path) {
  const refs = [];
  const patterns = [
    { re: /(?:CreateUnit|UnitCreate|UnitTypeFromName|UnitTypeFromString)\s*\([^)]*"([^"]+)"/g, catalog: "Unit" },
    { re: /(?:TechTreeAbilityAdd|TechTreeAbilityRemove|AbilityCommand|AbilCreate)\s*\([^)]*"([^"]+)"/g, catalog: "Abil" },
    { re: /(?:ActorCreate|ActorFromName|ActorTypeFromName)\s*\([^)]*"([^"]+)"/g, catalog: "Actor" },
    { re: /(?:TechTreeUpgradeAdd|UpgradeCreate)\s*\([^)]*"([^"]+)"/g, catalog: "Upgrade" },
    { re: /(?:BehaviorAdd|BehaviorRemove)\s*\([^)]*"([^"]+)"/g, catalog: "Behavior" },
    { re: /(?:EffectCreate|EffectTypeFromName)\s*\([^)]*"([^"]+)"/g, catalog: "Effect" },
    { re: /(?:WeaponCreate|WeaponTypeFromName)\s*\([^)]*"([^"]+)"/g, catalog: "Weapon" }
  ];
  for (const { re, catalog } of patterns) {
    let m;
    while ((m = re.exec(code)) !== null) refs.push({ catalog, entry: m[1], path });
  }
  return refs;
}
function makeElementsByType() {
  return {
    FunctionDef: {},
    ParamDef: {},
    FunctionCall: {},
    Param: {},
    Variable: {},
    Trigger: {},
    Preset: {},
    PresetValue: {},
    Category: {},
    Label: {},
    Structure: {},
    SubFuncType: {},
    Comment: {},
    CustomScript: {}
  };
}
function scriptCodeFromBlock(raw) {
  const lines = raw.replace(/\r\n?/gu, "\n").split("\n");
  const indent = `${lines[lines.length - 1]}    `;
  const body = lines.slice(1, -1);
  if (lines.length < 3 || lines[0].trim() !== "" || indent.trim() !== "" || !body.every((line) => line.startsWith(indent) || line.trim() === "")) return raw;
  return body.map((line) => line.startsWith(indent) ? line.slice(indent.length) : "").join("\n");
}
function normalizeXml(xml, root) {
  const standard = root.children.find((node) => node.tag === "Standard");
  if (!standard) return xml;
  const id = standard.attributes.Id;
  if (!/^[A-Za-z0-9_]+$/u.test(id)) throw new TypeError("Invalid Standard library id");
  const direct = root.children.filter((node) => node.tag !== "Standard" && node.tag !== "Library");
  const embedded = root.children.filter((node) => node.tag === "Library");
  return `<TriggerData><Library Id="${id}">` + direct.map((node) => xml.slice(node.start, node.end)).join("") + "</Library>" + embedded.map((node) => xml.slice(node.start, node.end)).join("") + "</TriggerData>";
}
function freshEl(type, id, lib) {
  return {
    type,
    id,
    library: lib,
    unknownXml: [],
    flags: [],
    parameters: [],
    subFunctions: [],
    subFunctionTypes: [],
    actions: [],
    localVariables: [],
    events: [],
    conditions: [],
    structVars: [],
    values: [],
    valuePresets: [],
    expressionParams: [],
    valueParams: [],
    items: [],
    arrayRefs: [],
    isArray: false,
    isConstant: false,
    isReference: false,
    isMultiple: false,
    isPreload: false,
    isVariableOnly: false,
    isMatchConst: false,
    isAltDisplay: false,
    disabled: false,
    arraySizes: []
  };
}
function finalize(b) {
  const retainedFlags = b.type === "SubFuncType" ? b.flags.filter((flag) => flag !== "Action" && flag !== "Event") : b.flags;
  const base = { id: b.id, type: b.type, library: b.library, name: b.name, identifier: b.name, grammar: b.grammar, grammarSource: b.grammar === void 0 ? void 0 : "xml", disabled: b.disabled || void 0, flags: retainedFlags.length ? retainedFlags : void 0, unknownXml: b.unknownXml.length ? b.unknownXml : void 0 };
  const finPT = retainedGuiType;
  switch (b.type) {
    case "FunctionDef": {
      const flags = b.flags.length ? b.flags : void 0;
      const json = {
        ...base,
        type: "FunctionDef",
        scriptCode: b.scriptCode,
        parameters: b.parameters,
        returnType: finPT(b.returnType),
        flags,
        isSubFunction: b.flags.includes("SubFunctions"),
        isFuncAction: b.flags.includes("Action"),
        isFuncCall: b.flags.includes("Call"),
        subFunctionTypes: b.subFunctionTypes.length ? b.subFunctionTypes : void 0,
        actions: b.actions.length || !b.scriptCode && (b.flags.includes("Action") || b.flags.includes("Call")) && !b.flags.includes("Native") && !b.flags.includes("CustomScript") ? b.actions : void 0,
        localVariables: b.localVariables.length ? b.localVariables : void 0,
        section: b.section
      };
      if (b.scriptCode) {
        const refs = extractScriptCodeCatalogRefs(b.scriptCode, "scriptCode");
        if (refs.length) json.catalogRefs = refs;
      }
      return json;
    }
    case "SubFuncType":
      return { ...base, type: "SubFuncType", isAction: b.flags.includes("Action") || void 0, isEvent: b.flags.includes("Event") || void 0, functionDef: b.functionDef };
    case "FunctionCall":
      return {
        ...base,
        type: "FunctionCall",
        functionDef: b.functionDef,
        parameters: b.parameters.length ? b.parameters : void 0,
        subFunctions: b.subFunctions.length ? b.subFunctions : void 0,
        subFunctionType: b.subFunctionType,
        scriptCode: b.scriptCode
      };
    case "Param": {
      const json = {
        ...base,
        type: "Param",
        scriptCode: b.scriptCode,
        customType: b.paramCustomType,
        parameterDef: b.parameterDef,
        value: b.paramValue,
        valueId: b.paramValueId,
        valueTypeInfo: b.paramValueTypeInfo,
        expressionType: b.expressionType,
        expressionText: b.expressionText,
        expressionParams: b.expressionParams.length ? b.expressionParams : void 0,
        expressionCode: b.expressionCode,
        valueParams: b.valueParams.length ? b.valueParams : void 0,
        valueType: b.paramValueType ? { type: b.paramValueType, ...b.paramValueGameType ? { gameType: b.paramValueGameType } : {} } : void 0,
        functionCall: b.functionCall,
        preset: b.preset,
        valueElement: b.valueElement,
        valuePresets: b.valuePresets.length ? b.valuePresets : void 0,
        variable: b.variable,
        structMember: b.structMember,
        paramRef: b.paramRef,
        array: b.arrayRefs.length === 0 ? void 0 : b.arrayRefs.length === 1 ? b.arrayRefs[0] : b.arrayRefs
      };
      if (b.paramValueType && b.paramValue) {
        const vt = b.paramValueType.toLowerCase();
        if (vt === "gamelink" || vt === "anygamelink") {
          json.catalogRefs = [{ catalog: b.paramValueGameType ?? "unknown", entry: b.paramValue, path: "" }];
        }
      }
      return json;
    }
    case "ParamDef":
      return {
        ...base,
        type: "ParamDef",
        paramType: finPT(b.paramType) ?? { type: "unknown" },
        default: b.defaultRef,
        isReference: b.isReference || void 0,
        isMultiple: b.isMultiple || void 0,
        isPreload: b.isPreload || void 0,
        isVariableOnly: b.isVariableOnly || void 0,
        isMatchConst: b.isMatchConst || void 0,
        isAltDisplay: b.isAltDisplay || void 0,
        presets: b.presets,
        preset: b.presets?.length === 1 ? b.presets[0] : undefined
      };
    case "Preset":
      return {
        ...base,
        type: "Preset",
        baseType: b.baseType,
        values: b.values,
        generateConstants: b.generateConstants,
        generateIdentifier: b.generateIdentifier,
        integer: b.integer,
        asBits: b.asBits,
        ...b.presetExtends ? { extends: b.presetExtends } : {}
      };
    case "PresetValue":
      return {
        ...base,
        type: "PresetValue",
        value: b.presetValue,
        definesDefault: b.definesDefault || void 0
      };
    case "Variable":
      return {
        ...base,
        type: "Variable",
        variableType: finPT(b.variableType),
        initialValue: b.initialValue,
        isArray: b.isArray || void 0,
        isConstant: b.isConstant || void 0,
        arraySizes: b.arraySizes.length ? b.arraySizes : void 0
      };
    case "Trigger":
      return {
        ...base,
        type: "Trigger",
        initOff: b.initOff || void 0,
        events: b.events,
        conditions: b.conditions,
        actions: b.actions,
        localVariables: b.localVariables
      };
    case "Structure":
      return { ...base, type: "Structure", variables: b.structVars };
    case "Category":
      return { ...base, type: "Category", items: b.items };
    case "Label":
      return { ...base, type: "Label" };
    case "Comment":
      return { ...base, type: "Comment", comment: b.comment, subFunctionType: b.subFunctionType };
    case "CustomScript":
      return { ...base, type: "CustomScript", scriptCode: b.scriptCode, initFunc: b.initFunc };
    default:
      return void 0;
  }
}
function parseTriggerXmlSync(xmlContent) {
  const originalRoot = xmlTree(xmlContent);
  const xml = normalizeXml(xmlContent, originalRoot);
  const parser = sax.parser(true, { trim: false, normalize: false });
  const libraryMap = /* @__PURE__ */ new Map();
  let libId = null;
  let libElements = {};
  let libElementsByType = makeElementsByType();
  let libRootRefs = [];
  let el = null;
  let depth = 0;
  let libDepth = -1;
  let elDepth = -1;
  let rootDepth = -1;
  let libHasRoot = false;
  let childTag = null;
  let childIsRef = false;
  let inPTContainer = false;
  let textBuf = "";
  function activePT() {
    if (!el) return {};
    if (childTag === "ReturnType") return el.returnType ?? (el.returnType = {});
    if (childTag === "VariableType") return el.variableType ?? (el.variableType = {});
    return el.paramType ?? (el.paramType = {});
  }
  function emitLibrary() {
    if (!libId) return;
    const items = [];
    for (const ref of libRootRefs) {
      if (!ref.type) continue;
      const typeMap = libElementsByType[ref.type];
      const found = typeMap?.[ref.id];
      if (found) items.push(found);
    }
    libraryMap.set(libId, {
      id: libId,
      items,
      elements: libElements,
      elementsByType: libElementsByType,
      rootRefs: libRootRefs.slice(),
      hasRoot: libHasRoot
    });
  }
  function startLibrary(id) {
    if (libId) emitLibrary();
    libId = id;
    libElements = {};
    libElementsByType = makeElementsByType();
    libRootRefs = [];
    libHasRoot = false;
  }
  function registerEl(json) {
    const key = `${json.type}:${json.id}`;
    if (!libElements[key]) libElements[key] = json;
    const tmap = libElementsByType[json.type];
    if (tmap && !tmap[json.id]) tmap[json.id] = json;
  }
  parser.onopentag = (node) => {
    depth++;
    const name = node.name;
    const attrs = node.attributes;
    textBuf = "";
    if (name === "Library" && (libDepth < 0 ? depth === 2 : depth === libDepth)) {
      startLibrary(attrs.Id ?? attrs.id);
      libDepth = depth;
      return;
    }
    if (!libId) return;
    if (name === "Root" && depth === libDepth + 1) {
      rootDepth = depth;
      libHasRoot = true;
      return;
    }
    if (rootDepth >= 0 && name === "Item" && depth === rootDepth + 1) {
      libRootRefs.push(mkRef(attrs));
      return;
    }
    if (name === "Element" && depth === libDepth + 1) {
      el = freshEl(attrs.Type ?? attrs.type, attrs.Id ?? attrs.id, libId);
      elDepth = depth;
      childTag = null;
      childIsRef = false;
      inPTContainer = false;
      return;
    }
    if (!el) return;
    const rel = depth - elDepth;
    if (rel === 1) {
      childTag = name;
      childIsRef = !!(attrs.Id ?? attrs.id);
      inPTContainer = name === "ReturnType" || name === "VariableType" || name === "ParameterType";
      const FLAG = {
        FlagNative: "Native",
        FlagAction: "Action",
        FlagCall: "Call",
        FlagEvent: "Event",
        Template: "Template",
        FlagCustomScript: "CustomScript",
        FlagOperator: "Operator",
        FlagInline: "Inline",
        FlagCustomAI: "CustomAI",
        FlagSubFunctions: "SubFunctions",
        FlagAllowBreak: "AllowBreak",
        FlagHidden: "Hidden",
        FlagNoScriptPrefix: "NoScriptPrefix",
        Deprecated: "Deprecated",
        Internal: "Internal",
        FlagRestricted: "Restricted",
        FlagCreateThread: "CreateThread",
        FlagCondition: "Condition",
        NotYetImplemented: "NotYetImplemented"
      };
      if (FLAG[name]) {
        el.flags.push(FLAG[name]);
        return;
      }
      if (name === "Disabled") {
        el.disabled = true;
        return;
      }
      if (name === "InitOff") {
        el.initOff = true;
        return;
      }
      if (el.type === "SubFuncType" && name === "Action") {
        el.flags.push("Action");
        return;
      }
      if (el.type === "SubFuncType" && name === "Event") {
        el.flags.push("Event");
        return;
      }
      if (el.type === "Preset" && name === "PresetGenConstVar") {
        el.generateConstants = true;
        return;
      }
      if (el.type === "Preset" && name === "PresetGenIdentFunc") {
        el.generateIdentifier = true;
        return;
      }
      if (el.type === "Preset" && name === "PresetInteger") {
        el.integer = true;
        return;
      }
      if (el.type === "Preset" && name === "PresetAsBits") {
        el.asBits = true;
        return;
      }
      if (el.type === "PresetValue" && name === "DefinesDefault") {
        el.definesDefault = true;
        return;
      }
      if (name === "ParamFlagReference") {
        el.isReference = true;
        return;
      }
      if (name === "ParamFlagMultiple") {
        el.isMultiple = true;
        return;
      }
      if (name === "ParamFlagPreload") {
        el.isPreload = true;
        return;
      }
      if (name === "ParamFlagVariableOnly") {
        el.isVariableOnly = true;
        return;
      }
      if (name === "ParamFlagMatchConst") {
        el.isMatchConst = true;
        return;
      }
      if (name === "ParamFlagAltDisplay") {
        el.isAltDisplay = true;
        return;
      }
      if (name === "Const") {
        el.isConstant = true;
        return;
      }
      if (name === "Section") {
        el.section = attrs.Value ?? attrs.value ?? "";
        return;
      }
      const knownDirect = /* @__PURE__ */ new Set([
        "Identifier",
        "Disabled",
        "InitOff",
        "Grammar",
        "ScriptCode",
        "ExpressionText",
        "Comment",
        "InitFunc",
        "Value",
        "ReturnType",
        "VariableType",
        "ParameterType",
        "FunctionDef",
        "ParameterDef",
        "Preset",
        "PresetExtends",
        "ValueElement",
        "ValuePreset",
        "ExpressionParam",
        "ValueParam",
        "StructMember",
        "Default",
        "Event",
        "Condition",
        "Variable",
        "FunctionCall",
        "Action",
        "Parameter",
        "SubFunctionType",
        "Item",
        "InitialValue",
        "Array",
        "BaseType",
        "ValueType",
        "ExpressionType",
        "ExpressionCode",
        "ValueId",
        "ValueTypeInfo",
        "CustomType",
        "ValueGameType",
        "TypeElement",
        "Constant",
        "ArraySize"
      ]);
      if (!knownDirect.has(name)) {
        const rawAttributes = {};
        for (const [key, value] of Object.entries(attrs)) {
          if (typeof value === "string") rawAttributes[key] = value;
        }
        el.unknownXml.push({
          tag: name,
          ...Object.keys(rawAttributes).length === 0 ? {} : { attributes: rawAttributes },
          position: el.unknownXml.length
        });
        return;
      }
      if (name === "Array") {
        if (childIsRef) el.arrayRefs.push(mkRef(attrs));
        else el.isArray = true;
        return;
      }
      if (name === "BaseType") {
        if (attrs.Value ?? attrs.value) el.baseType = attrs.Value ?? attrs.value;
        return;
      }
      if (name === "ValueType") {
        if (attrs.Type ?? attrs.type) el.paramValueType = attrs.Type ?? attrs.type;
        return;
      }
      if (name === "ExpressionType") {
        if (attrs.Type ?? attrs.type) el.expressionType = attrs.Type ?? attrs.type;
        return;
      }
      if (name === "ExpressionCode") {
        el.expressionCode = attrs.Value ?? attrs.value;
        return;
      }
      if (name === "ValueId") {
        el.paramValueId = attrs.Id ?? attrs.id;
        return;
      }
      if (name === "ValueTypeInfo") {
        el.paramValueTypeInfo = attrs.Value ?? attrs.value;
        return;
      }
      if (name === "CustomType") {
        el.paramCustomType = attrs.Type ?? attrs.type;
        return;
      }
      if (name === "ValueGameType") {
        if (attrs.Type ?? attrs.type) el.paramValueGameType = attrs.Type ?? attrs.type;
        return;
      }
      if (!childIsRef) return;
      switch (name) {
        case "FunctionDef":
          el.functionDef = mkRef(attrs);
          break;
        case "ParameterDef":
          el.parameterDef = mkRef(attrs);
          break;
        case "Preset":
          if (el.type === "ParamDef") (el.presets ??= []).push(mkRef(attrs));
          else el.preset = mkRef(attrs);
          break;
        case "PresetExtends":
          el.presetExtends = mkRef(attrs);
          break;
        case "ValueElement":
          el.valueElement = mkRef(attrs);
          break;
        case "ValuePreset":
          el.valuePresets.push(mkRef(attrs));
          break;
        case "ExpressionParam":
          el.expressionParams.push(mkRef(attrs));
          break;
        case "ValueParam":
          el.valueParams.push(mkRef(attrs));
          break;
        case "StructMember":
          el.structMember = mkRef(attrs);
          break;
        case "Default":
          el.defaultRef = mkRef(attrs);
          break;
        case "Event":
          el.events.push(mkRef(attrs));
          break;
        case "Condition":
          el.conditions.push(mkRef(attrs));
          break;
        case "Variable": {
          const vt = attrs.Type ?? attrs.type;
          if (el.type === "Trigger" && vt === "Variable") el.localVariables.push(mkRef(attrs));
          else if (el.type === "Structure" && vt === "Variable") el.structVars.push(mkRef(attrs));
          else if (el.type === "FunctionDef") el.localVariables.push(mkRef(attrs));
          else el.variable = mkRef(attrs);
          break;
        }
        case "FunctionCall":
          if (el.type === "FunctionDef") el.actions.push(mkRef(attrs));
          else if (el.type === "FunctionCall") el.subFunctions.push(mkRef(attrs));
          else el.functionCall = mkRef(attrs);
          break;
        case "Action":
          el.actions.push(mkRef(attrs));
          break;
        case "Parameter": {
          const t = attrs.Type ?? attrs.type;
          if (t === "Comment") break;
          if (t === "ParamDef" && el.type === "Param") el.paramRef = mkRef(attrs);
          else el.parameters.push(mkRef(attrs));
          break;
        }
        case "SubFunctionType": {
          const sfRef = {
            library: attrs.Library ?? attrs.library ?? "",
            id: attrs.Id ?? attrs.id ?? "",
            type: attrs.Type ?? attrs.type ?? "SubFuncType"
          };
          if (el.type === "FunctionDef") el.subFunctionTypes.push(sfRef);
          else el.subFunctionType = sfRef;
          break;
        }
        case "Item": {
          const t = attrs.Type ?? attrs.type;
          if (t === "PresetValue") el.values.push(mkRef(attrs));
          else el.items.push(mkRef(attrs));
          break;
        }
        case "Value":
          if (el.type === "Variable") el.initialValue = mkRef(attrs);
          break;
        case "InitialValue":
          el.initialValue = mkRef(attrs);
          break;
      }
      return;
    }
    if (rel === 2 && inPTContainer) {
      const pt = activePT();
      const qualifier = guiTypeQualifiers[name];
      if (qualifier) { pt[qualifier] = attrs.Value ?? attrs.value; return; }
      switch (name) {
        case "Type":
          pt.type = attrs.Value ?? attrs.value;
          break;
        case "GameType":
          pt.gameType = attrs.Value ?? attrs.value;
          break;
        case "VariableType":
          pt.variableType = attrs.Value ?? attrs.value;
          break;
        case "TypeElement":
          pt.typeElement = mkRef(attrs);
          break;
        case "Constant":
          el.isConstant = true;
          break;
        case "ArraySize": {
          el.isArray = true;
          const dim = Number(attrs.Dim ?? attrs.dim ?? 0);
          const val = attrs.Value ?? attrs.value ?? void 0;
          const varRef = (attrs.Type === "Variable" || attrs.type === "Variable") && (attrs.Id ?? attrs.id) ? mkRef(attrs) : void 0;
          el.arraySizes.push({ dim, value: val, variable: varRef });
          break;
        }
      }
    }
  };
  parser.onclosetag = (tagName) => {
    const rel = depth - elDepth;
    if (el && rel === 1 && childTag === tagName) {
      const text = textBuf;
      textBuf = "";
      switch (tagName) {
        case "Identifier":
          el.name = text || void 0;
          break;
        case "Grammar":
          el.grammar = text;
          break;
        case "ScriptCode":
          el.scriptCode = scriptCodeFromBlock(text) || void 0;
          break;
        case "ExpressionText":
          el.expressionText = text;
          break;
        case "Comment":
          el.comment = readEditorTextBlock(text);
          break;
        case "InitFunc":
          el.initFunc = text.trim() || void 0;
          break;
        case "Value":
          if (!childIsRef) {
            if (el.type === "PresetValue") el.presetValue = text;
            else el.paramValue = text;
          }
          break;
        default: {
          const extra = [...el.unknownXml].reverse().find((item) => item.tag === tagName && item.text === void 0);
          if (extra !== void 0 && text.length > 0) extra.text = text;
          break;
        }
      }
      childTag = null;
      childIsRef = false;
      inPTContainer = false;
    }
    if (el && rel === 0 && tagName === "Element") {
      const json = finalize(el);
      if (json) registerEl(json);
      el = null;
      elDepth = -1;
    }
    if (tagName === "Root" && depth === rootDepth) rootDepth = -1;
    if (libId && tagName === "Library" && depth === libDepth) {
      emitLibrary();
      libId = null;
      libDepth = -1;
    }
    depth--;
  };
  parser.ontext = (text) => {
    if (el) textBuf += text;
  };
  parser.oncdata = (text) => {
    if (el) textBuf += text;
  };
  parser.write(xml).close();
  if (libId) emitLibrary();
  const standard = originalRoot.children.find((node) => node.tag === "Standard");
  for (const library of libraryMap.values()) {
    if (standard?.attributes.Id === library.id) library.implicit = true;
    let raw = xmlContent;
    if (libraryMap.size > 1 && !library.implicit) {
      const node = originalRoot.children.find((node2) => node2.tag === "Library" && node2.attributes.Id === library.id);
      if (!node) continue;
      raw = "<TriggerData>" + xmlContent.slice(node.start, node.end) + "</TriggerData>";
    }
    library.xmlSource = { raw, canonical: serializeTriggerLibraryCanonical(library) };
  }
  return libraryMap;
}
function buildResult(library) {
  const refsByElement = /* @__PURE__ */ new Map();
  const allRefs = [];
  for (const el of Object.values(library.elements)) {
    const refs = el.catalogRefs;
    if (refs?.length) {
      refsByElement.set(el.id, refs);
      allRefs.push(...refs);
    }
  }
  return { library, refsByElement, allRefs };
}
function applyStrings(result, triggerStrings) {
  const libId = result.library.id;
  result.library.triggerStringsLoaded = true;
  const strings = parseTriggerStrings(triggerStrings);
  result.library.paramValuesLoaded = [...strings.keys()].some((key) => key.startsWith("ParamValue:"));
  applyTriggerStringsByType(libId, result.library.elementsByType, strings);
  const libName = strings.get(`Library:${libId}`) ?? strings.get(`Library/Name/${libId}`);
  if (libName) result.library.name = libName;
  const sfNames = {};
  for (const [key, name] of strings) {
    if (key.startsWith("SubFuncType:")) sfNames[key.slice("SubFuncType:".length)] = name;
  }
  if (Object.keys(sfNames).length > 0) result.library.subFuncTypeNames = sfNames;
}
async function readTriggerLibraryFast(xmlContent, triggerStringsContent) {
  const libs = parseTriggerXmlSync(xmlContent);
  if (libs.size === 0) throw new Error("No libraries found in trigger XML");
  const [, library] = libs.entries().next().value;
  const result = buildResult(library);
  if (triggerStringsContent !== void 0) applyStrings(result, triggerStringsContent);
  return result;
}
async function readTriggerLibrariesFast(xmlContents, triggerStringsMap) {
  const results = /* @__PURE__ */ new Map();
  for (const xml of xmlContents) {
    for (const [libId, library] of typeof xml === "string" ? parseTriggerXmlSync(xml) : xml) {
      const result = buildResult(library);
      if (triggerStringsMap?.has(libId)) applyStrings(result, triggerStringsMap.get(libId));
      results.set(libId, result);
    }
  }
  return results;
}
export {
  parseTriggerXmlSync,
  readTriggerLibrariesFast,
  readTriggerLibraryFast,
  scriptCodeFromBlock
};

//# sourceMappingURL=sax-reader.js.map
