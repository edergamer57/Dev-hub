/**
 * WorkspaceStore - Persistência do estado do workspace
 */
export class WorkspaceStore {
  constructor() {
    this._cache = null;
  }

  async init() {
    try {
      const { Preferences } = await import('@capacitor/preferences');
      this._preferences = Preferences;
      const { value } = await Preferences.get({ key: 'workspace' });
      this._cache = value ? JSON.parse(value) : this._default();
    } catch {
      const raw = localStorage.getItem('mc_editor_workspace');
      this._cache = raw ? JSON.parse(raw) : this._default();
    }
  }

  _default() {
    return {
      recentProjects: [],
      workspaces: {}
    };
  }

  getLastProject() {
    const recent = this._cache.recentProjects;
    return recent.length > 0 ? recent[0] : null;
  }

  getWorkspaceState(projectPath) {
    return this._cache.workspaces[projectPath] || {
      openFiles: [],
      activeFile: null,
      cursorPosition: { lineNumber: 1, column: 1 },
      scrollPosition: { top: 0, left: 0 },
      expandedFolders: []
    };
  }

  updateWorkspaceState(projectPath, state) {
    if (!this._cache.workspaces[projectPath]) {
      this._cache.workspaces[projectPath] = {};
    }
    Object.assign(this._cache.workspaces[projectPath], state);
    this._persist();
  }

  addRecentProject(projectPath) {
    const recent = this._cache.recentProjects.filter(p => p !== projectPath);
    recent.unshift(projectPath);
    this._cache.recentProjects = recent.slice(0, 10);
    this._persist();
  }

  removeRecentProject(projectPath) {
    this._cache.recentProjects = this._cache.recentProjects.filter(p => p !== projectPath);
    delete this._cache.workspaces[projectPath];
    this._persist();
  }

  async _persist() {
    const data = JSON.stringify(this._cache);
    if (this._preferences) {
      await this._preferences.set({ key: 'workspace', value: data });
    } else {
      localStorage.setItem('mc_editor_workspace', data);
    }
  }
}
