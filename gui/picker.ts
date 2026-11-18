/** TypeScript counterpart of the Localization Editor KSP's in-app Open File.
 * The bridge supplies read-only paths; this component owns selection and focus. */
import type { FileListing, FilePlace, PickerKind } from './contracts.js';
type Entry = FileListing['entries'][number];
type Api = <T>(route: string, data?: unknown) => Promise<T>;

export function createFilePicker(api: Api) {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  const dialog = el<HTMLDialogElement>('fileDialog');
  const name = el<HTMLInputElement>('fileName');
  const search = el<HTMLInputElement>('fileSearch');
  const pathField = el<HTMLInputElement>('filePath');
  let pathEdits = 0;
  let nameEdits = 0;
  pathField.oninput = () => {
    pathEdits++;
  };
  let current:
    | {
        kind: PickerKind;
        directory: string;
        parent: string;
        entries: Entry[];
        selected?: Entry;
        truncated: boolean;
        resolve: (value: string) => void;
      }
    | undefined;
  let revision = 0;
  const folderMode = () => current?.kind === 'folder' || current?.kind === 'output';
  const navigable = (entry: Entry) => entry.directory && !entry.package;
  const cancel = (value = '') => {
    const previous = current;
    current = undefined;
    revision++;
    dialog.close();
    previous?.resolve(value);
  };
  function updateSelection() {
    if (!current) return;
    el('fileSelection').textContent =
      current.selected?.path || (folderMode() ? current.directory : 'No file selected');
    el<HTMLButtonElement>('fileAccept').disabled = folderMode()
      ? !current.directory
      : !current.selected;
    el('fileAccept').textContent = folderMode()
      ? 'USE THIS FOLDER'
      : current.selected && navigable(current.selected)
        ? 'OPEN FOLDER'
        : 'OPEN FILE';
    for (const button of el('fileEntries').querySelectorAll<HTMLButtonElement>('button'))
      button.setAttribute('aria-pressed', String(button.dataset.path === current.selected?.path));
  }
  function renderEntries() {
    if (!current) return;
    const query = search.value.toLocaleLowerCase();
    const entries = current.entries.filter((entry) =>
      entry.name.toLocaleLowerCase().includes(query),
    );
    el('fileEntries').replaceChildren();
    for (const entry of entries) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'file-entry';
      button.dataset.path = entry.path;
      button.dataset.name = entry.name;
      button.title = entry.path;
      const title = document.createElement('span');
      title.className = 'file-entry-name';
      title.textContent = (navigable(entry) ? '▸ ' : '') + entry.name;
      const type = document.createElement('span');
      type.className = 'file-entry-type';
      type.textContent = entry.package
        ? /\.sc2mod$/i.test(entry.name)
          ? 'SC2 mod (components)'
          : 'SC2 map (components)'
        : entry.directory
          ? 'Folder'
          : current.kind === 'map'
            ? /\.sc2mod$/i.test(entry.name)
              ? 'StarCraft II mod'
              : 'StarCraft II map'
            : current.kind === 'json'
              ? 'JSON file'
              : current.kind === 'audio'
                ? 'Audio file'
                : 'SC2 package';
      button.append(title, type);
      button.onclick = () => {
        if (!current) return;
        current.selected = entry;
        name.value = navigable(entry) ? '' : entry.name;
        updateSelection();
      };
      button.ondblclick = () => (navigable(entry) ? void navigate(entry.path) : cancel(entry.path));
      button.onkeydown = (event) => {
        if (event.key === 'Enter') {
          event.preventDefault();
          if (navigable(entry)) void navigate(entry.path);
          else cancel(entry.path);
        }
      };
      el('fileEntries').append(button);
    }
    el('fileStatus').textContent = current.truncated
      ? `${entries.length} matching entries shown. Paste a full path for items beyond the first 5,000.`
      : `${entries.length} of ${current.entries.length} entries`;
    updateSelection();
  }
  async function navigate(requested = '') {
    const owner = current;
    if (!owner) return;
    const request = ++revision;
    const pathVersion = pathEdits;
    const nameVersion = nameEdits;
    pathField.value = requested;
    owner.directory = '';
    owner.parent = '';
    owner.entries = [];
    owner.selected = undefined;
    name.value = '';
    search.value = '';
    el('fileEntries').replaceChildren();
    el('fileStatus').textContent = 'Reading folder…';
    updateSelection();
    try {
      const listing = await api<FileListing>('files', { kind: owner.kind, path: requested });
      if (current !== owner || request !== revision) return;
      Object.assign(owner, {
        directory: listing.directory,
        parent: listing.parent,
        entries: listing.entries,
        truncated: listing.truncated,
      });
      // Async navigation must not overwrite a path or filename typed meanwhile.
      owner.selected = listing.entries.find((entry) =>
        nameEdits !== nameVersion
          ? !navigable(entry) && entry.name.toLocaleLowerCase() === name.value.toLocaleLowerCase()
          : entry.path === listing.selected,
      );
      if (nameEdits === nameVersion) name.value = owner.selected?.name || '';
      if (pathEdits === pathVersion) pathField.value = listing.directory;
      el<HTMLButtonElement>('fileUp').disabled = listing.parent === listing.directory;
      for (const button of el('filePlaces').querySelectorAll<HTMLButtonElement>('button'))
        button.setAttribute('aria-pressed', String(button.dataset.path === listing.directory));
      renderEntries();
    } catch (error) {
      if (current !== owner || request !== revision) return;
      el('fileStatus').textContent = String(error);
    }
  }
  function accept() {
    if (!current) return;
    if (folderMode()) cancel(current.selected?.path || current.directory);
    else if (current.selected && navigable(current.selected)) void navigate(current.selected.path);
    else if (current.selected) cancel(current.selected.path);
  }
  async function places(owner: NonNullable<typeof current>) {
    try {
      const locations = await api<FilePlace[]>('places');
      if (current !== owner) return;
      el('filePlaces').replaceChildren();
      for (const place of locations) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = place.name;
        button.title = place.path;
        button.dataset.path = place.path;
        button.setAttribute('aria-pressed', String(place.path === owner.directory));
        button.onclick = () => void navigate(place.path);
        el('filePlaces').append(button);
      }
    } catch {
      /* Path navigation remains available if a disk cannot be enumerated. */
    }
  }
  function choosePath(kind: PickerKind, initial = ''): Promise<string> {
    if (current) return Promise.reject(Error('A file picker is already open.'));
    const folder = kind === 'folder' || kind === 'output';
    el('fileTitle').textContent = folder ? 'OPEN FOLDER' : 'OPEN FILE';
    el('fileHelp').textContent =
      kind === 'output'
        ? 'Choose a parent folder. Recovery creates a new folder inside it.'
        : folder
          ? 'Choose a folder from the list or use the path above.'
          : 'Select an SC2 archive or component package. Double-click or press Enter to open it.';
    const filter = el<HTMLSelectElement>('fileFilter');
    filter.replaceChildren(
      new Option(
        folder
          ? 'Folders'
          : kind === 'map'
            ? 'SC2 maps and mods (*.SC2Map, *.SC2Mod)'
            : kind === 'json'
              ? 'JSON files (*.json)'
              : kind === 'audio'
                ? 'Audio (*.wav, *.mp3, *.ogg, *.m4a)'
                : 'SC2 maps and mods (*.SC2Map, *.SC2Mod)',
        kind,
      ),
    );
    el('fileNameRow').hidden = folder;
    el<HTMLInputElement>('filePath').value = initial;
    el('filePlaces').replaceChildren();
    return new Promise((resolve) => {
      current = { kind, directory: '', parent: '', entries: [], truncated: false, resolve };
      dialog.showModal();
      void places(current);
      void navigate(initial);
    });
  }
  el<HTMLFormElement>('fileNavigation').onsubmit = (event) => {
    event.preventDefault();
    void navigate(el<HTMLInputElement>('filePath').value);
  };
  el('fileUp').onclick = () => {
    if (current?.parent) void navigate(current.parent);
  };
  el('fileAccept').onclick = accept;
  name.oninput = () => {
    nameEdits++;
    if (!current) return;
    current.selected = current.entries.find(
      (entry) =>
        !navigable(entry) && entry.name.toLocaleLowerCase() === name.value.toLocaleLowerCase(),
    );
    updateSelection();
  };
  name.onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      accept();
    }
  };
  search.oninput = () => {
    if (
      current?.selected &&
      !current.selected.name.toLocaleLowerCase().includes(search.value.toLocaleLowerCase())
    ) {
      current.selected = undefined;
      name.value = '';
    }
    renderEntries();
  };
  for (const id of ['fileCancel', 'fileCancelX']) el(id).onclick = () => cancel();
  dialog.oncancel = (event) => {
    event.preventDefault();
    cancel();
  };
  return { choosePath, cancel };
}
