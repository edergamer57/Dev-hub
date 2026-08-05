/**
 * Downloader - Download e cache de recursos para funcionamento offline
 */
export class Downloader {
  constructor(fileSystem, eventBus) {
    this.fs = fileSystem;
    this.events = eventBus;
    this._resources = new Map();
    this._cacheDir = '/.cache/resources';
  }

  async init() {
    try {
      await this.fs.createDirectory(this._cacheDir);
    } catch { /* já existe */ }
  }

  async download(url, filename) {
    const cachePath = `${this._cacheDir}/${filename}`;

    // Verificar cache local
    try {
      const cached = await this.fs.readFile(cachePath);
      if (cached) {
        this._resources.set(filename, cached);
        return cached;
      }
    } catch { /* não existe */ }

    // Baixar
    try {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const content = await response.text();

      // Salvar cache
      await this.fs.writeFile(cachePath, content);
      this._resources.set(filename, content);

      return content;
    } catch (err) {
      console.error(`Falha ao baixar ${url}:`, err);
      throw err;
    }
  }

  async ensureResources(resources) {
    const total = resources.length;
    let current = 0;

    for (const res of resources) {
      this.events.emit('download:progress', { 
        current, 
        total, 
        filename: res.filename,
        message: `Baixando ${res.filename}...`
      });

      try {
        await this.download(res.url, res.filename);
      } catch (err) {
        this.events.emit('download:error', { filename: res.filename, error: err.message });
      }

      current++;
      this.events.emit('download:progress', { current, total, filename: res.filename });
    }

    this.events.emit('download:complete', { total });
  }

  getResource(filename) {
    return this._resources.get(filename);
  }
}
