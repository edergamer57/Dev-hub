/**
 * ProjectManager - Gerenciamento de projetos e arquivos
 */
import { EventBus } from '../services/Events.js';
import { normalizePath, getFilename, getDirname, pathJoin } from '../services/Utils.js';

export class ProjectManager {
  constructor(fileSystem, workspaceStore, eventBus) {
    this.fs = fileSystem;
    this.ws = workspaceStore;
    this.events = eventBus;
    this.currentProjectPath = null;
    this.projectName = '';
    this.files = new Map(); // path -> { name, isDirectory, path }
    this.openFiles = new Set();
    this.activeFile = null;
    this._contentCache = new Map(); // path -> content
  }

  async openProject(projectPath) {
    projectPath = normalizePath(projectPath);
    if (this.currentProjectPath === projectPath) return;

    // Fechar projeto atual
    if (this.currentProjectPath) {
      await this.closeProject();
    }

    this.currentProjectPath = projectPath;
    this.projectName = getFilename(projectPath) || 'Projeto';
    this.files.clear();
    this._contentCache.clear();

    // Carregar estrutura
    await this._scanDirectory(projectPath);

    // Restaurar workspace
    const state = this.ws.getWorkspaceState(projectPath);
    this.openFiles = new Set(state.openFiles || []);
    this.activeFile = state.activeFile || null;

    this.ws.addRecentProject(projectPath);
    this.events.emit('project:opened', { path: projectPath, name: this.projectName });

    // Abrir arquivos restaurados
    for (const file of this.openFiles) {
      this.events.emit('file:opened', { path: file, fromRestore: true });
    }
    if (this.activeFile) {
      this.events.emit('file:activated', { path: this.activeFile });
    }
  }

  async closeProject() {
    if (!this.currentProjectPath) return;
    this._saveWorkspaceState();
    this.events.emit('project:closed', { path: this.currentProjectPath });
    this.currentProjectPath = null;
    this.projectName = '';
    this.files.clear();
    this.openFiles.clear();
    this.activeFile = null;
    this._contentCache.clear();
  }

  async _scanDirectory(dirPath, depth = 0) {
    if (depth > 20) return; // proteção contra loop infinito
    try {
      const entries = await this.fs.readDir(dirPath);
      for (const entry of entries) {
        const normalized = normalizePath(entry.path);
        this.files.set(normalized, entry);
        if (entry.isDirectory) {
          await this._scanDirectory(normalized, depth + 1);
        }
      }
    } catch (err) {
      console.warn(`Erro ao ler diretório ${dirPath}:`, err);
    }
  }

  async refresh() {
    if (!this.currentProjectPath) return;
    this.files.clear();
    await this._scanDirectory(this.currentProjectPath);
    this.events.emit('project:refreshed', { path: this.currentProjectPath });
  }

  async getFileContent(path) {
    if (this._contentCache.has(path)) {
      return this._contentCache.get(path);
    }
    const content = await this.fs.readFile(path);
    this._contentCache.set(path, content);
    return content;
  }

  async saveFile(path, content) {
    await this.fs.writeFile(path, content);
    this._contentCache.set(path, content);
    this.events.emit('file:saved', { path, content });
  }

  async createFile(path, content = '') {
    await this.fs.writeFile(path, content);
    const entry = { name: getFilename(path), isDirectory: false, isFile: true, path };
    this.files.set(path, entry);
    this.events.emit('file:created', { path, entry });
  }

  async createDirectory(path) {
    await this.fs.createDirectory(path);
    const entry = { name: getFilename(path), isDirectory: true, isFile: false, path };
    this.files.set(path, entry);
    this.events.emit('directory:created', { path, entry });
  }

  async deleteFile(path) {
    const entry = this.files.get(path);
    if (!entry) return;

    if (entry.isDirectory) {
      // Deletar recursivamente
      const children = Array.from(this.files.keys()).filter(p => p.startsWith(path + '/') && p !== path);
      for (const child of children) {
        await this.fs.deleteFile(child);
        this.files.delete(child);
      }
      await this.fs.deleteFile(path);
    } else {
      await this.fs.deleteFile(path);
    }

    this.files.delete(path);
    this._contentCache.delete(path);
    this.openFiles.delete(path);
    if (this.activeFile === path) {
      this.activeFile = this.openFiles.size > 0 ? Array.from(this.openFiles)[0] : null;
    }
    this.events.emit('file:deleted', { path });
  }

  async renameFile(oldPath, newPath) {
    await this.fs.rename(oldPath, newPath);
    const entry = this.files.get(oldPath);
    if (entry) {
      entry.path = newPath;
      entry.name = getFilename(newPath);
      this.files.delete(oldPath);
      this.files.set(newPath, entry);
    }
    const content = this._contentCache.get(oldPath);
    if (content !== undefined) {
      this._contentCache.delete(oldPath);
      this._contentCache.set(newPath, content);
    }
    if (this.openFiles.has(oldPath)) {
      this.openFiles.delete(oldPath);
      this.openFiles.add(newPath);
    }
    if (this.activeFile === oldPath) {
      this.activeFile = newPath;
    }
    this.events.emit('file:renamed', { oldPath, newPath });
  }

  setActiveFile(path) {
    if (path && !this.openFiles.has(path)) {
      this.openFiles.add(path);
      this.events.emit('file:opened', { path });
    }
    this.activeFile = path;
    this.events.emit('file:activated', { path });
  }

  closeFile(path) {
    this.openFiles.delete(path);
    this._contentCache.delete(path);
    if (this.activeFile === path) {
      this.activeFile = this.openFiles.size > 0 ? Array.from(this.openFiles)[0] : null;
      this.events.emit('file:activated', { path: this.activeFile });
    }
    this.events.emit('file:closed', { path });
  }

  _saveWorkspaceState() {
    if (!this.currentProjectPath) return;
    this.ws.updateWorkspaceState(this.currentProjectPath, {
      openFiles: Array.from(this.openFiles),
      activeFile: this.activeFile
    });
  }

  getTree() {
    if (!this.currentProjectPath) return [];
    const tree = [];
    const dirs = new Map();

    for (const [path, entry] of this.files) {
      const relative = path.replace(this.currentProjectPath, '') || '/';
      const parts = relative.split('/').filter(Boolean);

      if (parts.length === 0) continue;

      let current = tree;
      let currentPath = this.currentProjectPath;

      for (let i = 0; i < parts.length; i++) {
        currentPath = pathJoin(currentPath, parts[i]);
        const existing = current.find(n => n.name === parts[i]);

        if (existing) {
          current = existing.children;
        } else {
          const node = {
            name: parts[i],
            path: currentPath,
            isDirectory: i < parts.length - 1 || entry.isDirectory,
            isFile: i === parts.length - 1 && entry.isFile,
            children: []
          };
          current.push(node);
          if (node.isDirectory) {
            current = node.children;
          }
        }
      }
    }

    // Ordenar: diretórios primeiro, depois arquivos
    const sortNodes = (nodes) => {
      nodes.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });
      nodes.forEach(n => { if (n.children) sortNodes(n.children); });
    };
    sortNodes(tree);
    return tree;
  }
}
