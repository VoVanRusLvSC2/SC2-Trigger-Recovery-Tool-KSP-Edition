/** Literal search keeps the result list open while the editor selection changes. */
export function createEditorSearch() {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = el<HTMLDialogElement>('searchDialog'),
    query = el<HTMLInputElement>('query');
  let target: HTMLTextAreaElement;
  let matches: { start: number; length: number; line: number; snippet: string }[] = [];
  let searchedQuery = '';
  let selected = -1,
    timer: ReturnType<typeof setTimeout>;
  function jump(index: number) {
    if (!matches.length) return;
    selected = (index + matches.length) % matches.length;
    const match = matches[selected]!;
    target.focus();
    target.setSelectionRange(match.start, match.start + match.length);
    target.scrollTop = Math.max(0, (match.line - 1) * 19 - target.clientHeight / 2);
    target.dispatchEvent(new Event('scroll'));
    el('searchStatus').textContent =
      `${selected + 1} of ${matches.length.toLocaleString()} matches · Line ${match.line}`;
    for (const row of el('searchResults').querySelectorAll<HTMLButtonElement>('button'))
      row.setAttribute('aria-pressed', String(Number(row.dataset.index) === selected));
  }
  function search() {
    matches = [];
    selected = -1;
    const text = target.value,
      needle = query.value;
    searchedQuery = needle;
    const pattern = new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'giu');
    let start = 0,
      line = 1,
      previous = 0;
    let match: RegExpExecArray | null;
    if (needle)
      while ((match = pattern.exec(text))) {
        start = match.index;
        for (let p = previous; p < start; p++) if (text[p] === '\n') line++;
        const left = text.lastIndexOf('\n', start - 1) + 1;
        let right = text.indexOf('\n', start + needle.length);
        if (right < 0) right = text.length;
        matches.push({
          start,
          length: match[0].length,
          line,
          snippet: text.slice(
            Math.max(left, start - 70),
            Math.min(right, start + needle.length + 110),
          ),
        });
        previous = start;
        start += needle.length;
      }
    el('searchResults').replaceChildren();
    // All matches remain navigable. Materialize a bounded result list, not megabytes of DOM.
    for (const [index, match] of matches.slice(0, 1000).entries()) {
      const row = document.createElement('button');
      row.dataset.index = String(index);
      row.textContent = `Line ${match.line}  #${index + 1}    ${match.snippet}`;
      row.onclick = () => jump(index);
      el('searchResults').append(row);
    }
    el('searchStatus').textContent = needle
      ? `${matches.length.toLocaleString()} matches${matches.length > 1000 ? ' · First 1,000 listed; Next/Previous navigates all' : ''}`
      : 'Enter text to search';
    el<HTMLButtonElement>('findNext').disabled = !matches.length;
    el<HTMLButtonElement>('findPrevious').disabled = !matches.length;
  }
  function open(editor: HTMLTextAreaElement) {
    target = editor;
    el('searchTitle').textContent =
      'Search ' + (editor.id === 'markup' ? 'Trigger Markup' : 'Galaxy Source');
    if (!dialog.open) dialog.show();
    if (editor.selectionEnd > editor.selectionStart)
      query.value = editor.value.slice(editor.selectionStart, editor.selectionEnd);
    search();
    query.focus();
    query.select();
  }
  query.oninput = () => {
    clearTimeout(timer);
    timer = setTimeout(search, 80);
  };
  query.onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      searchIfPending();
      jump(selected + (event.shiftKey ? -1 : 1));
    }
  };
  function searchIfPending() {
    clearTimeout(timer);
    if (searchedQuery !== query.value) search();
  }
  el('findNext').onclick = () => {
    searchIfPending();
    jump(selected + 1);
  };
  el('findPrevious').onclick = () => {
    searchIfPending();
    jump(selected < 0 ? matches.length - 1 : selected - 1);
  };
  el('clearSearch').onclick = () => {
    query.value = '';
    search();
    query.focus();
  };
  for (const id of ['markup', 'source']) {
    const editor = el<HTMLTextAreaElement>(id);
    editor.addEventListener('documentchange', () => {
      if (target === editor) search();
    });
    el('search' + (id === 'markup' ? 'Markup' : 'Source')).onclick = () => open(editor);
    editor.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        open(editor);
      } else if (event.key === 'F3') {
        event.preventDefault();
        if (target !== editor || !query.value) open(editor);
        else jump(event.shiftKey ? selected - 1 : selected + 1);
      }
    });
  }
}
