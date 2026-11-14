import { generateId } from './g2t-core-alternate-3.mjs';
import {
  conversionError,
  decodePayload,
  encodePayload,
  lookupElement,
  refKey,
} from '../../sdk/literal-native/modules/triggers/services/galaxy-conversion/internal/conversion-model.js';
const marker = '// @modkit-editor-layout ';
/** Section banners the editor's Galaxy generator emits for a map or library. */
const GENERATED_SECTIONS = new Set([
  'Generated Map Script',
  'Generated Library Script',
  'Library Initialization',
  'Map Initialization',
  'Global Variables',
  'Global Function Declarations',
  'Global Functions',
  'Global Structures',
  'Global Presets',
  'Custom Script',
  'Trigger Variables',
  'Trigger Functions',
  'Trigger Initialization',
  // Banners the generator writes inside a trigger or function body.
  'Variable Declarations',
  'Variable Initialization',
  'Implementation',
  'Events',
  'Conditions',
  'Actions',
]);
/** A comment the generator writes inside a body (`// Implementation`, `// Actions` …), not an authored one. */
export function isGeneratedBodyBanner(text) {
  return (
    GENERATED_SECTIONS.has(text) ||
    text === 'Automatic Variable Declarations' ||
    text.startsWith('@modkit-editor-layout ')
  );
}
/** Comment elements an action list refers to: they are written in place, not in the layout marker. */
function commentsInActions(library) {
  const found = new Set();
  for (const element of Object.values(library.elements)) {
    if (element.type === 'Category') continue;
    for (const value of Object.values(element)) {
      if (!Array.isArray(value)) continue;
      for (const item of value) if (item?.type === 'Comment') found.add(refKey(item, library.id));
    }
  }
  return found;
}
/**
 * The editor does not infer a folder hierarchy from Galaxy declarations.
 * When there is no saved layout marker, provide one deterministic, semantic
 * root layout rather than leaving every reconstructed symbol at the root.
 */
const isAction = (e) => e.flags?.includes('Action') || e.isFuncAction === true;
// Boolean Call definitions are conditions even before XML role flags are serialized.
const isCondition = (e) =>
  e.flags?.includes('Condition') ||
  e.isFuncCondition === true ||
  ((e.flags?.includes('Call') || e.isFuncCall === true) && e.returnType?.type === 'bool');
const STANDARD_FOLDERS = [
  {
    name: 'Constants',
    matches: (element) =>
      element.type === 'Preset' || (element.type === 'Variable' && element.isConstant === true),
  },
  { name: 'Structs', matches: (element) => element.type === 'Structure' },
  {
    name: 'Variables',
    matches: (element) => element.type === 'Variable' && element.isConstant !== true,
  },
  {
    name: 'Functions',
    matches: (element) =>
      element.type === 'FunctionDef' && !isAction(element) && !isCondition(element),
  },
  {
    name: 'Conditions',
    matches: (element) =>
      element.type === 'FunctionDef' && !isAction(element) && isCondition(element),
  },
  {
    name: 'Actions',
    matches: (element) =>
      element.type === 'FunctionDef' &&
      (element.flags?.includes('Action') || element.isFuncAction === true),
  },
  { name: 'Triggers', matches: (element) => element.type === 'Trigger' },
];
function standardFolderLayout(library, roots) {
  const reference = (element) => ({ type: element.type, library: library.id, id: element.id });
  const folders = STANDARD_FOLDERS.map((folder) => {
    // Categories are editor-facing layout objects, not executable Galaxy
    // symbols. Keep an explicit Identifier so a companion TriggerStrings
    // lookup cannot suppress their standard folder title.
    const category = {
      type: 'Category',
      id: generateId(),
      library: library.id,
      name: folder.name,
      identifier: folder.name,
      displayName: folder.name,
      items: [],
    };
    library.elements[category.id] = category;
    return { folder, category: category };
  });
  const semanticRoots = [];
  const layoutCategories = new Set();
  const visit = (root, active) => {
    const element = lookupElement([library], root, library.id);
    if (!element) return;
    if (element.type === 'Category') {
      const key = refKey(element, library.id);
      if (active.has(key)) return conversionError('LAYOUT_CYCLE', 'Cyclic editor folder structure');
      layoutCategories.add(element.id);
      active.add(key);
      for (const child of element.items) visit(child, active);
      active.delete(key);
      return;
    }
    semanticRoots.push(root);
  };
  for (const root of roots) visit(root, new Set());
  const leftovers = [];
  for (const root of semanticRoots) {
    const element = lookupElement([library], root, library.id);
    const destination = element && folders.find((candidate) => candidate.folder.matches(element));
    if (destination) destination.category.items.push(root);
    else leftovers.push(root);
  }
  // Categories reconstructed from generated section banners have been replaced
  // by the deterministic semantic folders; retaining them would serialize
  // orphaned XML elements that the editor subsequently removes.
  for (const id of layoutCategories) delete library.elements[id];
  const populated = folders.filter(({ category }) => category.items.length > 0);
  for (const { category } of folders)
    if (category.items.length === 0) delete library.elements[category.id];
  return [...populated.map(({ category }) => reference(category)), ...leftovers];
}
function isStandardFolderLayout(library) {
  let previous = -1;
  let folders = 0;
  for (const item of library.items) {
    const root = lookupElement([library], item, library.id);
    if (root?.type !== 'Category') continue;
    const index = STANDARD_FOLDERS.findIndex((folder) => folder.name === root.name);
    if (index < 0 || index <= previous) return false;
    const folder = STANDARD_FOLDERS[index];
    if (
      !root.items.length ||
      !root.items.every((child) => {
        const element = lookupElement([library], child, library.id);
        return !!element && folder.matches(element);
      })
    )
      return false;
    previous = index;
    folders++;
  }
  return folders > 0;
}
export function editorLayoutComment(library, symbol) {
  // The default root layout is reconstructible from ordinary generated Galaxy,
  // so do not inject a marker that would make an otherwise unchanged script
  // differ after a TriggerData round-trip.
  if (isStandardFolderLayout(library)) return '';
  if (
    !Object.values(library.elements).some(
      (e) => e.type === 'Category' || e.type === 'Label' || e.type === 'Comment',
    )
  )
    return '';
  const active = new Set();
  const comments = new Set();
  const convert = (ref, depth) => {
    if (depth > 128)
      conversionError('LAYOUT_DEPTH', 'Editor folder nesting exceeds the conversion limit');
    const element = lookupElement([library], ref, library.id);
    if (!element) return undefined;
    if (element.type === 'Label') return { type: 'Label', name: element.name };
    if (element.type === 'Comment') {
      comments.add(refKey(element, library.id));
      return { type: 'Comment', name: element.name, comment: element.comment };
    }
    if (element.type === 'Category') {
      const key = refKey(element, library.id);
      if (active.has(key)) conversionError('LAYOUT_CYCLE', 'Cyclic editor folder structure');
      active.add(key);
      const items = element.items
        .map((child) => convert(child, depth + 1))
        .filter((item) => !!item);
      active.delete(key);
      return { type: 'Category', name: element.name, items };
    }
    const name = symbol(element);
    return name ? { type: 'symbol', name } : undefined;
  };
  const items = library.items.map((ref) => convert(ref, 0)).filter((item) => !!item);
  // Action IDs change during reconstruction. Preserve their comment text as
  // editor annotations even when its original action position cannot be recovered.
  // A comment an action list holds is also written where it stands; the reader
  // restores it from here only when it did not find it there (a comment alone in
  // an otherwise empty branch leaves no statement to stand before).
  const inActions = commentsInActions(library);
  for (const element of Object.values(library.elements))
    if (element.type === 'Comment' && !comments.has(refKey(element, library.id))) {
      items.push({
        type: 'Comment',
        name: element.name,
        comment: element.comment,
        ...(inActions.has(refKey(element, library.id)) ? { inAction: true } : {}),
      });
    }
  return marker + encodePayload(JSON.stringify({ version: 1, items })) + '\n';
}
/** Folders for other Galaxy files of the document converted together with its
 *  script: every top-level definition of a file moves under a Category named
 *  after the file, out of the root and out of any folder the layout gave it. */
export function placeAdditionalScriptFolders(library, files, symbols) {
  for (const file of files ?? []) {
    const refs = [...new Set(file.names)].map((name) => symbols.get(name)).filter((ref) => !!ref);
    if (!refs.length) continue;
    const keys = new Set(refs.map((ref) => refKey(ref, library.id)));
    library.items = library.items.filter((item) => !keys.has(refKey(item, library.id)));
    for (const element of Object.values(library.elements)) {
      if (element.type === 'Category')
        element.items = element.items.filter((item) => !keys.has(refKey(item, library.id)));
    }
    const id = generateId();
    library.elements[id] = {
      type: 'Category',
      id,
      library: library.id,
      name: file.fileName,
      identifier: file.fileName,
      displayName: file.fileName,
      items: refs,
    };
    library.items.push({ type: 'Category', library: library.id, id });
  }
}
export function restoreEditorLayout(source, library, symbols) {
  const text = source.text ?? source.__sourceText ?? '';
  const comments = [...source.commentsLineMap.values()].map((token) => ({
    line: token.line,
    pos: token.pos,
    text: text.slice(token.pos, token.end).trim(),
  }));
  const annotated = comments.find((comment) => comment.text.startsWith(marker));
  const used = new Set();
  let hasExplicitSections = false;
  let generatedScript = false;
  // A generated Galaxy file commonly has a function prototype in its header
  // and the implementation in its body. Both parse to the same editor symbol;
  // a TriggerData folder may own an element only once.
  const placed = new Set();
  const reference = (element) => ({ type: element.type, library: library.id, id: element.id });
  // Comments already read back in place, by text: a marker comment from an action list is restored only once missing.
  const readInPlace = new Map();
  const inActions = commentsInActions(library);
  for (const element of Object.values(library.elements)) {
    if (element.type === 'Comment' && inActions.has(refKey(element, library.id)))
      readInPlace.set(element.comment ?? '', (readInPlace.get(element.comment ?? '') ?? 0) + 1);
  }
  const restore = (item, depth) => {
    if (depth > 128 || !item || typeof item !== 'object')
      return conversionError('LAYOUT_DATA', 'Invalid editor layout comment');
    if (item.type === 'symbol') {
      const ref = symbols.get(item.name);
      if (ref) used.add(refKey(ref, library.id));
      return ref;
    }
    if (item.type !== 'Category' && item.type !== 'Label' && item.type !== 'Comment')
      return conversionError('LAYOUT_DATA', 'Unknown editor layout item');
    if (item.name !== undefined && typeof item.name !== 'string')
      return conversionError('LAYOUT_DATA', 'Editor layout name must be text');
    if (item.type === 'Comment' && item.comment !== undefined && typeof item.comment !== 'string')
      return conversionError('LAYOUT_DATA', 'Editor comment must be text');
    if (item.type === 'Comment' && item.inAction === true) {
      const left = readInPlace.get(item.comment ?? '') ?? 0;
      if (left > 0) {
        readInPlace.set(item.comment ?? '', left - 1);
        return undefined;
      }
    }
    const id = generateId();
    const element =
      item.type === 'Category'
        ? {
            type: 'Category',
            id,
            library: library.id,
            name: item.name,
            items: item.items.map((child) => restore(child, depth + 1)).filter((ref) => !!ref),
          }
        : item.type === 'Comment'
          ? { type: 'Comment', id, library: library.id, name: item.name, comment: item.comment }
          : { type: 'Label', id, library: library.id, name: item.name };
    library.elements[id] = element;
    return reference(element);
  };
  let roots = [];
  if (annotated) {
    let data;
    try {
      data = JSON.parse(decodePayload(annotated.text.slice(marker.length)));
    } catch {
      return conversionError('LAYOUT_DATA', 'Invalid encoded editor layout comment');
    }
    if (data.version !== 1 || !Array.isArray(data.items))
      return conversionError('LAYOUT_DATA', 'Unsupported editor layout comment');
    roots = data.items.map((item) => restore(item, 0)).filter((ref) => !!ref);
  } else {
    // Explicit three-line section banners are evidence of a category. With no
    // banner, preserve comment text as labels without inventing a folder hierarchy.
    const content = comments.map((comment) => ({
      ...comment,
      value: comment.text.replace(/^\/\/\s?/u, '').trim(),
    }));
    const separator = (value) => /^[-=*/]{4,}$/u.test(value);
    // The editor's generator banners every section it emits and heads each
    // trigger with "Trigger: <name>". That commentary describes the generated
    // file, not authored work, so preserving it fills the tree with labels and
    // folders the author never wrote. Only a generated script is filtered;
    // a hand-written file keeps every comment, which is all it has. A map
    // script says so in its first banner; a library script (Lib<Id>.galaxy, or
    // a library embedded in a map script) opens with a "Library: <name>" banner.
    const banner = (i) =>
      i > 0 &&
      i + 1 < content.length &&
      separator(content[i - 1].value) &&
      separator(content[i + 1].value) &&
      content[i - 1].line + 1 === content[i].line &&
      content[i + 1].line === content[i].line + 1;
    const librarySection = (value) => /^Library:\s/u.test(value);
    generatedScript = content.some(
      (comment, i) =>
        comment.value === 'Generated Map Script' || (librarySection(comment.value) && banner(i)),
    );
    const scaffolding = (value) =>
      generatedScript &&
      (GENERATED_SECTIONS.has(value) ||
        /^Trigger:\s/u.test(value) ||
        /^Name:\s/u.test(value) ||
        librarySection(value));
    const statements = Array.from(source.statements);
    const sections = content.filter(
      (comment, i) =>
        !statements.some(
          (statement) =>
            statement.body && statement.pos < comment.pos && statement.end > comment.pos,
        ) &&
        !separator(comment.value) &&
        !scaffolding(comment.value) &&
        banner(i),
    );
    hasExplicitSections = sections.length > 0;
    const folders = sections.map((section) => {
      const id = generateId();
      const category = {
        type: 'Category',
        id,
        library: library.id,
        name: section.value,
        items: [],
      };
      library.elements[id] = category;
      roots.push(reference(category));
      return { section, category };
    });
    for (const statement of statements) {
      const ref = symbols.get(statement.name?.name);
      const folder = folders.filter((folder) => folder.section.pos < statement.pos).at(-1);
      // A function declaration without a body is a prototype, not a second
      // editor function. Leave it out of the visual hierarchy and let its
      // implementation own the symbol later in the source file.
      const prototype = Array.isArray(statement.parameters) && statement.body === undefined;
      const key = ref && refKey(ref, library.id);
      if (ref && key && folder && !prototype && !placed.has(key)) {
        folder.category.items.push(ref);
        placed.add(key);
        used.add(key);
      }
    }
    for (const comment of content) {
      // All comments in an editor-generated Galaxy file describe generated
      // scaffolding. Turning thousands of those comments into root Labels
      // obscures the semantic folders; handwritten Galaxy still retains them.
      if (generatedScript) continue;
      if (
        !comment.value ||
        separator(comment.value) ||
        sections.includes(comment) ||
        scaffolding(comment.value) ||
        comment.value.startsWith('LibraryName:')
      )
        continue;
      const id = generateId();
      const label = { type: 'Label', id, library: library.id, name: comment.value };
      library.elements[id] = label;
      const folder = folders.filter((folder) => folder.section.pos < comment.pos).at(-1);
      if (folder) folder.category.items.push(reference(label));
      else roots.push(reference(label));
    }
  }
  const restoredRoots = [
    ...roots,
    ...library.items.filter((item) => !used.has(refKey(item, library.id))),
  ];
  // A layout marker is an explicit user/editor layout and takes precedence.
  // The deterministic folders are only the fallback for raw Galaxy.
  library.items =
    annotated || (hasExplicitSections && !generatedScript)
      ? restoredRoots
      : standardFolderLayout(library, restoredRoots);
}
//# sourceMappingURL=editor-layout.js.map
