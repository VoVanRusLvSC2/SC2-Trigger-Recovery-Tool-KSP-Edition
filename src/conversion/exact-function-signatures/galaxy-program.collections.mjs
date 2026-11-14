import assert from 'node:assert/strict';
import { createGalaxyDocument } from './galaxy-document.collections.mjs';
import { transferGalaxySyntax } from './immutable-galaxy-syntax.collections.mjs';

/** One conversion owns its mutable source documents. Identity includes the
 * verified archive path, not merely an optional display filename. Dependency
 * declarations and independent verification are outside this writable set. */
export function createGalaxyProgram() {
  const documents = new Map();
  let disposed = false;
  const identity = (file) => {
    assert.equal(typeof file.fileName, 'string');
    const owner = file.originalPath ?? file.fileName;
    assert.equal(typeof owner, 'string');
    return owner.replaceAll('\\', '/').toLowerCase();
  };
  return Object.freeze({
    document(file, { role = 'owned-include' } = {}) {
      assert(!disposed, 'DISPOSED_GALAXY_PROGRAM');
      const key = identity(file);
      let entry = documents.get(key);
      if (!entry) {
        entry = {
          document: createGalaxyDocument({ fileName: file.fileName, text: file.text, role }),
          fileName: file.fileName,
          role,
        };
        documents.set(key, entry);
      }
      assert.equal(entry.fileName, file.fileName, 'AMBIGUOUS_PROGRAM_FILE_ALIAS');
      assert.equal(entry.role, role, 'AMBIGUOUS_PROGRAM_ROLE');
      const document = entry.document;
      assert.equal(document.text, file.text, 'STALE_PROGRAM_DOCUMENT');
      return document;
    },
    evidence() {
      assert(!disposed, 'DISPOSED_GALAXY_PROGRAM');
      return {
        documents: [...documents.entries()].map(([owner, entry]) => ({
          owner,
          ...entry.document.evidence(),
        })),
        persistentCache: false,
      };
    },
    takeSyntax() {
      assert(!disposed, 'DISPOSED_GALAXY_PROGRAM');
      const token = transferGalaxySyntax(
        [...documents.entries()].map(([owner, entry]) => ({
          owner,
          role: entry.role,
          fileName: entry.fileName,
          text: entry.document.text,
          ast: entry.document.ast,
        })),
      );
      for (const entry of documents.values()) entry.document.dispose();
      documents.clear();
      disposed = true;
      return token;
    },
    dispose() {
      for (const entry of documents.values()) entry.document.dispose();
      documents.clear();
      disposed = true;
    },
  });
}

/** Preserve standalone use without retaining a tree beyond the operation. */
export function withGalaxyDocument(file, program, operation) {
  if (program) return operation(program.document(file));
  const document = createGalaxyDocument({ fileName: file.fileName, text: file.text });
  try {
    return operation(document);
  } finally {
    document.dispose();
  }
}
