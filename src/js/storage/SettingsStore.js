/**
 * SettingsStore - Persistência de configurações do usuário
 */
export class SettingsStore {
  constructor() {
    this._cache = new Map();
    this._defaults = {
      theme: 'vs-dark',
      fontSize: 13,
      wordWrap: true,
      minimap: false,
      lineNumbers: true,
      renderWhitespace: false,
      autoClosingBrackets: true,
      autoSaveEnabled: true,
      autoSaveInterval: 30,
      language: 'javascript',
      tabSize: 2,
      insertSpaces: true,
      formatOnSave: false,
      explorerSort: 'name',
      showHiddenFiles: false
    };
  }

  async init() {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      this._preferences = Preferences;
      const { value } = await Preferences.get({ key: 'settings' });
      if (value) {
        const parsed = JSON.parse(value);
        for (const [k, v] of Object.entries(parsed)) {
          this._cache.set(k, v);
        }
      }
    } catch {
      // Fallback para localStorage
      const raw = localStorage.getItem('mc_editor_settings');
      if (raw) {
        const parsed = JSON.parse(raw);
        for (const [k, v] of Object.entries(parsed)) {
          this._cache.set(k, v);
        }
      }
    }
  }

  get(key) {
    return this._cache.has(key) ? this._cache.get(key) : this._defaults[key];
  }

  set(key, value) {
    this._cache.set(key, value);
    this._persist();
  }

  getAll() {
    return { ...this._defaults, ...Object.fromEntries(this._cache) };
  }

  async _persist() {
    const data = JSON.stringify(Object.fromEntries(this._cache));
    if (this._preferences) {
      await this._preferences.set({ key: 'settings', value: data });
    } else {
      localStorage.setItem('mc_editor_settings', data);
    }
  }
}
