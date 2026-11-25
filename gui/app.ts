import { createFilePicker } from './picker.js';
import { buildHierarchy, renderHierarchy } from './hierarchy.js';
import { createEditorSearch } from './search.js';
import { createSettingsView } from './settings-view.js';
import { createCodeViews } from './code-view.js';
import type {
  RecoveryAdapter,
  JobSnapshot,
  Artifact,
  AttributePreview,
  DocumentPreview,
} from './contracts.js';

const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const token = document.querySelector<HTMLMetaElement>('meta[name="session-token"]')!.content;
let adapters: RecoveryAdapter[] = [];
let snapshot: JobSnapshot;
let shownArtifacts = '';
let shownResult = '';
let originalMarkupText = '';
let markupRequest = '';
let attributesRequest = 0;
let opening = false;
let loadedMap = '';
let recoveryNotice = '';
let sourceFiles: DocumentPreview['sourceFiles'] = [];
let inspectingMap = false;
let canRepairGalaxyCopy = false;
let automaticDefaults: Record<string, string> = {};
let suggestedOutput = '';
let configuredAdapter = '';
let shownPhase = '';
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
const { choosePath, cancel: finishPicker } = createFilePicker(api);
const settingsView = createSettingsView(api, choosePath);
const updateCodeView = createCodeViews();

function metrics(target: 'markup' | 'source', text: string) {
  const editor = element<HTMLTextAreaElement>(target);
  editor.value = text;
  editor.dispatchEvent(new Event('documentchange'));
  const normalized = editor.value;
  const count = updateCodeView(target, normalized);
  const lines = normalized ? count - Number(normalized.endsWith('\n')) : 0;
  // The final empty editor row needs a gutter even though it is not a source line.
  element(target + 'Lines').textContent = Array.from({ length: count }, (_, i) =>
    String(i + 1),
  ).join('\n');
  element(target + 'Metric').textContent = `${lines.toLocaleString()} lines`;
  element(target + 'Metric').title = `${text.length.toLocaleString()} characters`;
  if (target === 'markup') {
    // Textarea.value normalizes CRLF. Retain source text for exact XML export.
    originalMarkupText = text;
    element<HTMLButtonElement>('exportFile').disabled = !text;
    element<HTMLButtonElement>('treeButton').disabled = !text;
  }
}
async function inspectMap(file: string) {
  if (!file) return;
  loadedMap = '';
  markupRequest = '';
  attributesRequest++;
  canRepairGalaxyCopy = false;
  inspectingMap = true;
  if (snapshot) render(snapshot);
  notice('Reading original archive...');
  try {
    const value = await api<DocumentPreview>('inspect', {
      adapter: element<HTMLSelectElement>('adapter').value,
      path: file,
    });
    metrics('source', value.source);
    sourceFiles = value.sourceFiles;
    const sourceFile = element<HTMLSelectElement>('sourceFile');
    sourceFile.replaceChildren(...sourceFiles.map((file) => new Option(file.path, file.path)));
    sourceFile.hidden = sourceFiles.length < 2;
    sourceFile.title = sourceFiles[0]?.path ?? 'No Galaxy source';
    recoveryNotice = value.recoveryNotice ?? '';
    canRepairGalaxyCopy = value.canRepairGalaxyCopy === true;
    metrics('markup', value.markup);
    loadedMap = value.name;
    element('selectedFile').textContent = value.name;
    element<HTMLInputElement>('field-input').value = value.name;
    const output = element<HTMLInputElement>('field-output');
    if (!output.value || output.value === suggestedOutput) output.value = value.suggestedOutput;
    suggestedOutput = value.suggestedOutput;
    notice(
      recoveryNotice ||
        (value.hasAttributes
          ? 'Original Attributes found. Recovery preserves them automatically.'
          : 'No Attributes component. Recovery analyzes Galaxy and localization automatically.'),
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
    element('fields').append(container);
  }
}
async function artifactText(artifact: Artifact) {
  const route = 'artifact?id=' + encodeURIComponent(artifact.id);
  return artifact.kind === 'markup'
    ? (await response(route + '&format=text')).text()
    : (await api<{ text: string }>(route)).text;
}
async function preview(artifact: Artifact) {
  if (artifact.kind === 'archive') return downloadArtifact(artifact);
  const text = await artifactText(artifact);
  if (artifact.kind === 'markup') {
    metrics('markup', text);
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
  const prefix = artifact.draft ? 'Draft-' : artifact.kind === 'archive' ? 'Recovered-' : '';
  download(await result.blob(), prefix + name);
}
function render(state: JobSnapshot) {
  snapshot = state;
  const active =
    state.phase === 'running' || (state.phase === 'cancelled' && state.exitCode === undefined);
  const percent = state.progress?.percent ?? (state.phase === 'finished' ? 100 : 0);
  const estimate = percent > 0 && percent < 100 ? '~' : '';
  element('status').textContent = `${state.phase.toUpperCase()} · ${estimate}${percent}%`;
  const progress = element<HTMLProgressElement>('progress');
  progress.value = percent / 100;
  progress.title = `${state.progress?.stage ?? 'Ready'}. Estimated progress by stage, not remaining time.`;
  progress.setAttribute('aria-label', progress.title);
  element('progressStage').textContent = state.progress?.stage ?? 'Ready';
  element('progressStage').title = progress.title;
  if (shownPhase !== state.phase) {
    shownPhase = state.phase;
    if (state.phase === 'failed')
      notice(state.error || 'Recovery failed. Open GEN INFO for details.');
    else if (state.phase === 'cancelled') notice('Recovery cancelled. The original is unchanged.');
  }
  for (const id of ['generate', 'openFile', 'settingsButton', 'librariesButton', 'shutdown'])
    element<HTMLButtonElement>(id).disabled =
      active ||
      ((opening || inspectingMap) && ['generate', 'openFile'].includes(id)) ||
      (id === 'generate' &&
        (!loadedMap || loadedMap !== element<HTMLInputElement>('field-input').value));
  element('generate').title = recoveryNotice;
  const repair = element<HTMLButtonElement>('repairGalaxyCopy');
  repair.hidden = !canRepairGalaxyCopy;
  repair.disabled = active || opening || inspectingMap || !loadedMap;
  element<HTMLFieldSetElement>('settings').disabled = active;
  element<HTMLButtonElement>('cancel').disabled = !active && !opening;
  const insert = element<HTMLButtonElement>('insertTriggers');
  insert.disabled =
    state.phase === 'cancelled' ||
    (active ? !state.recoveredMarkup : !(state.recoveredArchive || state.recoveredMarkup));
  insert.textContent = state.recoveredArchive?.draft
    ? 'DOWNLOAD DRAFT'
    : !state.recoveredArchive && state.recoveredMarkup
      ? 'DOWNLOAD TRIGGERS XML'
      : /\.sc2mod$/i.test(state.recoveredArchive?.title ?? loadedMap ?? '')
        ? 'INSERT TRIGGERS INTO MOD'
        : 'INSERT TRIGGERS INTO MAP';
  insert.title = state.recoveredArchive?.draft
    ? 'Download the packed draft. Validation did not finish.'
    : !state.recoveredArchive && state.recoveredMarkup
      ? state.phase === 'running'
        ? 'Download the recovered XML while the map is being verified'
        : 'Download the recovered XML'
      : 'Save a copy with embedded triggers';
  element<HTMLButtonElement>('exportFile').disabled = active || !originalMarkupText;
  element<HTMLButtonElement>('treeButton').disabled = active || !originalMarkupText;
  element<HTMLButtonElement>('attributesButton').disabled = !loadedMap || inspectingMap;
  const recovered = element<HTMLSelectElement>('attributeSource').options[1];
  if (recovered) {
    recovered.disabled = !state.recoveredArchive;
    recovered.text = state.recoveredArchive?.draft ? 'Recovered draft' : 'Recovered copy';
  }
  element<HTMLButtonElement>('infoButton').disabled = !state.request && !state.result;
  element('issueCount').textContent =
    'Issues: ' +
    (state.phase === 'failed'
      ? '1 or more'
      : state.phase === 'running'
        ? 'pending'
        : state.result
          ? 'see verdict'
          : '0');
  const log = element('log'),
    bottom = log.scrollTop + log.clientHeight >= log.scrollHeight - 30;
  if (log.textContent !== state.log)
    log.textContent =
      state.log ||
      'Ready. Open a map and generate triggers. INSERT TRIGGERS INTO MAP saves a copy with the triggers embedded.';
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
          warning?: string;
          dependencyWarnings?: {
            substitutions?: { reference: string; file: string }[];
            packages?: string[];
            includes?: { from: string; include: string; symbols: string[] }[];
          };
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
      const warnings = report.dependencyWarnings;
      if (warnings) {
        const lines = [
          ...(warnings.substitutions ?? []).map(({ reference, file }) => reference + ' → ' + file),
          ...(warnings.packages ?? []).map((name) => 'Unavailable dependency: ' + name),
          ...(warnings.includes ?? []).map(
            ({ from, include, symbols }) =>
              from +
              ' · missing include ' +
              include +
              (symbols.length ? ' · ' + symbols.join(', ') : ''),
          ),
        ];
        for (const line of lines) {
          const warning = document.createElement('p');
          warning.textContent = line;
          element('verdict').append(warning);
        }
        if (lines.length)
          notice(report.warning ?? 'Local dependency substitutes used. See GEN INFO.');
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
    const archiveFolder = state.recoveredArchive?.title.split('/').slice(0, -1).join('/');
    const markup =
      state.artifacts.find((a) => a.title === archiveFolder + '/components/Triggers') ??
      state.artifacts.find((a) => a.kind === 'markup' && a.title.includes('/components/')) ??
      state.artifacts.find((a) => a.kind === 'markup');
    const source = state.artifacts.find((a) => a.title === 'package/MapScript.galaxy');
    const requestedMarkup = markup ? `${state.output}/${markup.title}` : '';
    if (markup && requestedMarkup !== markupRequest) {
      markupRequest = requestedMarkup;
      artifactText(markup)
        .then((text) => {
          if (markupRequest === requestedMarkup) metrics('markup', text);
        })
        .catch((error) => {
          if (markupRequest === requestedMarkup) fail(error);
        });
    }
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
  renderHierarchy(element('hierarchy'), buildHierarchy(xml), element('treeCount'));
  const dialog = element<HTMLDialogElement>('treeDialog');
  if (!dialog.open) dialog.show();
}
async function loadAttributes() {
  const requested = ++attributesRequest;
  const source = element<HTMLSelectElement>('attributeSource').value;
  const status = element('attributesStatus');
  const definitions = element('attributeDefinitions');
  const raw = element<HTMLDetailsElement>('attributeRaw');
  definitions.replaceChildren();
  raw.hidden = true;
  raw.open = false;
  element('attributeXml').textContent = '';
  status.textContent = 'Reading map attributes…';
  try {
    const result = await api<AttributePreview>('attributes?source=' + encodeURIComponent(source));
    if (requested !== attributesRequest) return;
    status.textContent = !result.present
      ? 'This map copy has no Attributes component.'
      : result.error
        ? 'Unable to interpret Attributes. ' + result.error
        : `${result.definitions.length.toLocaleString()} attributes · ${result.variants.toLocaleString()} variants`;
    if (result.inferred)
      status.textContent +=
        ' · Inferred from Galaxy and map strings; original lobby settings require review.';
    for (const attribute of result.definitions) {
      const details = document.createElement('details');
      const summary = document.createElement('summary');
      summary.textContent = [
        attribute.name,
        attribute.type,
        attribute.name !== attribute.id ? attribute.id : '',
      ]
        .filter(Boolean)
        .join(' · ');
      details.append(summary);
      if (attribute.defaults.length) {
        const defaults = document.createElement('p');
        defaults.textContent =
          'Default · ' +
          attribute.defaults
            .map(({ slot, value }) => (slot === 'Global' ? value : slot + ' · ' + value))
            .join(', ');
        details.append(defaults);
      }
      const values = document.createElement('ul');
      for (const value of attribute.values) {
        const item = document.createElement('li');
        item.textContent = value.name === value.id ? value.id : `${value.name} (${value.id})`;
        values.append(item);
      }
      details.append(values);
      definitions.append(details);
    }
    raw.hidden = result.xml === undefined;
    element('attributeXml').textContent = result.xml ?? '';
  } catch (error) {
    if (requested === attributesRequest) status.textContent = String(error);
  }
}
// Settings never starts work. Only the main toolbar action can run recovery.
element<HTMLFormElement>('recovery').onsubmit = (event) => event.preventDefault();
async function startRecovery(repairGalaxyCopy = false) {
  if (!loadedMap || inspectingMap || opening) return;
  const form = element<HTMLFormElement>('recovery');
  if (!form.checkValidity()) {
    show('settingsDialog');
    for (const details of form.querySelectorAll('details')) details.open = true;
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
        firstAttributeDefaults: element<HTMLInputElement>('firstAttributeDefaults').checked,
        ...(repairGalaxyCopy ? { repairGalaxyCopy } : {}),
        libraryRoots: settingsView.libraryRoots(),
      }),
    );
    notice('Recovery running. See GEN INFO for live output.');
  } catch (error) {
    fail(error);
  }
}
element('generate').onclick = () => void startRecovery();
element('repairGalaxyCopy').onclick = () => void startRecovery(true);
element('openFile').onclick = async () => {
  if (opening) return;
  opening = true;
  element<HTMLButtonElement>('openFile').disabled = true;
  element<HTMLButtonElement>('cancel').disabled = false;
  notice('Choose one .SC2Map or .SC2Mod file.');
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
element<HTMLSelectElement>('sourceFile').onchange = (event) => {
  const selected = (event.target as HTMLSelectElement).value;
  const file = sourceFiles.find((entry) => entry.path === selected);
  if (file) {
    metrics('source', file.text);
    element('sourceFile').title = selected;
    element<HTMLTextAreaElement>('source').scrollTop = 0;
    element<HTMLTextAreaElement>('source').scrollLeft = 0;
    element<HTMLTextAreaElement>('source').dispatchEvent(new Event('scroll'));
  }
};
element('librariesButton').onclick = () => show('librariesDialog');
element('infoButton').onclick = () => show('infoDialog');
element('attributesButton').onclick = () => {
  element<HTMLSelectElement>('attributeSource').value = snapshot?.recoveredArchive
    ? 'candidate'
    : 'original';
  show('attributesDialog');
  void loadAttributes();
};
element('attributeSource').onchange = () => void loadAttributes();
element('treeButton').onclick = () => {
  try {
    showTree();
  } catch (error) {
    fail(error);
  }
};
element('insertTriggers').onclick = () => {
  const artifact = snapshot?.recoveredArchive ?? snapshot?.recoveredMarkup;
  if (!artifact || snapshot?.phase === 'cancelled') return;
  downloadArtifact(artifact)
    .then(() =>
      notice(
        artifact.draft
          ? 'Draft downloaded with embedded triggers. Review the failure in GEN INFO.'
          : artifact.kind === 'markup'
            ? 'Recovered Triggers XML downloaded.'
            : 'Download started. The recovered copy contains the embedded triggers.',
      ),
    )
    .catch(fail);
};
element('exportFile').onclick = () => show('exportDialog');
element<HTMLFormElement>('exportForm').onsubmit = (event) => {
  event.preventDefault();
  const name = element<HTMLInputElement>('exportName').value.trim();
  if (!name || /[<>:"/\\|?*\x00-\x1f]/.test(name) || name === '.' || name === '..') {
    notice('Enter a file name without path separators.');
    return;
  }
  const text = originalMarkupText;
  element<HTMLDialogElement>('exportDialog').close();
  element<HTMLButtonElement>('exportFile').focus();
  requestAnimationFrame(() => {
    setTimeout(() => download(new Blob([text], { type: 'application/xml' }), name), 0);
  });
};
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
createEditorSearch();
for (const target of ['markup', 'source'] as const) {
  const editor = element<HTMLTextAreaElement>(target),
    gutter = element(target + 'Lines');
  editor.addEventListener('scroll', () => {
    gutter.scrollTop = editor.scrollTop;
  });
}
// Search and hierarchy are nonmodal inspector windows, like the JavaFX tools.
for (const dialog of document.querySelectorAll<HTMLDialogElement>('dialog')) {
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog || dialog.id === 'fileDialog') return;
    const r = dialog.getBoundingClientRect();
    const mouse = event as MouseEvent;
    if (
      mouse.clientX < r.left ||
      mouse.clientX > r.right ||
      mouse.clientY < r.top ||
      mouse.clientY > r.bottom
    )
      dialog.close();
  });
  const heading = dialog.querySelector<HTMLElement>('.dialog-heading');
  if (!heading || !['searchDialog', 'treeDialog', 'infoDialog'].includes(dialog.id)) continue;
  let offset: { x: number; y: number } | undefined;
  heading.onpointerdown = (event) => {
    if ((event.target as Element).closest('button')) return;
    const r = dialog.getBoundingClientRect();
    offset = { x: event.clientX - r.left, y: event.clientY - r.top };
    heading.setPointerCapture(event.pointerId);
  };
  heading.onpointermove = (event) => {
    if (!offset) return;
    dialog.style.margin = '0';
    dialog.style.left =
      Math.max(0, Math.min(innerWidth - dialog.offsetWidth, event.clientX - offset.x)) + 'px';
    dialog.style.top = Math.max(0, Math.min(innerHeight - 60, event.clientY - offset.y)) + 'px';
  };
  heading.onpointerup = () => {
    offset = undefined;
  };
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !document.querySelector('dialog:modal')) {
    const open = [...document.querySelectorAll<HTMLDialogElement>('dialog[open]')].at(-1);
    open?.close();
  }
});
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
  await settingsView.initialize();
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
