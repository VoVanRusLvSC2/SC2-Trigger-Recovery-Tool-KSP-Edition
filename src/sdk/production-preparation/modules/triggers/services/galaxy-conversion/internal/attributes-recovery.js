import { SyntaxKind } from "@modkit/blizzard-starcraft2/galaxy/language-core";
const stringOf = (node) => {
  const item = node;
  if (item?.kind !== SyntaxKind.StringLiteral) return void 0;
  const raw = item.value ?? item.text;
  return raw === void 0 ? void 0 : raw.replace(/^"(.*)"$/su, "$1");
};
const unwrap = (node) => {
  let item = node;
  while (item?.kind === SyntaxKind.ParenthesizedExpression) item = item["expression"];
  return item;
};
const identifierName = (node) => {
  const item = unwrap(node);
  return item?.kind === SyntaxKind.Identifier && typeof item.name === "string" ? item.name : void 0;
};
function attributeCall(node, bound) {
  const call = unwrap(node);
  if (call?.kind === SyntaxKind.Identifier) return bound.get(String(call["name"]));
  if (call?.kind !== SyntaxKind.CallExpression) return void 0;
  const name = call["expression"]?.name;
  const type = name === "GameAttributeGameValue" ? "Global" : name === "GameAttributePlayerValue" ? "Player" : void 0;
  const id = stringOf(call["arguments"]?.[0]);
  if (type === void 0 || id === void 0 || id.length === 0) return void 0;
  const externalOwner = /^\[([^\]]+)\]/u.exec(id)?.[1];
  return { id, type, start: call["pos"], end: call["end"], ...externalOwner === void 0 ? {} : { externalOwner } };
}
function children(node) {
  const result = [];
  for (const [key2, value] of Object.entries(node)) {
    if (key2 === "parent" || key2 === "symbol" || key2 === "original" || key2 === "syntaxTokens") continue;
    if (Array.isArray(value)) {
      result.push(...value.filter((item) => item !== null && typeof item === "object" && typeof item.kind === "number"));
    } else if (value !== null && typeof value === "object" && typeof value.kind === "number") {
      result.push(value);
    }
  }
  return result;
}
function cloneBindings(bindings) {
  return new Map(bindings);
}
function sameBinding(left, right) {
  return left?.id === right?.id && left?.type === right?.type && left?.externalOwner === right?.externalOwner;
}
function recoverScope(statements, found, rawEvidence, diagnostics, functionName, sourceName, shadowed = /* @__PURE__ */ new Set(), options) {
  const bindings = /* @__PURE__ */ new Map();
  const resolveCall = (node, scope2) => {
    const item = unwrap(node);
    const name = identifierName(item?.["expression"]);
    if (item?.kind === SyntaxKind.CallExpression && name !== void 0 && (shadowed.has(name) || scope2.has(name))) return void 0;
    return attributeCall(node, scope2);
  };
  const note = (call, token) => {
    const record = {
      id: call.id,
      type: call.type,
      valueSetComplete: false,
      provenance: "galaxy-syntax",
      ...sourceName === void 0 ? {} : { sourceName },
      ...call.start === void 0 ? {} : { start: call.start },
      ...call.end === void 0 ? {} : { end: call.end },
      ...token === void 0 ? {} : { token },
      ...call.externalOwner === void 0 ? {} : { externalOwner: call.externalOwner },
      ...functionName === void 0 ? {} : { functionName }
    };
    rawEvidence.push(record);
    if (call.externalOwner !== void 0) {
      diagnostics.push({ code: "EXTERNAL_ATTRIBUTE", id: call.id, message: `Attribute ${call.id} belongs to external owner ${call.externalOwner}` });
      return;
    }
    const evidence = found.get(call.id) ?? { types: /* @__PURE__ */ new Set(), values: /* @__PURE__ */ new Set() };
    found.set(call.id, evidence);
    evidence.types.add(call.type);
    if (token !== void 0) {
      const normalized = options?.profile ? options.valueIdCodec(token) : void 0;
      if (normalized !== void 0) evidence.values.add(normalized);
    }
  };
  const expression = (node, scope2) => {
    if (node === null || typeof node !== "object") return;
    const item = node;
    if (item.kind === SyntaxKind.PrefixUnaryExpression || item.kind === SyntaxKind.PostfixUnaryExpression) {
      const operator = item["operator"]?.kind;
      expression(item["operand"], scope2);
      if (operator === SyntaxKind.PlusPlusToken || operator === SyntaxKind.MinusMinusToken) {
        const name = identifierName(item["operand"]);
        if (name !== void 0) scope2.delete(name);
      }
      return;
    }
    if (item.kind === SyntaxKind.CallExpression) {
      const direct = resolveCall(item, scope2);
      if (direct && item["expression"]?.name !== void 0) note(direct);
      for (const child of children(item)) expression(child, scope2);
      return;
    }
    if (item.kind === SyntaxKind.BinaryExpression) {
      const operator = item["operatorToken"]?.kind;
      const left = item["left"];
      const right = item["right"];
      if (operator !== void 0 && operator > SyntaxKind.EqualsToken && operator <= SyntaxKind.CaretEqualsToken) {
        expression(left, scope2);
        expression(right, scope2);
        const target = identifierName(left);
        if (target !== void 0) scope2.delete(target);
        return;
      }
      if (operator === SyntaxKind.AmpersandAmpersandToken || operator === SyntaxKind.BarBarToken) {
        expression(left, scope2);
        const alternative = cloneBindings(scope2);
        expression(right, alternative);
        for (const [name, binding] of scope2) if (!sameBinding(binding, alternative.get(name))) scope2.delete(name);
        return;
      }
      if (operator === SyntaxKind.EqualsToken) {
        expression(right, scope2);
        const target = identifierName(left);
        const source = resolveCall(right, scope2);
        if (target !== void 0) {
          if (source !== void 0) {
            scope2.set(target, source);
            note(source);
          } else scope2.delete(target);
        }
        return;
      }
      if (operator === SyntaxKind.EqualsEqualsToken || operator === SyntaxKind.ExclamationEqualsToken) {
        for (const [candidate, other] of [[left, right], [right, left]]) {
          const call = resolveCall(candidate, scope2);
          const token = stringOf(unwrap(other));
          if (call !== void 0) note(call, token);
        }
      }
    }
    for (const child of children(item)) expression(child, scope2);
  };
  const statement = (node, scope2) => {
    if (node === null || typeof node !== "object") return scope2;
    const item = node;
    if (item.kind === SyntaxKind.FunctionDeclaration) {
      const name = identifierName(item["name"]);
      const body = item["body"];
      if (body?.statements !== void 0) recoverScope(body.statements, found, rawEvidence, diagnostics, name, sourceName, shadowed, options);
      return scope2;
    }
    if (item.kind === SyntaxKind.Block) {
      let current = scope2;
      for (const child of item["statements"] ?? []) {
        current = statement(child, current);
        if (child.kind === SyntaxKind.ReturnStatement || child.kind === SyntaxKind.BreakStatement || child.kind === SyntaxKind.ContinueStatement) break;
      }
      return current;
    }
    if (item.kind === SyntaxKind.WhileStatement || item.kind === SyntaxKind.ForStatement || item.kind === SyntaxKind.DoStatement) {
      expression(item["initializer"], scope2);
      const condition = item.kind === SyntaxKind.ForStatement ? item["condition"] : item["expression"];
      expression(condition, scope2);
      if (item.kind !== SyntaxKind.DoStatement && unwrap(condition)?.kind === SyntaxKind.FalseKeyword) return scope2;
      const bodyScope = cloneBindings(scope2);
      bodyScope.clear();
      statement(item["statement"], bodyScope);
      expression(item["incrementor"], bodyScope);
      scope2.clear();
      return scope2;
    }
    if (item.kind === SyntaxKind.IfStatement) {
      expression(item["expression"], scope2);
      const before = cloneBindings(scope2);
      const thenScope = statement(item["thenStatement"], cloneBindings(before));
      const elseScope = item["elseStatement"] === void 0 ? before : statement(item["elseStatement"], cloneBindings(before));
      const merged = /* @__PURE__ */ new Map();
      for (const [name, binding] of thenScope) {
        const other = elseScope.get(name);
        if (sameBinding(binding, other)) merged.set(name, binding);
        else if (other !== void 0 || binding !== void 0) diagnostics.push({ code: "AMBIGUOUS_BINDING", id: binding.id, message: `Binding for ${name} differs across branches` });
      }
      return merged;
    }
    if (item.kind === SyntaxKind.VariableDeclaration) {
      const initializer = item["initializer"];
      expression(initializer, scope2);
      const name = identifierName(item["name"]);
      if (name !== void 0) {
        const source = resolveCall(initializer, scope2);
        if (source !== void 0) {
          scope2.set(name, source);
          note(source);
        } else scope2.delete(name);
      }
      return scope2;
    }
    if (item.kind === SyntaxKind.ExpressionStatement) {
      expression(item["expression"], scope2);
      return scope2;
    }
    for (const child of children(item)) {
      if (child.kind === SyntaxKind.Block || child.kind === SyntaxKind.IfStatement || child.kind === SyntaxKind.FunctionDeclaration) scope2 = statement(child, scope2);
      else expression(child, scope2);
    }
    return scope2;
  };
  let scope = bindings;
  for (const node of statements) scope = statement(node, scope);
}
const key = (id) => `Attribute${id.padStart(3, "0")}`;
function recoverAttributes(sources, gameStrings = "", options) {
  const found = /* @__PURE__ */ new Map();
  const evidence = [];
  const diagnostics = [];
  const shadowed = /* @__PURE__ */ new Set();
  for (const source of sources) for (const node of source.statements) {
    if (node.kind === SyntaxKind.FunctionDeclaration && node["body"]) {
      const name = identifierName(node["name"]);
      if (name !== void 0) shadowed.add(name);
    }
  }
  for (const source of sources) {
    if (source.parseDiagnostics?.length) {
      diagnostics.push({ code: "GALAXY_SYNTAX_INVALID", id: "", message: `Invalid Galaxy source: ${source.fileName ?? "unknown"}` });
      continue;
    }
    recoverScope(source.statements, found, evidence, diagnostics, void 0, source.fileName, shadowed, options);
  }
  if (found.size === 0) return evidence.length === 0 && diagnostics.length === 0 ? void 0 : { validation: "EVIDENCE_ONLY", document: { attributes: [], variants: [] }, inferred: [], evidence, diagnostics };
  const strings = new Set(gameStrings.split(/\r?\n/u).map((line) => (line.charCodeAt(0) === 65279 ? line.slice(1) : line).split("=")[0]));
  const inferred = [];
  const attributes = [...found].sort(([left], [right]) => Number(left) - Number(right)).map(([id, item]) => {
    const conflict = item.types.size > 1;
    if (conflict) diagnostics.push({ code: "ATTRIBUTE_TYPE_CONFLICT", id, message: `Attribute ${id} is observed as ${[...item.types].join("/")} in different scopes` });
    const type = conflict ? void 0 : [...item.types][0];
    const name = `${key(id)}/Name`;
    inferred.push(`${id}/Availability`, `${id}/Visibility`, `${id}/Access`, `${id}/Default`);
    inferred.push(`${id}/Value`);
    return {
      id,
      ...type === void 0 ? {} : { type },
      ...strings.has(name) ? { name } : {},
      values: [...item.values].sort((left, right) => Number(left) - Number(right)).map((value) => {
        const valueName = `${key(id)}/Value${value.padStart(3, "0")}/Name`;
        return { id: value, ...strings.has(valueName) ? { name: valueName } : {} };
      }),
      defaults: []
    };
  });
  inferred.push("DefaultVariants");
  return { validation: "EVIDENCE_ONLY", document: { attributes, variants: [] }, inferred, evidence, diagnostics };
}
export {
  recoverAttributes
};

//# sourceMappingURL=attributes-recovery.js.map
