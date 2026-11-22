const standardPrefix =
  /^\uFEFF?(?:<\?xml version="1\.0" encoding="utf-8"\?>[\t\r\n ]*)?<TriggerData>[\t\r\n ]*<Standard Id="([A-Za-z0-9_]+)"\/>/u;
export const mixedTriggerLibraries = Symbol('mixed TriggerData libraries');

export function leadingStandardId(xml) {
  return typeof xml === 'string' ? standardPrefix.exec(xml.slice(0, 512))?.[1] : undefined;
}

/** Validate the original document with SAX, feeding the semantic reader the
 * same virtual Library used by lossless normalization. Mixed documents are
 * handled by the general normalizer because their top-level order may change. */
export function readStandardTriggerXml(parser, xml, id) {
  const open = parser.onopentag;
  const close = parser.onclosetag;
  const text = parser.ontext;
  const cdata = parser.oncdata;
  let depth = 0;
  let roots = 0;
  let standard = false;
  let openedLibrary = false;
  parser.onopentag = (node) => {
    if (depth++ === 0) roots++;
    if (depth === 2) {
      if (
        !openedLibrary &&
        node.name === 'Standard' &&
        node.isSelfClosing &&
        node.attributes.Id === id
      ) {
        standard = true;
        openedLibrary = true;
        open({ name: 'Library', attributes: { Id: id } });
        return;
      }
      if (!openedLibrary || node.name === 'Standard' || node.name === 'Library')
        throw mixedTriggerLibraries;
    }
    open(node);
  };
  parser.onclosetag = (tag) => {
    if (depth-- === 1 && openedLibrary) close('Library');
    if (standard) standard = false;
    else close(tag);
  };
  parser.ontext = (value) => {
    if (depth > 1) text(value);
  };
  parser.oncdata = (value) => {
    if (depth > 1) cdata(value);
  };
  parser.write(xml).close();
  if (roots !== 1 || depth !== 0) throw new TypeError('Expected one complete XML root');
}
