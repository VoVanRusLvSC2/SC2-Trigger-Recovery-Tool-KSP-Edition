import type { Preferences } from './preferences.js';
import type { PickerKind } from './contracts.js';

type Api = <T>(route: string, data?: unknown) => Promise<T>;
export function createSettingsView(
  api: Api,
  choosePath: (kind: PickerKind, initial?: string) => Promise<string>,
) {
  const el = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
  let preferences: Preferences;
  let timer: ReturnType<typeof setTimeout>;
  const audio = new Audio();
  audio.loop = true;
  let audioPath = '',
    audioUrl = '',
    audioRevision = 0;
  let saving = Promise.resolve();
  function values(): Preferences {
    return {
      ...preferences,
      recoverAttributes: el<HTMLInputElement>('recoverAttributes').checked,
      fullGui: el<HTMLInputElement>('fullGui').checked,
      musicEnabled: el<HTMLInputElement>('musicEnabled').checked,
      musicVolume: Number(el<HTMLInputElement>('musicVolume').value),
      backgroundOpacity: Number(el<HTMLInputElement>('backgroundOpacity').value),
      musicPath: el<HTMLInputElement>('musicPath').value,
    };
  }
  async function playback() {
    audio.volume = preferences.musicVolume;
    if (!preferences.musicEnabled || !preferences.musicPath) {
      audio.pause();
      return;
    }
    const revision = ++audioRevision;
    try {
      if (audioPath !== preferences.musicPath) {
        const token = document.querySelector<HTMLMetaElement>(
          'meta[name="session-token"]',
        )!.content;
        const result = await fetch('/api/music', {
          method: 'POST',
          headers: { 'X-Recovery-Token': token, 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: preferences.musicPath }),
        });
        if (!result.ok) throw Error((await result.json()).error);
        const blob = await result.blob();
        if (revision !== audioRevision || !preferences.musicEnabled) return;
        if (audioUrl) URL.revokeObjectURL(audioUrl);
        audioUrl = URL.createObjectURL(blob);
        audio.src = audioUrl;
        audioPath = preferences.musicPath;
      }
      if (revision === audioRevision) await audio.play();
    } catch (error) {
      el('preferenceStatus').textContent = 'Music: ' + String(error);
    }
  }
  function appearance() {
    document.documentElement.style.setProperty(
      '--background-opacity',
      String(preferences.backgroundOpacity),
    );
    for (const key of ['musicVolume', 'backgroundOpacity'] as const)
      el(key + 'Value').textContent = Math.round(preferences[key] * 100) + '%';
    el<HTMLInputElement>('musicVolume').disabled = !preferences.musicEnabled;
    audio.volume = preferences.musicVolume;
  }
  function persist() {
    preferences = values();
    appearance();
    clearTimeout(timer);
    el('preferenceStatus').textContent = 'Saving settings…';
    timer = setTimeout(() => {
      void flush().catch(() => {});
    }, 120);
  }
  async function flush() {
    clearTimeout(timer);
    const data = structuredClone(preferences);
    saving = saving
      .catch(() => {})
      .then(async () => {
        try {
          await api('preferences', data);
          el('preferenceStatus').textContent = 'Settings saved';
        } catch (error) {
          el('preferenceStatus').textContent = 'Settings could not be saved: ' + error;
          throw error;
        }
      });
    await saving;
  }
  function libraryList() {
    const roots = preferences.libraryRoots;
    el('librarySummary').textContent =
      `Enabled: ${roots.filter((r) => r.enabled).length} / ${roots.length}`;
    el('libraryList').replaceChildren();
    for (const entry of roots) {
      const row = document.createElement('div');
      row.className = 'library-row';
      const label = document.createElement('label');
      label.className = 'check';
      const check = document.createElement('input');
      check.type = 'checkbox';
      check.checked = entry.enabled;
      check.onchange = () => {
        entry.enabled = check.checked;
        persist();
        libraryList();
      };
      label.append(check, document.createTextNode(entry.path));
      const remove = document.createElement('button');
      remove.textContent = 'REMOVE';
      remove.onclick = () => {
        preferences.libraryRoots = roots.filter((r) => r !== entry);
        persist();
        libraryList();
      };
      row.append(label, remove);
      el('libraryList').append(row);
    }
  }
  async function addLibrary(value: string) {
    if (!value.trim()) return;
    try {
      const result = await api<{ path: string }>('library-root', { path: value });
      if (!preferences.libraryRoots.some((r) => r.path.toLowerCase() === result.path.toLowerCase()))
        preferences.libraryRoots.push({ path: result.path, enabled: true });
      el<HTMLInputElement>('libraryPath').value = '';
      el('libraryStatus').textContent =
        'Dependency search root added. Only packages referenced by the map are loaded.';
      persist();
      libraryList();
    } catch (error) {
      el('libraryStatus').textContent = String(error);
    }
  }
  for (const key of [
    'recoverAttributes',
    'fullGui',
    'musicEnabled',
    'musicVolume',
    'backgroundOpacity',
  ])
    el(key).addEventListener('input', () => {
      persist();
      if (key === 'musicEnabled') void playback();
    });
  el('chooseMusic').onclick = async () => {
    const selected = await choosePath('audio', preferences.musicPath);
    if (selected) {
      el<HTMLInputElement>('musicPath').value = selected;
      persist();
      await playback();
    }
  };
  el('addLibrary').onclick = () => void addLibrary(el<HTMLInputElement>('libraryPath').value);
  el<HTMLInputElement>('libraryPath').onkeydown = (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      void addLibrary(el<HTMLInputElement>('libraryPath').value);
    }
  };
  for (const [button, kind] of [
    ['addLibraryFile', 'library'],
    ['addLibraryFolder', 'folder'],
  ] as const)
    el(button).onclick = async () => {
      const selected = await choosePath(kind);
      if (selected) await addLibrary(selected);
    };
  document.addEventListener(
    'pointerdown',
    () => {
      if (preferences?.musicEnabled && audio.paused) void playback();
    },
    { once: true },
  );
  return {
    async initialize() {
      preferences = await api<Preferences>('preferences');
      for (const key of ['recoverAttributes', 'fullGui', 'musicEnabled'] as const)
        el<HTMLInputElement>(key).checked = preferences[key];
      for (const key of ['musicVolume', 'backgroundOpacity', 'musicPath'] as const)
        el<HTMLInputElement>(key).value = String(preferences[key]);
      appearance();
      libraryList();
    },
    libraryRoots: () => preferences.libraryRoots.filter((r) => r.enabled).map((r) => r.path),
    flush,
  };
}
