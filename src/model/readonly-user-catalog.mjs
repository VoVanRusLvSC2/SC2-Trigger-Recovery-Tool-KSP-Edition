// A source-bound value domain for immutable User Data, never a replacement API.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { STARCRAFT2_CATALOG_FILES } from '../sdk/array-values/modules/data/services/schema/full-data-schema.js';
import { gameDataIncludePaths } from '../sdk/array-values/modules/data/shared/catalog-engine/gamedata-order.js';
import { parseCatalogXmlElements } from '../sdk/array-values/modules/data/shared/catalog-engine/xml/parser.js';
import {
  SyntaxKind as K,
  forEachChild,
} from '../sdk/array-values/modules/galaxy/language-core/index.js';
import {
  getTypeName,
  unwrapArrayType,
} from '../sdk/array-values/modules/triggers/services/galaxy-conversion/internal/g2t-core.js';
import { readStringLiteralValue } from '../types/string-literal-value.mjs';
import { proveCatalogNamespaceNotWritten } from '../analysis/catalog-mutation-scope.mjs';
const models = new WeakMap(),
  sha = (b) => createHash('sha256').update(b).digest('hex');
const walk = (n, f, p, owner) => {
  if (n.kind === K.FunctionDeclaration) owner = n;
  f(n, p, owner);
  forEachChild(n, (c) => walk(c, f, n, owner));
};
const field = (n, key) =>
  n.attributes[key] ?? n.children.find((c) => c.name === key)?.attributes.value;
const exactKeys = (value, allowed) => Object.keys(value).every((k) => allowed.includes(k));
const userReadApis = new Set([
  'UserDataInstanceCount',
  'UserDataInstance',
  'UserDataFieldCount',
  'UserDataField',
  'UserDataFieldType',
  'UserDataFieldValueCount',
  'UserDataFieldIsModifiable',
  ...[
    'AbilCmd',
    'Actor',
    'Color',
    'Compare',
    'Fixed',
    'GameLink',
    'ImagePath',
    'ImageEdge',
    'ImageAttachPoint',
    'Int',
    'Model',
    'Movie',
    'Sound',
    'String',
    'Text',
    'Unit',
    'Upgrade',
    'UserType',
    'UserInstance',
  ].map((type) => 'UserDataGet' + type),
  'UserDataResetValue',
  'UserDataResetInstance',
  'UserDataResetType',
  'UserDataResetAll',
  'UserDataSaveInstance',
  'UserDataSaveType',
  'UserDataTypeFromReference',
  'UserDataInstanceFromReference',
]);
const userWriteAbi = new Map(
  Object.entries({
    AbilCmd: 'abilcmd',
    Actor: 'string',
    Color: 'color',
    Compare: 'int',
    Fixed: 'fixed',
    GameLink: 'string',
    ImagePath: 'string',
    ImageEdge: 'int',
    ImageAttachPoint: 'int',
    Int: 'int',
    Model: 'string',
    Movie: 'string',
    Sound: 'string',
    String: 'string',
    Text: 'text',
    Unit: 'string',
    Upgrade: 'string',
  }).map(([type, value]) => ['UserDataSet' + type, ['string', 'string', 'string', 'int', value]]),
);
userWriteAbi.set('UserDataSetUser', ['string', 'string', 'string', 'int', 'string', 'string']);
userWriteAbi.set('UserDataLoadInstance', ['string', 'string', 'bank', 'string']);
userWriteAbi.set('UserDataLoadType', ['string', 'bank', 'string']);

/** Use the same standard catalogs and explicit includes as the resolved context.
 * Project CUser before the general catalog entity limit, retaining every input
 * hash and refusing unknown data-side writes. Bounds are not raised.
 */
export async function readReadonlyUserCatalog(context) {
  assert(
    context.layers.length && !context.unresolved.length,
    'USER_CATALOG_COMPLETE_CONTEXT_REQUIRED',
  );
  const standard = new Map(
    STARCRAFT2_CATALOG_FILES.map((name, i) => ['base.sc2data/gamedata/' + name.toLowerCase(), i]),
  );
  const state = {
    documents: [],
    nodes: [],
    dataSideRisks: [],
    nonExecutableDataDefaults: [],
    totalBytes: 0,
    layers: context.layers.map((l) => ({ ...l })),
  };
  for (const layer of context.layers) {
    const files = [];
    let cursor;
    do {
      const page = await context.files(layer.id, {
        prefix: 'base.sc2data/',
        limit: 10000,
        ...(cursor ? { cursor } : {}),
      });
      files.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor);
    const byPath = new Map(files.map((f) => [f.replaceAll('\\', '/').toLowerCase(), f]));
    const ordered = files
      .filter((f) => standard.has(f.toLowerCase()))
      .sort((a, b) => standard.get(a.toLowerCase()) - standard.get(b.toLowerCase()));
    async function read(file, manifest = false) {
      assert(state.documents.length < 16384, 'USER_CATALOG_DOCUMENT_BOUND');
      const bytes = await context.read(layer.id, file, 64 * 1024 ** 2);
      state.totalBytes += bytes.length;
      assert(state.totalBytes <= 536870912, 'USER_CATALOG_TOTAL_BYTES_BOUND');
      const pin = {
        layerId: layer.id,
        path: file,
        sha256: sha(bytes),
        bytes: bytes.length,
        manifest,
      };
      state.documents.push(pin);
      return { pin, text: Buffer.from(bytes).toString('utf8') };
    }
    const manifest = byPath.get('base.sc2data/gamedata.xml');
    if (manifest) {
      const { text } = await read(manifest, true);
      for (const name of gameDataIncludePaths(text)) {
        const file = byPath.get(('base.sc2data/' + name).toLowerCase());
        if (file && !ordered.includes(file)) ordered.push(file);
      }
    }
    for (const file of ordered) {
      const { pin, text } = await read(file);
      const roots = parseCatalogXmlElements(text);
      for (const root of roots)
        for (const node of root.children) {
          if (node.name === 'CUser') {
            assert(state.nodes.length < 100000, 'USER_CATALOG_ENTITY_BOUND');
            state.nodes.push({
              node,
              pin,
              unqualifiedRootTokens:
                !!root.tokens?.length || root.children.some((n) => n.name === 'const'),
            });
            continue;
          }
          function inspect(n) {
            const effectData = /^CEffect.*UserData/u.test(n.name),
              classDefault = n === node && !node.attributes.id && node.attributes.default === '1';
            // A class template is not an executable catalog object. Every named effect
            // instance still refuses, as do catalog references inside any template.
            if (effectData && classDefault)
              state.nonExecutableDataDefaults.push({
                pin,
                class: node.name,
                default: '1',
                namedObject: false,
              });
            if (
              (effectData && !classDefault) ||
              Object.entries(n.attributes).some(
                ([k, v]) => /^User,/iu.test(v) || (v === 'User' && /catalog/iu.test(n.name + k)),
              )
            )
              state.dataSideRisks.push({
                pin,
                entity: node.attributes.id,
                class: node.name,
                field: n.name,
              });
            for (const child of n.children) inspect(child);
          }
          inspect(node);
        }
    }
  }
  const capability = Object.freeze({ kind: 'LOADED_USER_CATALOG_SOURCE_CAPABILITY' });
  models.set(capability, state);
  return capability;
}

export function describeReadonlyUserCatalog(capability) {
  const state = models.get(capability);
  assert(state, 'USER_CATALOG_UNTRUSTED_CAPABILITY');
  return structuredClone({
    documents: state.documents,
    layers: state.layers,
    totalBytes: state.totalBytes,
    userDeclarations: state.nodes.length,
    dataSideRisks: state.dataSideRisks,
    nonExecutableDataDefaults: state.nonExecutableDataDefaults,
  });
}

export function createReadonlyUserStringResolver(asts, capability) {
  const state = models.get(capability);
  assert(state, 'USER_CATALOG_UNTRUSTED_CAPABILITY');
  assert(!state.dataSideRisks.length, 'USER_CATALOG_DATA_SIDE_WRITER_UNPROVED');
  const mutation = proveCatalogNamespaceNotWritten(asts, {
      namespace: 'User',
      constantName: 'c_gameCatalogUser',
    }),
    functions = new Map(),
    protectedWriterSites = [];
  for (const ast of asts)
    for (const d of ast.statements)
      if (d.kind === K.FunctionDeclaration) {
        const rows = functions.get(d.name.name) ?? [];
        rows.push(d);
        functions.set(d.name.name, rows);
      }
  for (const ast of asts) {
    walk(ast, (n, p, owner) => {
      if (n.kind === K.Identifier && userWriteAbi.has(n.name))
        assert(
          (p?.name === n && !!p.type) || (p?.kind === K.CallExpression && p.expression === n),
          'USER_CATALOG_INDIRECT_WRITER_UNPROVED',
        );
      if (
        n.kind === K.CallExpression &&
        n.expression?.kind === K.Identifier &&
        n.expression.name.startsWith('UserData')
      ) {
        const name = n.expression.name,
          abi = userWriteAbi.get(name);
        assert(userReadApis.has(name) || abi, 'USER_CATALOG_API_EFFECT_UNCLASSIFIED:' + name);
        if (abi) {
          const defs = functions.get(name) ?? [];
          assert(
            defs.length &&
              defs.every(
                (d) =>
                  !d.body &&
                  d.modifiers?.some((m) => m.kind === K.NativeKeyword) &&
                  getTypeName(d.type) === 'void' &&
                  d.parameters.length === abi.length &&
                  d.parameters.every(
                    (v, i) =>
                      getTypeName(v.type) === abi[i] &&
                      !unwrapArrayType(v.type).sizes.length &&
                      !v.isReference,
                  ),
              ),
            'USER_CATALOG_WRITER_NATIVE_ABI_REQUIRED',
          );
          assert(
            n.arguments.length === abi.length &&
              !owner?.parameters.some((v) => v.name.name === name),
            'USER_CATALOG_WRITER_IDENTITY_UNPROVED',
          );
          if (owner?.body)
            walk(owner.body, (v) => {
              assert(
                v.kind !== K.VariableDeclaration || v.name.name !== name,
                'USER_CATALOG_WRITER_IDENTITY_UNPROVED',
              );
            });
          assert(
            !asts.some((a) =>
              a.statements.some((v) => v.kind === K.VariableDeclaration && v.name.name === name),
            ),
            'USER_CATALOG_WRITER_IDENTITY_UNPROVED',
          );
          protectedWriterSites.push({
            name,
            fileName: ast.fileName,
            start: n.pos,
            end: n.end,
            abi,
            contract:
              'Only fields flagged Modifiable can change; read() must independently reject every queried modifiable field.',
          });
        }
      }
    });
  }
  const defs = functions.get('UserDataGetString') ?? [],
    abi = ['string', 'string', 'string', 'int'];
  assert(
    !asts.some((a) =>
      a.statements.some(
        (n) => n.kind === K.VariableDeclaration && n.name.name === 'UserDataGetString',
      ),
    ),
    'USER_CATALOG_GETTER_SHADOWED',
  );
  assert(
    defs.length &&
      defs.every(
        (d) =>
          !d.body &&
          d.modifiers?.some((m) => m.kind === K.NativeKeyword) &&
          getTypeName(d.type) === 'string' &&
          d.parameters.length === 4 &&
          d.parameters.every(
            (p, i) =>
              getTypeName(p.type) === abi[i] &&
              !unwrapArrayType(p.type).sizes.length &&
              !p.isReference,
          ),
      ),
    'USER_CATALOG_GETTER_NATIVE_ABI_REQUIRED',
  );
  const proof = {
    kind: 'CLOSED_IMMUTABLE_USER_STRING_FIELD_DOMAIN',
    documents: state.documents,
    layers: state.layers,
    mutation,
    protectedWriterSites,
    nonExecutableDataDefaults: state.nonExecutableDataDefaults,
    sourceDocuments: asts.map((a) => ({ fileName: a.fileName, sha256: sha(a.text) })),
    queries: [],
    newNative: 0,
    newRuntimeFunctions: 0,
    permissionToRewriteCode: false,
  };
  function read(call, owner) {
    assert(
      call?.kind === K.CallExpression &&
        call.expression?.name === 'UserDataGetString' &&
        call.arguments.length === 4,
      'USER_CATALOG_GETTER_REQUIRED',
    );
    assert(
      !owner?.parameters.some((p) => p.name.name === 'UserDataGetString'),
      'USER_CATALOG_GETTER_SHADOWED',
    );
    if (owner?.body)
      walk(owner.body, (n) => {
        assert(
          n.kind !== K.VariableDeclaration || n.name.name !== 'UserDataGetString',
          'USER_CATALOG_GETTER_SHADOWED',
        );
      });
    const literal = (n) =>
      n?.kind === K.StringLiteral ? readStringLiteralValue(n.text)?.value : undefined;
    const type = literal(call.arguments[0]),
      name = literal(call.arguments[2]);
    assert(type && name, 'USER_CATALOG_LITERAL_TYPE_AND_FIELD_REQUIRED');
    assert(!state.nodes.some((r) => !r.node.attributes.id), 'USER_CATALOG_CLASS_DEFAULTS_UNPROVED');
    const records = state.nodes.filter(
      (r) => r.node.attributes.id?.toLowerCase() === type.toLowerCase(),
    );
    assert(records.length === 1, 'USER_CATALOG_TYPE_MERGE_OR_ABSENCE_UNPROVED');
    const { node, pin, unqualifiedRootTokens } = records[0];
    function noTokens(n) {
      return !n.tokens?.length && n.children.every(noTokens);
    }
    assert(
      exactKeys(node.attributes, ['id']) &&
        noTokens(node) &&
        !unqualifiedRootTokens &&
        node.children.every((n) => ['Fields', 'Instances'].includes(n.name)),
      'USER_CATALOG_INHERITANCE_OR_TOKEN_UNPROVED',
    );
    const fields = node.children.filter(
      (n) => n.name === 'Fields' && field(n, 'Id')?.toLowerCase() === name.toLowerCase(),
    );
    assert(fields.length === 1, 'USER_CATALOG_FIELD_IDENTITY_UNPROVED');
    const f = fields[0];
    assert(field(f, 'Type') === 'String', 'USER_CATALOG_STRING_FIELD_REQUIRED');
    assert(
      exactKeys(f.attributes, ['Id', 'Type', 'Count', 'EditorColumn', 'EditorText']) &&
        f.children.every((c) =>
          ['Id', 'Type', 'Count', 'Flags', 'EditorColumn', 'EditorText'].includes(c.name),
        ),
      'USER_CATALOG_FIELD_METADATA_UNPROVED',
    );
    assert(
      f.children
        .filter((c) => c.name !== 'Flags')
        .every((c) => exactKeys(c.attributes, ['value']) && !c.children.length),
      'USER_CATALOG_FIELD_METADATA_UNPROVED',
    );
    const flags = f.children.filter((c) => c.name === 'Flags');
    assert(
      flags.every(
        (c) =>
          c.attributes.index === 'Modifiable' && c.attributes.value === '0' && !c.children.length,
      ),
      'USER_CATALOG_MODIFIABLE_FIELD',
    );
    const values = new Set(['']),
      instances = new Set();
    for (const instance of node.children.filter((c) => c.name === 'Instances')) {
      assert(
        typeof instance.attributes.Id === 'string' &&
          exactKeys(instance.attributes, ['Id']) &&
          !instances.has(instance.attributes.Id) &&
          !instance.tokens,
        'USER_CATALOG_INSTANCE_MERGE_UNPROVED',
      );
      instances.add(instance.attributes.Id);
      for (const value of instance.children) {
        const selected = value.children.filter(
          (c) => c.name === 'Field' && field(c, 'Id')?.toLowerCase() === name.toLowerCase(),
        );
        if (!selected.length) continue;
        assert(
          selected.length === 1 &&
            value.name === 'String' &&
            exactKeys(value.attributes, ['String']) &&
            !value.tokens,
          'USER_CATALOG_STRING_VALUE_SHAPE_UNPROVED',
        );
        assert(
          value.children.every((c) => c.name === 'Field') &&
            value.children.every(
              (c) => exactKeys(c.attributes, ['Id', 'Index']) && !c.children.length,
            ),
          'USER_CATALOG_FIELD_REFERENCE_UNPROVED',
        );
        const text = value.attributes.String;
        assert(
          typeof text === 'string' && /^[\x20-\x7e]*$/u.test(text) && !text.includes('##'),
          'USER_CATALOG_STRING_VALUE_ENCODING_UNPROVED',
        );
        values.add(text);
        assert(values.size <= 128, 'USER_CATALOG_VALUE_BOUND');
      }
    }
    proof.queries.push({
      type,
      field: name,
      source: pin,
      possibleValues: [...values],
      allInstancesAndIndicesIncluded: true,
      mutability:
        'No Modifiable flag or inherited/class defaults. Exact stock setter/load ABIs obey the modifiable-field guard; every catalog User write and unclassified data mutation channel is refused.',
    });
    return [...values];
  }
  return { read, proof };
}
