/**
 * FileSystem - Abstração do sistema de arquivos via Capacitor
 * Preparado para futuro suporte a SAF (Storage Access Framework)
 */
export class FileSystem {
  constructor() {
    this._fs = null;
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    try {
      const { Filesystem } = await import('@capacitor/filesystem');
      this._fs = Filesystem;
      this._initialized = true;
    } catch (err) {
      console.warn('Capacitor Filesystem não disponível, usando fallback', err);
      this._fs = null;
      this._initialized = true;
    }
  }

  _getEncoding(data) {
    return typeof data === 'string' ? 'utf8' : 'base64';
  }

  async readFile(path, options = {}) {
    const { encoding = 'utf8' } = options;
    if (this._fs) {
      const result = await this._fs.readFile({ path, encoding });
      return result.data;
    }
    // Fallback: localStorage simulado para demo/web
    const key = `fs_${path}`;
    const data = localStorage.getItem(key);
    if (data === null) throw new Error(`Arquivo não encontrado: ${path}`);
    return data;
  }

  async writeFile(path, content, options = {}) {
    const { encoding = 'utf8', recursive = true } = options;
    if (this._fs) {
      if (recursive) {
        const dir = path.substring(0, path.lastIndexOf('/')) || '/';
        if (dir && dir !== '/') {
          try {
            await this._fs.mkdir({ path: dir, recursive: true });
          } catch { /* já existe */ }
        }
      }
      await this._fs.writeFile({ path, data: content, encoding });
      return;
    }
    // Fallback
    const key = `fs_${path}`;
    localStorage.setItem(key, content);
  }

  async deleteFile(path) {
    if (this._fs) {
      await this._fs.deleteFile({ path });
      return;
    }
    localStorage.removeItem(`fs_${path}`);
  }

  async readDir(path) {
    if (this._fs) {
      const result = await this._fs.readdir({ path });
      return result.files.map(f => ({
        name: f.name || f,
        isDirectory: f.type === 'directory' || false,
        isFile: f.type === 'file' || true,
        path: `${path}/${f.name || f}`.replace(/\/+/g, '/')
      }));
    }
    // Fallback: scan localStorage keys
    const prefix = `fs_${path}`;
    const entries = [];
    const seen = new Set();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const rest = key.slice(prefix.length + 1);
        const name = rest.split('/')[0];
        if (!seen.has(name)) {
          seen.add(name);
          const isDir = rest.includes('/');
          entries.push({
            name,
            isDirectory: isDir,
            isFile: !isDir,
            path: `${path}/${name}`
          });
        }
      }
    }
    return entries;
  }

  async createDirectory(path, options = {}) {
    const { recursive = true } = options;
    if (this._fs) {
      await this._fs.mkdir({ path, recursive });
      return;
    }
    // Fallback: cria um arquivo sentinela
    await this.writeFile(`${path}/.gitkeep`, '');
  }

  async rename(oldPath, newPath) {
    if (this._fs) {
      await this._fs.rename({ from: oldPath, to: newPath });
      return;
    }
    const content = await this.readFile(oldPath);
    await this.writeFile(newPath, content);
    await this.deleteFile(oldPath);
  }

  async copy(src, dest) {
    if (this._fs) {
      await this._fs.copy({ from: src, to: dest });
      return;
    }
    const content = await this.readFile(src);
    await this.writeFile(dest, content);
  }

  async move(src, dest) {
    await this.copy(src, dest);
    await this.deleteFile(src);
  }

  async stat(path) {
    if (this._fs) {
      try {
        const result = await this._fs.stat({ path });
        return {
          exists: true,
          isDirectory: result.type === 'directory',
          isFile: result.type === 'file',
          size: result.size || 0,
          mtime: result.mtime || Date.now()
        };
      } catch {
        return { exists: false };
      }
    }
    const content = localStorage.getItem(`fs_${path}`);
    return { exists: content !== null, isFile: true, isDirectory: false, size: content?.length || 0 };
  }

  async exists(path) {
    const s = await this.stat(path);
    return s.exists;
  }

  // Futuro: SAF
  async requestPersistentPermission() {
    // Placeholder para SAF
    return false;
  }
}
