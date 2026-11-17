import type {
  RecoveryAdapter,
  JobSnapshot,
  Artifact,
  DocumentPreview,
  FileListing,
  PickerKind,
} from './contracts.js';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const token = document.querySelector<HTMLMetaElement>('meta[name="session-token"]')!.content;
const settingsDialog = element<HTMLDialogElement>('settingsDialog');
let adapters: RecoveryAdapter[] = [];
let snapshot: JobSnapshot;
let shownArtifacts = '';
let shownResult = '';
let searchTarget: 'markup' | 'source' = 'source';
let selectedMarkup: Artifact | undefined;
let originalMarkupText = '';
let opening = false;
let loadedMap = '';
let inspectingMap = false;
let automaticDefaults: Record<string, string> = {};
let suggestedOutput = '';
let configuredAdapter = '';
const notice = (text: string) => {
  element('notice').textContent = text;
};
const fail = (error: unknown) => notice(String(error));
async function response(route: string, data?: unknown): Promise<Response> {
  const result = await fetch('/api/' + route, {
    method: data === undefined ? 'GET' : 'POST',
    headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json' },
    ...(data === undefined ? {} : { body: JSON.stringify(data) }),
  });
  if (!result.ok) throw Error((await result.json()).error ?? result.statusText);
  return result;
}
async function api<T>(route: string, data?: unknown): Promise<T> {
  return (await response(route, data)).json();
}
function show(id: string) {
  const dialog = element<HTMLDialogElement>(id);
  if (!dialog.open) dialog.showModal();
}
// One modal owns each selection. Closing it invalidates pending directory reads.
const fileDialog = element<HTMLDialogElement>('fileDialog');
let picker:
  | {
      kind: PickerKind;
      directory: string;
      parent: string;
      home: string;
      selected: string;
      resolve: (value: string) => void;
    }
  | undefined;
let navigation = 0;
function finishPicker(value = '') {
  const current = picker;
  picker = undefined;
  navigation++;
  fileDialog.close();
  current?.resolve(value);
}
async function navigateFiles(requested = '') {
  const current = picker;
  if (!current) return;
  const revision = ++navigation;
  element('fileStatus').textContent = 'Reading folder…';
  element<HTMLButtonElement>('fileAccept').disabled = true;
  element('fileEntries').replaceChildren();
  current.selected = '';
  element('fileSelection').textContent = '';
  try {
    const listing = await api<FileListing>('files', { kind: current.kind, path: requested });
    if (picker !== current || revision !== navigation) return;
    Object.assign(current, {
      directory: listing.directory,
      parent: listing.parent,
      home: listing.home,
      selected: listing.selected,
    });
    element<HTMLInputElement>('filePath').value = listing.directory;
    element<HTMLButtonElement>('fileUp').disabled = listing.parent === listing.directory;
    for (const entry of listing.entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = (entry.directory ? '[Folder] ' : '') + entry.name;
      button.title = entry.path;
      button.className = 'file-entry';
      button.setAttribute('aria-pressed', String(entry.path === current.selected));
      button.onclick = () => {
        if (entry.directory) {
          void navigateFiles(entry.path);
          return;
        }
        current.selected = entry.path;
        for (const other of element('fileEntries').querySelectorAll('button'))
          other.setAttribute('aria-pressed', String(other === button));
        updatePicker();
      };
      if (!entry.directory) button.ondblclick = () => finishPicker(entry.path);
      element('fileEntries').append(button);
    }
    element('fileStatus').textContent = listing.truncated
      ? 'Showing the first 5,000 entries. Paste a full path to select another file.'
      : listing.entries.length
        ? `${listing.entries.length} entries`
        : 'No matching files or folders.';
    updatePicker();
  } catch (error) {
    if (picker !== current || revision !== navigation) return;
    current.directory = '';
    element('fileStatus').textContent = String(error);
  }
}
function updatePicker() {
  if (!picker) return;
  const folder = ['folder', 'output'].includes(picker.kind);
  element('fileSelection').textContent =
    picker.selected || (folder ? picker.directory : 'No file selected');
  element<HTMLButtonElement>('fileAccept').disabled = !(folder
    ? picker.directory
    : picker.selected);
}
function choosePath(kind: PickerKind, initial = ''): Promise<string> {
  if (picker) return Promise.reject(Error('A file picker is already open.'));
  const folder = kind === 'folder' || kind === 'output';
  element('fileTitle').textContent = folder
    ? 'SELECT A FOLDER'
    : kind === 'map'
      ? 'SELECT A MAP FILE'
      : 'SELECT A JSON FILE';
  element('fileHelp').textContent =
    kind === 'output'
      ? 'Choose a parent folder. Recovery creates a new folder inside it.'
      : folder
        ? 'Open the folder you need, then press USE THIS FOLDER.'
        : `Choose one ${kind === 'map' ? '.SC2Map' : '.json'} file. Double-click to open, or select it and press OPEN FILE.`;
  element('fileAccept').textContent = folder ? 'USE THIS FOLDER' : 'OPEN FILE';
  return new Promise((resolve) => {
    picker = { kind, directory: '', parent: '', home: '', selected: '', resolve };
    element<HTMLInputElement>('filePath').value = initial;
    show('fileDialog');
    void navigateFiles(initial);
  });
}
element<HTMLFormElement>('fileNavigation').onsubmit = (event) => {
  event.preventDefault();
  void navigateFiles(element<HTMLInputElement>('filePath').value);
};
element('fileUp').onclick = () => {
  if (picker?.parent) void navigateFiles(picker.parent);
};
element('fileHome').onclick = () => {
  void navigateFiles(picker?.home || '');
};
element('fileAccept').onclick = () => {
  if (picker)
    finishPicker(['folder', 'output'].includes(picker.kind) ? picker.directory : picker.selected);
};
for (const id of ['fileCancel', 'fileCancelX']) element(id).onclick = () => finishPicker();
fileDialog.oncancel = (event) => {
  event.preventDefault();
  finishPicker();
};

function metrics(target: 'markup' | 'source', text: string) {
  element<HTMLTextAreaElement>(target).value = text;
  element(target + 'Metric').textContent = text
    ? `${text.split('\n').length.toLocaleString()} lines · ${text.length.toLocaleString()} chars`
    : 'No ' + target + ' loaded';
  if (target === 'markup') {
    // Textarea.value normalizes CRLF. Retain source text for exact XML export.
    originalMarkupText = text;
    element<HTMLButtonElement>('saveMarkup').disabled = !text;
    element<HTMLButtonElement>('treeButton').disabled = !text;
  }
}
function fullMode() {
  const enabled = element<HTMLInputElement>('fullGui').checked;
  element('fullMode').textContent = 'FULL GUI: ' + (enabled ? 'ON' : 'OFF');
  element('fullMode').setAttribute('aria-pressed', String(enabled));
}
async function inspectMap(file: string) {
  if (!file) return;
  loadedMap = '';
  inspectingMap = true;
  if (snapshot) render(snapshot);
  notice('Reading original archive...');
  try {
    const value = await api<DocumentPreview>('inspect', {
      adapter: element<HTMLSelectElement>('adapter').value,
      path: file,
    });
    metrics('source', value.source);
    metrics('markup', value.markup);
    selectedMarkup = undefined;
    loadedMap = value.name;
    element('selectedFile').textContent = value.name;
    element<HTMLInputElement>('field-input').value = value.name;
    const output = element<HTMLInputElement>('field-output');
    if (!output.value || output.value === suggestedOutput) output.value = value.suggestedOutput;
    suggestedOutput = value.suggestedOutput;
    notice(
      value.hasAttributes
        ? 'Original Attributes found. Recovery preserves them automatically.'
        : 'No Attributes component. Recovery analyzes Galaxy and localization automatically.',
    );
  } finally {
    inspectingMap = false;
    if (snapshot) render(snapshot);
  }
}
function configure() {
  const adapter = adapters.find((a) => a.id === element<HTMLSelectElement>('adapter').value)!;
  if (configuredAdapter === adapter.id) return;
  configuredAdapter = adapter.id;
  loadedMap = '';
  element('description').textContent = adapter.description;
  element('fields').replaceChildren();
  const advanced = document.createElement('details');
  const summary = document.createElement('summary');
  summary.textContent = 'Advanced settings';
  advanced.append(summary);
  for (const field of adapter.fields) {
    const container = document.createElement('div');
    container.className = 'field';
    const label = document.createElement('label');
    label.textContent = field.label;
    label.htmlFor = 'field-' + field.key;
    const row = document.createElement('div');
    row.className = 'path';
    const input = document.createElement('input');
    input.id = 'field-' + field.key;
    input.name = field.key;
    input.required = field.required ?? false;
    input.value = automaticDefaults[field.key] || field.initial || '';
    row.append(input);
    if (field.key === 'input') {
      input.oninput = () => {
        loadedMap = '';
        if (snapshot) render(snapshot);
      };
      input.onchange = () => {
        inspectMap(input.value).catch(fail);
      };
    }
    if (field.picker) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'BROWSE';
      button.onclick = async () => {
        button.disabled = true;
        try {
          // Output is deliberately a new, nonexistent child. Start in its parent.
          const initial =
            field.picker === 'output' ? input.value.replace(/[^\\/]+$/, '') : input.value;
          const selected = await choosePath(field.picker!, initial);
          if (selected) {
            input.value =
              field.picker === 'output'
                ? selected.replace(/[\\/]$/, '') + '/Recovered-' + Date.now()
                : selected;
            if (field.key === 'input') await inspectMap(selected);
          }
        } catch (error) {
          fail(error);
        } finally {
          button.disabled = false;
        }
      };
      row.append(button);
    }
    container.append(label, row);
    if (field.help) {
      const help = document.createElement('small');
      help.textContent = field.help;
      container.append(help);
    }
    if (['installation', 'output', 'benchmark'].includes(field.key)) advanced.append(container);
    else element('fields').append(container);
  }
  element('fields').append(advanced);
}
async function artifactText(artifact: Artifact) {
  return (await api<{ text: string }>('artifact?id=' + encodeURIComponent(artifact.id))).text;
}
async function preview(artifact: Artifact) {
  if (artifact.kind === 'archive') return downloadArtifact(artifact);
  const text = await artifactText(artifact);
  if (artifact.kind === 'markup') {
    metrics('markup', text);
    selectedMarkup = artifact;
  } else if (artifact.kind === 'script') metrics('source', text);
  else {
    element('result').textContent = text;
    element('result').parentElement!.setAttribute('open', '');
  }
}
function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob),
    link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
async function downloadArtifact(artifact: Artifact) {
  const result = await response('download?id=' + encodeURIComponent(artifact.id));
  const name = artifact.title.split('/').at(-1)!;
  download(await result.blob(), artifact.kind === 'archive' ? 'Recovered-' + name : name);
}
function render(state: JobSnapshot) {
  snapshot = state;
  const active =
    state.phase === 'running' || (state.phase === 'cancelled' && state.exitCode === undefined);
  element('status').textContent = state.phase.toUpperCase();
  const progress = element<HTMLProgressElement>('progress');
  if (active) progress.removeAttribute('value');
  else progress.value = state.phase === 'finished' ? 1 : 0;
  for (const id of [
    'generate',
    'openFile',
    'settingsButton',
    'fullMode',
    'librariesButton',
    'shutdown',
  ])
    element<HTMLButtonElement>(id).disabled =
      active ||
      ((opening || inspectingMap) && ['generate', 'openFile'].includes(id)) ||
      (id === 'generate' &&
        (!loadedMap || loadedMap !== element<HTMLInputElement>('field-input').value));
  element<HTMLFieldSetElement>('settings').disabled = active;
  element<HTMLButtonElement>('cancel').disabled = !active && !opening;
  element<HTMLButtonElement>('exportFile').disabled =
    active || !state.artifacts.some((a) => a.kind === 'archive');
  const log = element('log'),
    bottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
  if (log.textContent !== state.log)
    log.textContent =
      state.log ||
      'Ready. Choose OPEN MAP, then GENERATE TRIGGERS. The output folder is created automatically.';
  if (bottom) log.scrollTop = log.scrollHeight;
  element('output').textContent = state.output ?? '';
  const resultText = JSON.stringify(state.result, null, 2) ?? '';
  if (resultText !== shownResult) {
    shownResult = resultText;
    element('result').textContent = resultText;
    const report = state.result as
      | {
          status?: string;
          error?: string;
          benchmark?: { passed?: boolean };
          variants?: { status?: string; candidate?: string; benchmark?: { passed?: boolean } }[];
        }
      | undefined;
    element('verdict').replaceChildren();
    if (report) {
      for (const variant of report.variants?.length ? report.variants : [report]) {
        const row = document.createElement('p');
        row.textContent = variant.status ?? 'No qualified verdict';
        row.className = 'verdict';
        element('verdict').append(row);
        if (typeof variant.benchmark?.passed === 'boolean') {
          const benchmark = document.createElement('p');
          benchmark.textContent = variant.benchmark.passed
            ? 'Strict benchmark: matched'
            : 'Strict benchmark: review required';
          element('verdict').append(benchmark);
        }
        if ('candidate' in variant && variant.candidate) {
          const path = document.createElement('p');
          path.className = 'output';
          path.textContent = variant.candidate;
          element('verdict').append(path);
        }
      }
      if (report.error) {
        const error = document.createElement('p');
        error.textContent = report.error.split('\n')[0]!;
        element('verdict').append(error);
        notice(error.textContent);
      }
    }
  }
  const key = JSON.stringify(state.artifacts);
  if (key !== shownArtifacts) {
    shownArtifacts = key;
    element('artifacts').replaceChildren();
    for (const artifact of state.artifacts) {
      const button = document.createElement('button'),
        name = document.createElement('strong'),
        location = document.createElement('small');
      name.textContent = artifact.title.split('/').at(-1)!;
      location.textContent = artifact.title.replace(/^candidates\/recovered\//, '');
      button.append(name, location);
      button.title = artifact.title;
      button.onclick = () => {
        preview(artifact).catch(fail);
      };
      element('artifacts').append(button);
    }
    const markup =
      state.artifacts.find((a) => a.kind === 'markup' && a.title.includes('/components/')) ??
      state.artifacts.find((a) => a.kind === 'markup');
    const source = state.artifacts.find((a) => a.title === 'package/MapScript.galaxy');
    if (markup)
      artifactText(markup)
        .then((text) => {
          selectedMarkup = markup;
          metrics('markup', text);
        })
        .catch(fail);
    if (source)
      artifactText(source)
        .then((text) => metrics('source', text))
        .catch(fail);
    const preparation = state.artifacts.find((a) => a.title === 'preparation.json');
    if (preparation)
      artifactText(preparation)
        .then((text) => {
          const data = JSON.parse(text);
          element('librariesInfo').textContent = JSON.stringify(
            {
              actualChain: data.actualChain,
              libraries: data.dependencyInputs?.map((d: { group: string }) => d.group),
            },
            null,
            2,
          );
        })
        .catch(fail);
  }
}
function showTree() {
  const xml = new DOMParser().parseFromString(
    element<HTMLTextAreaElement>('markup').value,
    'text/xml',
  );
  if (xml.querySelector('parsererror')) throw Error('Invalid XML; inspect the markup panel.');
  element('hierarchy').replaceChildren();
  function branch(node: Element, depth: number): HTMLElement {
    const item = document.createElement('details'),
      summary = document.createElement('summary');
    summary.textContent =
      node.tagName +
      [...node.attributes].map((a) => ` ${a.name}="${a.value}"`).join('') +
      (node.children.length ? '' : ' ' + (node.textContent ?? '').slice(0, 140));
    item.append(summary);
    let loaded = false;
    item.ontoggle = () => {
      if (!item.open || loaded || depth >= 60) return;
      loaded = true;
      for (const child of [...node.children].slice(0, 2000)) item.append(branch(child, depth + 1));
      if (node.children.length > 2000) {
        const warning = document.createElement('p');
        warning.textContent =
          'Preview limited to 2,000 child nodes. The markup panel contains the complete text.';
        item.append(warning);
      }
    };
    return item;
  }
  element('hierarchy').append(branch(xml.documentElement, 0));
  show('treeDialog');
}
// Settings never starts work. Only the main toolbar action can run recovery.
element<HTMLFormElement>('recovery').onsubmit = (event) => event.preventDefault();
element('generate').onclick = async () => {
  if (!loadedMap || inspectingMap || opening) return;
  const form = element<HTMLFormElement>('recovery');
  if (!form.checkValidity()) {
    show('settingsDialog');
    const details = form.querySelector('input:invalid, select:invalid')?.closest('details');
    if (details) details.open = true;
    form.reportValidity();
    return;
  }
  const fields = Object.fromEntries(
    [...element('fields').querySelectorAll('input')].map((input) => [
      input.name,
      input.value.trim(),
    ]),
  );
  try {
    render(
      await api<JobSnapshot>('recover', {
        adapter: element<HTMLSelectElement>('adapter').value,
        fields,
        fullGui: element<HTMLInputElement>('fullGui').checked,
        recoverAttributes: element<HTMLInputElement>('recoverAttributes').checked,
      }),
    );
    notice('Recovery running. See GEN INFO for live output.');
  } catch (error) {
    fail(error);
  }
};
element('openFile').onclick = async () => {
  if (opening) return;
  opening = true;
  element<HTMLButtonElement>('openFile').disabled = true;
  element<HTMLButtonElement>('cancel').disabled = false;
  notice('Choose one map in the file picker.');
  try {
    const selected = await choosePath('map', element<HTMLInputElement>('field-input').value);
    if (selected) await inspectMap(selected);
    else notice('File selection cancelled. You can also paste the map path in Settings.');
  } catch (error) {
    fail(error);
  } finally {
    opening = false;
    if (snapshot) render(snapshot);
  }
};
element('settingsButton').onclick = () => show('settingsDialog');
element('librariesButton').onclick = () => show('librariesDialog');
element('infoButton').onclick = () => show('infoDialog');
element('treeButton').onclick = () => {
  try {
    showTree();
  } catch (error) {
    fail(error);
  }
};
element('saveMarkup').onclick = () => {
  if (selectedMarkup) downloadArtifact(selectedMarkup).catch(fail);
  else download(new Blob([originalMarkupText], { type: 'application/xml' }), 'Triggers');
};
element('exportFile').onclick = () => {
  const archive = snapshot?.artifacts.find((a) => a.kind === 'archive');
  if (archive) {
    if (snapshot?.phase === 'failed')
      notice('This is an unverified diagnostic map; inspect GEN INFO before using it.');
    downloadArtifact(archive).catch(fail);
  }
};
element('fullMode').onclick = () => {
  const input = element<HTMLInputElement>('fullGui');
  input.checked = !input.checked;
  fullMode();
};
element('fullGui').onchange = fullMode;
element('cancel').onclick = () => {
  if (opening) {
    finishPicker();
    return;
  }
  api<JobSnapshot>('cancel', {}).then(render).catch(fail);
};
element('shutdown').onclick = () => {
  api('shutdown', {})
    .then(() => {
      document.body.textContent = 'Trigger Revize KSP stopped. You may close this tab.';
    })
    .catch(fail);
};
element<HTMLSelectElement>('adapter').onchange = configure;
element('fullscreen').onclick = async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch (error) {
    fail(error);
  }
};
document.addEventListener('fullscreenchange', () => {
  element('fullscreen').textContent = document.fullscreenElement ? 'IN WINDOW' : 'FULL SCREEN';
});
for (const button of document.querySelectorAll<HTMLButtonElement>('[data-close]'))
  button.onclick = () => element<HTMLDialogElement>(button.dataset.close!).close();
for (const target of ['markup', 'source'] as const)
  element('search' + (target === 'markup' ? 'Markup' : 'Source')).onclick = () => {
    searchTarget = target;
    show('searchDialog');
    element<HTMLInputElement>('query').focus();
  };
element('findNext').onclick = () => {
  const input = element<HTMLTextAreaElement>(searchTarget),
    query = element<HTMLInputElement>('query').value;
  if (!query) return;
  let found = input.value.toLowerCase().indexOf(query.toLowerCase(), input.selectionEnd);
  if (found < 0) found = input.value.toLowerCase().indexOf(query.toLowerCase());
  if (found < 0) {
    element('searchStatus').textContent = 'No match';
    return;
  }
  element<HTMLDialogElement>('searchDialog').close();
  input.focus();
  input.setSelectionRange(found, found + query.length);
  input.scrollTop = input.value.slice(0, found).split('\n').length * 19 - input.clientHeight / 2;
};
const divider = document.querySelector<HTMLElement>('.divider')!;
function splitAt(percent: number) {
  document.querySelector<HTMLElement>('main')!.style.gridTemplateColumns =
    `minmax(0,${percent}fr) 8px minmax(0,${100 - percent}fr)`;
}
divider.onpointerdown = (event) => {
  divider.setPointerCapture(event.pointerId);
};
divider.onpointermove = (event) => {
  if (!divider.hasPointerCapture(event.pointerId)) return;
  const bounds = divider.parentElement!.getBoundingClientRect();
  splitAt(Math.max(15, Math.min(85, ((event.clientX - bounds.left) / bounds.width) * 100)));
};
divider.onpointerup = (event) => divider.releasePointerCapture(event.pointerId);
divider.onkeydown = (event) => {
  if (event.key === 'ArrowLeft') splitAt(40);
  if (event.key === 'ArrowRight') splitAt(60);
  if (event.key === 'Home') splitAt(50);
};
window.addEventListener('beforeunload', (event) => {
  if (snapshot?.phase === 'running') event.preventDefault();
});
async function initialize() {
  adapters = await api<RecoveryAdapter[]>('adapters');
  const defaults = await api<Record<string, string>>('defaults');
  automaticDefaults = defaults;
  element('installationStatus').textContent = defaults.installationStatus ?? '';
  element('benchmarkStatus').textContent = defaults.benchmarkStatus ?? '';
  for (const adapter of adapters) {
    const option = document.createElement('option');
    option.value = adapter.id;
    option.textContent = adapter.title;
    element('adapter').append(option);
  }
  const state = await api<JobSnapshot>('state');
  if (state.request) element<HTMLSelectElement>('adapter').value = state.request.adapter;
  configure();
  if (state.request)
    for (const [key, value] of Object.entries(state.request.fields)) {
      const input = document.getElementById('field-' + key) as HTMLInputElement | null;
      if (input) input.value = value;
    }
  if (state.request) {
    element<HTMLInputElement>('fullGui').checked = state.request.fullGui;
    element<HTMLInputElement>('recoverAttributes').checked =
      state.request.recoverAttributes !== false;
    loadedMap = state.request.fields.input ?? '';
    element('selectedFile').textContent = state.request.fields.input ?? '';
  }
  fullMode();
  render(state);
  async function poll() {
    try {
      render(await api<JobSnapshot>('state'));
    } catch (error) {
      fail(error);
      return;
    }
    setTimeout(poll, 1000);
  }
  setTimeout(poll, 1000);
}
initialize().catch(fail);
