/**
 * APIManager - Gerenciamento das definições de tipo do Minecraft
 */
export class APIManager {
  constructor(eventBus) {
    this.events = eventBus;
    this.modules = [
      { name: '@minecraft/server', currentVersion: '1.17.0-beta.1.21.51-stable' },
      { name: '@minecraft/server-ui', currentVersion: '1.3.0' },
      { name: '@minecraft/server-net', currentVersion: '1.0.0-beta.1.21.51-stable' },
      { name: '@minecraft/server-admin', currentVersion: '1.0.0-beta.1.21.51-stable' },
      { name: '@minecraft/math', currentVersion: '2.0.1' },
      { name: '@minecraft/vanilla-data', currentVersion: '1.21.50' },
      { name: '@minecraft/debug-utilities', currentVersion: '1.0.0-beta.1.21.70-stable' }
    ];
    this._versionsCache = new Map();
    this._offlineCache = new Map();
  }

  getTypesUrl(moduleName, version) {
    const specialUrls = {
      '@minecraft/math': (v) => `https://cdn.jsdelivr.net/npm/@minecraft/math@${v}/dist/minecraft-math.d.ts`,
      '@minecraft/vanilla-data': (v) => `https://cdn.jsdelivr.net/npm/@minecraft/vanilla-data@${v}/lib/index.d.ts`
    };
    if (specialUrls[moduleName]) {
      return specialUrls[moduleName](version);
    }
    return `https://cdn.jsdelivr.net/npm/${moduleName}@${version}/index.d.ts`;
  }

  async fetchVersions(packageName) {
    if (this._versionsCache.has(packageName)) {
      return this._versionsCache.get(packageName);
    }
    try {
      const response = await fetch(`https://data.jsdelivr.com/v1/package/npm/${packageName}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const versions = (data.versions || []).reverse();
      this._versionsCache.set(packageName, versions);
      return versions;
    } catch (err) {
      console.error(`Falha ao buscar versões de ${packageName}:`, err);
      return [];
    }
  }

  async loadDefinitions(moduleName, version, tsService) {
    const cacheKey = `${moduleName}@${version}`;

    // Verificar cache offline
    if (this._offlineCache.has(cacheKey)) {
      tsService.addTypeDefinitions(moduleName, this._offlineCache.get(cacheKey));
      return true;
    }

    try {
      const url = this.getTypesUrl(moduleName, version);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const types = await response.text();

      // Cache offline
      this._offlineCache.set(cacheKey, types);

      tsService.addTypeDefinitions(moduleName, types);
      this.events.emit('api:loaded', { moduleName, version });
      return true;
    } catch (err) {
      console.error(`Falha ao carregar ${moduleName}@${version}:`, err);
      this.events.emit('api:error', { moduleName, version, error: err.message });
      return false;
    }
  }

  async loadAllDefinitions(tsService) {
    const results = [];
    for (const mod of this.modules) {
      const success = await this.loadDefinitions(mod.name, mod.currentVersion, tsService);
      results.push({ name: mod.name, success });
    }
    return results;
  }

  getAvailablePackages() {
    return this.modules.map(m => ({ ...m }));
  }

  setModuleVersion(moduleName, version) {
    const mod = this.modules.find(m => m.name === moduleName);
    if (mod) mod.currentVersion = version;
  }
}
