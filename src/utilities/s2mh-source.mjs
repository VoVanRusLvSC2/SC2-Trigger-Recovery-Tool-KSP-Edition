/** Optional, offline .s2mh attribute source. No network or persistent cache.
 * Omitted input is a normal no-op; supplied invalid input fails explicitly.
 * Cached publication identity is not an exact local Galaxy revision certificate. */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import {
  decodeCacheHeader,
  field,
  number,
  array,
  reference,
} from '../sdk/core/modules/game/battlenet/content-sources/cache-header.js';
import {
  headerLocales,
  headerText,
  stringReference,
  parseLocaleTable,
} from '../sdk/core/modules/game/battlenet/content-sources/header-strings.js';
import { decodeAttributeDefaults } from './cache-attribute-defaults.mjs';
const hash = (b) => createHash('sha256').update(b).digest('hex');
export async function readOptionalS2mh({
  s2mh,
  namespace,
  cacheDirectory = 'C:/ProgramData/Blizzard Entertainment/Battle.net/Cache',
  locale = 'enUS',
} = {}) {
  if (!s2mh)
    return {
      used: false,
      attributes: [],
      reason: 'No .s2mh supplied; keep existing recovery behavior',
    };
  if (!Number.isSafeInteger(namespace) || namespace < 1)
    throw Error('An explicit positive expected namespace is required');
  const bytes = await readFile(s2mh);
  if (bytes.length > 8 * 1024 ** 2) throw Error('Header exceeds 8 MiB');
  const sha256 = hash(bytes),
    base = path.basename(s2mh),
    address = /^([a-f\d]{64})\.s2mh$/i.exec(base);
  if (address && address[1].toLowerCase() !== sha256)
    throw Error('Content-addressed header hash mismatch');
  const node = decodeCacheHeader(bytes),
    header = field(node, 0),
    actualNamespace = number(field(header, 3));
  if (actualNamespace !== namespace) throw Error('Publication namespace mismatch');
  const tables = new Map(),
    localeIssues = [];
  async function table(handle) {
    const ref = reference(handle);
    if (!ref || ref.type !== 's2ml') return;
    const p = path.join(cacheDirectory, ref.file.slice(0, 2), ref.file.slice(2, 4), ref.file);
    try {
      let t = tables.get(ref.file);
      if (!t) {
        const b = await readFile(p);
        if (b.length > 1024 ** 2 || hash(b) !== ref.sha256)
          throw Error('Locale size/hash mismatch');
        t = parseLocaleTable(b.toString('utf8'));
        tables.set(ref.file, t);
      }
      return t;
    } catch (error) {
      localeIssues.push({ file: ref.file, error: String(error) });
      return;
    }
  }
  async function text(optional) {
    if (optional.kind === 4 && !optional.value) return null;
    const ref = optional.kind === 4 ? optional.value : optional;
    return (await headerText(headerLocales(header, locale), stringReference(ref), table)) ?? null;
  }
  const attributes = [];
  for (const a of array(field(header, 5)))
    if (number(field(field(a, 0), 0)) === namespace)
      attributes.push(await decodeAttributeDefaults(a, namespace, text));
  if (new Set(attributes.map((a) => a.id)).size !== attributes.length)
    throw Error('Duplicate custom definition');
  const defaultVariantIndex = number(field(header, 12)),
    variants = array(field(header, 13));
  if (defaultVariantIndex >= variants.length) throw Error('Default variant index outside variants');
  const overrides = [];
  for (const item of array(field(variants[defaultVariantIndex], 6))) {
    const key = field(item, 0);
    if (number(field(key, 0)) !== namespace) continue;
    const id = number(field(key, 1)),
      definition = attributes.find((a) => a.id === id);
    if (!definition) throw Error('Variant override references absent custom definition');
    const d = field(item, 1);
    if (d.kind !== 3 || ![0n, 1n].includes(d.index))
      throw Error('Unsupported variant default choice');
    const type = d.index === 0n ? 'Global' : 'Player';
    if (type !== definition.type) throw Error('Variant/default type differs');
    const slots = d.index === 0n ? [d.value] : array(d.value),
      defaults = slots.map((v, i) => {
        const index = number(field(v, 0));
        if (index >= definition.values.length)
          throw Error('Variant default index outside value array');
        return {
          slot: type === 'Global' ? 'Global' : String(i),
          index,
          token: definition.values[index].token,
        };
      });
    overrides.push({ id, defaults });
  }
  const identity = field(header, 0),
    version = number(field(identity, 1));
  return {
    used: true,
    s2mh: path.resolve(s2mh),
    sha256,
    addressHashVerified: !!address,
    namespace,
    mapId: number(field(identity, 0)),
    version,
    publicationVersion: (version >>> 16) + '.' + (version & 65535),
    attributes,
    defaultVariantIndex,
    overrides,
    localeIssues,
    exactLocalRevisionVerified: false,
    fullLobbyRecovered: false,
    scope:
      'Published custom definitions and default value choices, with selected-variant overrides; unknown flags/requirements and other variants are retained in the source header, not guessed as XML.',
  };
}
const el = (name, attributes = {}, children = []) => ({ name, attributes, children, text: '' });
/** Build only the observed XML definition/value/default forms. Existing locale
 * keys are reused; unnamed cached values remain unnamed, without invented text. */
export function attributesFromS2mh(decoded, labels) {
  if (!decoded.used) return null;
  const table = new Map();
  for (const locale of labels)
    for (const line of locale.values) {
      const i = line.indexOf('=');
      if (i > 0) table.set(line.slice(0, i), line.slice(i + 1));
    }
  const view = { 0: 'None', 1: 'Self', 2: 'Host', 3: 'All' },
    availability = { 0: 'All', 1: 'First' };
  const attributes = decoded.attributes.map((a) => {
    const prefix = 'Attribute' + String(a.id).padStart(3, '0'),
      name = prefix + '/Name';
    if (!table.has(name))
      throw Error('No original localization key for cached custom definition ' + a.id);
    if (!view[a.visibilityCode] || !view[a.accessCode] || !availability[a.arbitrationCode])
      throw Error('Unsupported attribute usage enum');
    const values = a.values.map((v) => {
      if (!/^\d{4}$/.test(v.token))
        throw Error('This XML profile requires a verified decimal FourCC token');
      const id = String(Number(v.token)),
        key = prefix + '/Value' + id.padStart(3, '0'),
        value = { id };
      if (table.has(key + '/Name')) value.name = key + '/Name';
      if (table.has(key + '/Desc')) value.description = key + '/Desc';
      return value;
    });
    if (new Set(values.map((v) => v.id)).size !== values.length)
      throw Error('XML value IDs collide');
    const defaults = (decoded.overrides.find((v) => v.id === a.id)?.defaults ?? a.defaults).map(
      (d) => {
        const id = String(Number(d.token));
        if (!values.some((v) => v.id === id)) throw Error('Default has no definition');
        return el('Default', {}, [el('Slot', { Id: d.slot }), el('Value', { Id: id })]);
      },
    );
    const definition = {
      id: String(a.id),
      type: a.type,
      name,
      availability: availability[a.arbitrationCode],
      visibility: view[a.visibilityCode],
      access: view[a.accessCode],
      values,
      defaults,
    };
    if (a.optionsBits & 2) definition.publicLocked = true;
    // Hidden is independently observed in Ice's original Attributes XML. Do not
    // interpret default unknownByteHex or unknown option bits as additional flags.
    const unknown = [];
    if (a.optionsBits & 4) unknown.push({ ...el('Hidden'), index: 6 });
    if (table.has(prefix + '/Desc'))
      unknown.push({ ...el('Description', { Value: prefix + '/Desc' }), index: 3 });
    if (unknown.length) definition.unknown = unknown;
    return definition;
  });
  return { attributes, defaultVariants: 1, variants: [] };
}
