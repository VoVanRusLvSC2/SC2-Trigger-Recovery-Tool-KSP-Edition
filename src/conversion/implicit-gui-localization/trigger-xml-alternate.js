import {editorTextBlockLines,normalizeSerializedInlineComments} from "../comment-owner-scope/editor-text-blocks.mjs";
import {guiTypeQualifiers} from "../../model/gui-type-qualifiers.mjs";
import { functionFlags } from "../../sdk/array-values/modules/triggers/shared/trigger-document/function-flags.js"
import { writeLosslessXml } from "../../sdk/array-values/modules/triggers/shared/trigger-document/lossless-xml.js"
import { parseTriggerXmlSync } from "./sax-reader-alternate.js"

const FLAG_TAGS = Object.freeze({
  Native: 'FlagNative',
  Action: 'FlagAction',
  Call: 'FlagCall',
  Event: 'FlagEvent',
  Template: 'Template',
  CustomScript: 'FlagCustomScript',
  Operator: 'FlagOperator',
  Inline: 'FlagInline',
  CustomAI: 'FlagCustomAI',
  SubFunctions: 'FlagSubFunctions',
  AllowBreak: 'FlagAllowBreak',
  Hidden: 'FlagHidden',
  NoScriptPrefix: 'FlagNoScriptPrefix',
  Deprecated: 'Deprecated',
  Internal: 'Internal',
  Restricted: 'FlagRestricted',
  CreateThread: 'FlagCreateThread',
  Condition: 'FlagCondition',
  NotYetImplemented: 'NotYetImplemented',
})

const text = value =>
  String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')

const attribute = value => text(value).replaceAll('"', '&quot;').replaceAll("'", '&apos;')

// A map document owns its elements without naming a library: references into
// the document itself carry no Library attribute, and the enclosing library is
// implicit. `serializeTriggerLibrary` sets this to the owning id for the length
// of one synchronous serialization so that every reference tag, at whatever
// depth, drops the attribute the editor would not have written.
let implicitLibraryScope

function refAttributes(ref, fallbackLibrary) {
  const implicitLibrary = implicitLibraryScope
  if (ref === undefined || ref === null || typeof ref !== 'object') return undefined
  const id = String(ref.id ?? '')
  if (id.length === 0) return undefined
  const typeName = String(ref.type ?? '')
  const named = String(ref.library ?? fallbackLibrary ?? '')
  const library = implicitLibrary !== undefined && named === implicitLibrary ? '' : named
  return [
    ...(typeName ? [`Type="${attribute(typeName)}"`] : []),
    ...(library ? [`Library="${attribute(library)}"`] : []),
    `Id="${attribute(id)}"`,
  ].join(' ')
}

// A <SubFunctionType> reference always names a SubFuncType element; the editor
// writes the attribute on every one of them, and a reference without it does
// not resolve, which orphans the calls that belong to that sub-function slot.
const IMPLIED_REF_TYPES = { SubFunctionType: 'SubFuncType' }

function refTag(name, ref, fallbackLibrary, indent = '      ') {
  const implied = IMPLIED_REF_TYPES[name]
  const attributes = refAttributes(
    implied !== undefined && ref !== null && typeof ref === 'object' && ref.type === undefined
      ? { ...ref, type: implied }
      : ref,
    fallbackLibrary,
  )
  return attributes === undefined ? [] : [`${indent}<${name} ${attributes}/>`]
}

function parameterTypeTag(name, value, fallbackLibrary, indent = '      ') {
  if (value === undefined || value === null || typeof value !== 'object') return []
  const children = []
  if (value.type !== undefined) {
    children.push(`${indent}  <Type Value="${attribute(value.type)}"/>`)
  }
  if (value.gameType !== undefined) {
    children.push(`${indent}  <GameType Value="${attribute(value.gameType)}"/>`)
  }
  if (value.variableType !== undefined) children.push(`${indent}  <VariableType Value="${attribute(value.variableType)}"/>`)
  for (const [tag,key] of Object.entries(guiTypeQualifiers)) {
    if (key === 'gameType' || key === 'variableType' || value[key] === undefined) continue
    children.push(`${indent}  <${tag} Value="${attribute(value[key])}"/>`)
  }
  children.push(...refTag('TypeElement', value.typeElement, fallbackLibrary, `${indent}  `))
  return children.length === 0 ? [] : [`${indent}<${name}>`, ...children, `${indent}</${name}>`]
}

// SC2 Editor reads ScriptCode only in the block layout it writes: a line break
// after <ScriptCode>, every code line indented four spaces past the tag, and
// </ScriptCode> on its own line (all 52,909 code lines of the 3,712 blocks in 418
// editor-authored Triggers files). Code on the tag line loads as empty: a Custom
// Script action compiles to nothing and loses its code on save, an Operator
// definition compiles to its bare argument list `(a b c)`. `scriptCodeFromBlock`
// in sax-reader.ts reads the layout back.
function scriptCodeTag(value, indent = '      ') {
  if (typeof value !== 'string' || value.length === 0) return []
  return [`${indent}<ScriptCode>`, ...value.split(/\r?\n/u).map(line => `${indent}    ${text(line)}`), `${indent}</ScriptCode>`]
}

function commonElementLines(element, libraryId) {
  const lines = []
  const identifier = element.identifier ?? (element.displayName === undefined ? element.name : undefined)
  if (identifier !== undefined && String(identifier).length > 0) {
    lines.push(`      <Identifier>${text(identifier)}</Identifier>`)
  }
  if (element.disabled === true) lines.push('      <Disabled/>')
  if (element.initOff === true) lines.push('      <InitOff/>')
  if (element.grammar !== undefined && element.grammarSource !== 'strings') lines.push(`      <Grammar>${text(element.grammar)}</Grammar>`)
  for (const flag of element.type === 'FunctionDef' ? functionFlags(element) : element.flags ?? []) {
    const tag = FLAG_TAGS[flag]
    if (tag !== undefined) lines.push(`      <${tag}/>`)
  }
  if (element.type === 'FunctionDef' && element.section !== undefined) {
    lines.push(element.section.length === 0
      ? '      <Section/>'
      : `      <Section Value="${attribute(element.section)}"/>`)
  }

  switch (element.type) {
    case 'Comment':
      if (element.comment !== undefined) lines.push(...editorTextBlockLines('Comment', element.comment))
      lines.push(...refTag('SubFunctionType', element.subFunctionType, libraryId))
      break
    case 'CustomScript':
      lines.push(...scriptCodeTag(element.scriptCode))
      if (element.initFunc !== undefined) lines.push(`      <InitFunc>${text(element.initFunc)}</InitFunc>`)
      break
    case 'SubFuncType':
      if (element.isAction) lines.push('      <Action/>')
      if (element.isEvent) lines.push('      <Event/>')
      lines.push(...refTag('FunctionDef', element.functionDef, libraryId))
      break
    case 'FunctionDef': {
      lines.push(...parameterTypeTag('ReturnType', element.returnType, libraryId))
      for (const ref of element.parameters ?? []) {
        lines.push(...refTag('Parameter', ref, libraryId))
      }
      for (const ref of element.subFunctionTypes ?? []) {
        lines.push(...refTag('SubFunctionType', ref, libraryId))
      }
      for (const ref of element.localVariables ?? []) {
        lines.push(...refTag('Variable', ref, libraryId))
      }
      // A function body is a list of <FunctionCall>; only a Trigger holds
      // <Action>. The editor does not read <Action> here, so every call in the
      // body reaches it unreferenced and is discarded as an orphan.
      for (const ref of element.actions ?? []) lines.push(...refTag('FunctionCall', ref, libraryId))
      lines.push(...scriptCodeTag(element.scriptCode))
      break
    }
    case 'FunctionCall': {
      lines.push(...refTag('FunctionDef', element.functionDef, libraryId))
      for (const ref of element.parameters ?? []) lines.push(...refTag('Parameter', ref, libraryId))
      for (const ref of element.subFunctions ?? []) {
        lines.push(...refTag('FunctionCall', ref, libraryId))
      }
      lines.push(...refTag('SubFunctionType', element.subFunctionType, libraryId))
      lines.push(...scriptCodeTag(element.scriptCode))
      break
    }
    case 'Param': {
      if (element.valueId !== undefined) lines.push(`      <ValueId Id="${attribute(element.valueId)}"/>`)
      if (element.valueTypeInfo !== undefined) lines.push(`      <ValueTypeInfo Value="${attribute(element.valueTypeInfo)}"/>`)
      if (element.customType !== undefined) lines.push(`      <CustomType Type="${attribute(element.customType)}"/>`)
      lines.push(...scriptCodeTag(element.scriptCode))
      lines.push(...refTag('ParameterDef', element.parameterDef, libraryId))
      if (element.expressionType !== undefined) lines.push(`      <ExpressionType Type="${attribute(element.expressionType)}"/>`)
      if (element.expressionText !== undefined) lines.push(`      <ExpressionText>${text(element.expressionText)}</ExpressionText>`)
      for (const ref of element.expressionParams ?? []) lines.push(...refTag('ExpressionParam', ref, libraryId))
      for (const ref of element.valueParams ?? []) lines.push(...refTag('ValueParam', ref, libraryId))
      if (element.valueType?.type !== undefined) {
        lines.push(`      <ValueType Type="${attribute(element.valueType.type)}"/>`)
      }
      if (element.valueType?.gameType !== undefined) {
        lines.push(`      <ValueGameType Type="${attribute(element.valueType.gameType)}"/>`)
      }
      if (element.value !== undefined) lines.push(`      <Value>${text(element.value)}</Value>`)
      lines.push(...refTag('FunctionCall', element.functionCall, libraryId))
      lines.push(...refTag('Preset', element.preset, libraryId))
      lines.push(...refTag('ValueElement', element.valueElement, libraryId))
      for (const ref of element.valuePresets ?? []) lines.push(...refTag('ValuePreset', ref, libraryId))
      lines.push(...refTag('StructMember', element.structMember, libraryId))
      lines.push(...refTag('Variable', element.variable, libraryId))
      if (Array.isArray(element.array)) {
        for (const ref of element.array) lines.push(...refTag('Array', ref, libraryId))
      } else {
        lines.push(...refTag('Array', element.array, libraryId))
      }
      lines.push(...refTag('Parameter', element.paramRef, libraryId))
      if (element.expressionCode !== undefined) lines.push(`      <ExpressionCode Value="${attribute(element.expressionCode)}"/>`)
      break
    }
    case 'ParamDef':
      lines.push(...parameterTypeTag('ParameterType', element.paramType, libraryId))
      // A preset selector is distinct from ParameterType's typeElement.
      for (const preset of element.presets ?? (element.preset ? [element.preset] : [])) lines.push(...refTag('Preset', preset, libraryId))
      lines.push(...refTag('Default', element.default, libraryId))
      if (element.isReference === true) lines.push('      <ParamFlagReference/>')
      if (element.isMultiple === true) lines.push('      <ParamFlagMultiple/>')
      if (element.isPreload === true) lines.push('      <ParamFlagPreload/>')
      if (element.isVariableOnly === true) lines.push('      <ParamFlagVariableOnly/>')
      if (element.isMatchConst === true) lines.push('      <ParamFlagMatchConst/>')
      if (element.isAltDisplay === true) lines.push('      <ParamFlagAltDisplay/>')
      break
    case 'Preset':
      if (element.integer) lines.push('      <PresetInteger/>')
      if (element.asBits) lines.push('      <PresetAsBits/>')
      if (element.generateIdentifier) lines.push('      <PresetGenIdentFunc/>')
      if (element.generateConstants) lines.push('      <PresetGenConstVar/>')
      if (element.baseType !== undefined) {
        lines.push(`      <BaseType Value="${attribute(element.baseType)}"/>`)
      }
      lines.push(...refTag('PresetExtends', element.extends, libraryId))
      for (const ref of element.values ?? []) lines.push(...refTag('Item', ref, libraryId))
      break
    case 'PresetValue':
      if (element.definesDefault === true) lines.push('      <DefinesDefault/>')
      if (element.value !== undefined) lines.push(`      <Value>${text(element.value)}</Value>`)
      break
    case 'Variable': {
      const variableType = parameterTypeTag('VariableType', element.variableType, libraryId)
      if (variableType.length > 0 && ((element.arraySizes?.length ?? 0) > 0 || element.isConstant === true)) {
        const variableTypeChildren = [
          ...(element.arraySizes ?? []).map(size => {
            const ref = refAttributes(size.variable, libraryId)
            const attributes = [
              `Dim="${attribute(size.dim ?? 0)}"`,
              ...(size.value === undefined ? [] : [`Value="${attribute(size.value)}"`]),
              ...(ref === undefined ? [] : [ref]),
            ].join(' ')
            return `        <ArraySize ${attributes}/>`
          }),
          // This is the editor's VariableType contract.  A historical
          // top-level <Const/> is accepted by our tolerant reader, but the SC2
          // editor ignores it and subsequently reports every use in an array
          // bound as non-constant.
          ...(element.isConstant === true ? ['        <Constant/>'] : []),
        ]
        variableType.splice(
          variableType.length - 1,
          0,
          ...variableTypeChildren,
        )
      }
      lines.push(...variableType)
      // The editor writes a variable's initial value as <Value Type="Param"/>;
      // <InitialValue> appears in no document it produces, and a variable
      // carrying one loses its initial value on load.
      lines.push(...refTag('Value', element.initialValue, libraryId))
      if (element.isArray === true && (element.arraySizes?.length ?? 0) === 0) {
        lines.push('      <Array/>')
      }
      break
    }
    case 'Trigger':
      for (const ref of element.events ?? []) lines.push(...refTag('Event', ref, libraryId))
      for (const ref of element.conditions ?? []) lines.push(...refTag('Condition', ref, libraryId))
      for (const ref of element.actions ?? []) lines.push(...refTag('Action', ref, libraryId))
      for (const ref of element.localVariables ?? []) {
        lines.push(...refTag('Variable', ref, libraryId))
      }
      break
    case 'Structure':
      for (const ref of element.variables ?? []) lines.push(...refTag('Variable', ref, libraryId))
      break
    case 'Category':
      for (const ref of element.items ?? []) lines.push(...refTag('Item', ref, libraryId))
      break
  }
  for (const extra of element.unknownXml ?? []) {
    if (extra === null || typeof extra !== 'object' || typeof extra.tag !== 'string' || extra.tag.length === 0) continue
    const attrs = Object.entries(extra.attributes ?? {}).map(([name, value]) => `${name}="${attribute(value)}"`).join(' ')
    const open = attrs.length === 0 ? `      <${extra.tag}` : `      <${extra.tag} ${attrs}`
    if (extra.text === undefined) lines.push(`${open}/>`)
    else lines.push(`${open}>${text(extra.text)}</${extra.tag}>`)
  }
  return lines
}

function elementKey(element) {
  return `${String(element.type ?? '')}:${String(element.id ?? '')}`
}

/** Localized names belong in the companion, never in authored code identifiers. */
export function serializeTriggerStrings(library) {
  const owner = library.implicit === true ? '' : `lib_${library.id}_`
  return Object.values(library.elements ?? {}).flatMap(element => {
    const name = element.displayName
    const line = (field, value) => `${element.type}/${field}/${owner}${element.id}=${String(value).replace(/[\r\n]/g, ' ')}`
    return [...(name === undefined ? [] : [line('Name', name)]), ...(element.grammarSource === 'strings' ? [line('Grammar', element.grammar)] : [])]
  }).join('\n')
}

export function normalizeTriggerLibrary(library) {
  const byType = {}
  for (const element of Object.values(library.elements ?? {})) {
    if (element === null || typeof element !== 'object') continue
    const typeName = String(element.type ?? '')
    const id = String(element.id ?? '')
    if (!typeName || !id) continue
    const typeMap = byType[typeName] ?? {}
    typeMap[id] = element
    byType[typeName] = typeMap
  }
  return { ...library, elementsByType: byType }
}

export function serializeTriggerLibrary(inputLibrary) {
  return normalizeSerializedInlineComments(serializeTriggerLibraryPreservingSource(inputLibrary), inputLibrary)
}

function serializeTriggerLibraryPreservingSource(inputLibrary) {
  const generated = serializeTriggerLibraryCanonical(inputLibrary)
  if (!inputLibrary.xmlSource) return generated
  const output = writeLosslessXml(inputLibrary.xmlSource, generated)
  if (generated !== inputLibrary.xmlSource.canonical) {
    // Validate the requested semantic state, not merely well-formed XML.
    const observed = parseTriggerXmlSync(output).get(inputLibrary.id)
    if (!observed || serializeTriggerLibraryCanonical(observed) !== generated) {
      throw new TypeError('LOSSLESS_SEMANTIC_ROUNDTRIP_MISMATCH')
    }
  }
  return output
}

export function serializeTriggerLibraryCanonical(inputLibrary) {
  const library = normalizeTriggerLibrary(inputLibrary)
  const libraryId = String(library.id ?? '')
  if (!/^[A-Za-z0-9_]+$/u.test(libraryId)) {
    throw new TypeError('Trigger library id must be an ASCII identifier')
  }
  const elements = Object.values(library.elements ?? {}).sort((left, right) =>
    elementKey(left).localeCompare(elementKey(right)),
  )
  const rootRefs = (library.items ?? []).map(item => ({
    type: item.type,
    library: item.library ?? libraryId,
    id: item.id,
  }))
  // A map keeps its trigger content directly under <TriggerData>; only a mod
  // declares <Library Id="...">. Emitting the wrapper for a map produces a
  // document the editor reads as a stray library instead of as the map's own
  // triggers, which is why such a map fails to open.
  const implicit = inputLibrary.implicit === true
  implicitLibraryScope = implicit ? libraryId : undefined
  try {
    // Keeping every XML line in one giant array is disproportionately costly:
    // a large map has millions of short strings in addition to the final XML.
    // Join bounded chunks as we go. The public API still returns one string,
    // so callers and byte-for-byte output stay unchanged.
    const chunks = []
    const lines = []
    let bufferedCharacters = 0
    const flush = () => {
      if (lines.length === 0) return
      chunks.push(lines.join(''))
      lines.length = 0
      bufferedCharacters = 0
    }
    const writeLine = line => {
      lines.push(line, '\n')
      bufferedCharacters += line.length + 1
      if (bufferedCharacters >= 1024 * 1024) flush()
    }
    writeLine('<?xml version="1.0" encoding="utf-8"?>')
    writeLine('<TriggerData>')
    if (!implicit) writeLine(`  <Library Id="${attribute(libraryId)}">`)
    writeLine('    <Root>')
    for (const ref of rootRefs) for (const line of refTag('Item', ref, libraryId, '      ')) writeLine(line)
    writeLine('    </Root>')
    for (const element of elements) {
      const id = String(element.id ?? '')
      const typeName = String(element.type ?? '')
      if (!id || !typeName) continue
      writeLine(`    <Element Type="${attribute(typeName)}" Id="${attribute(id)}">`)
      for (const line of commonElementLines(element, libraryId)) writeLine(line)
      writeLine('    </Element>')
    }
    if (!implicit) writeLine('  </Library>')
    writeLine('</TriggerData>')
    flush()
    return chunks.join('')
  } finally {
    implicitLibraryScope = undefined
  }
}

export function triggerLibraryTypeCounts(library) {
  const counts = {}
  for (const element of Object.values(library.elements ?? {})) {
    const typeName = String(element?.type ?? 'Unknown')
    counts[typeName] = (counts[typeName] ?? 0) + 1
  }
  return Object.fromEntries(
    Object.entries(counts).sort(([left], [right]) => left.localeCompare(right)),
  )
}

