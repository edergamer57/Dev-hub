/**
 * MC Script Editor - Ponto de entrada principal
 * Orquestra todos os módulos e inicializa a aplicação
 */
import { EventBus } from './services/Events.js';
import { SettingsStore } from './storage/SettingsStore.js';
import { WorkspaceStore } from './storage/WorkspaceStore.js';
import { FileSystem } from './core/FileSystem.js';
import { Downloader } from './core/Downloader.js';
import { APIManager } from './core/APIManager.js';
import { TypeScriptService } from './core/TypeScriptService.js';
import { MonacoManager } from './core/MonacoManager.js';
import { ProjectManager } from './core/ProjectManager.js';
import { Theme } from './ui/Theme.js';
import { Explorer } from './ui/Explorer.js';
import { Tabs } from './ui/Tabs.js';
import { Editor } from './ui/Editor.js';

// ===== Toast Helper =====
function showToast(message, type = 'info', duration = 3000) {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration + 300);
}

// ===== Loading Screen =====
function updateLoading(progress, message) {
  const bar = document.getElementById('loading-bar');
  const status = document.getElementById('loading-status');
  if (bar) bar.style.width = `${(progress.current / progress.total) * 100}%`;
  if (status) status.textContent = message || `Carregando... ${progress.current}/${progress.total}`;
}

function hideLoadingScreen() {
  const screen = document.getElementById('loading-screen');
  const app = document.getElementById('app');
  if (screen) {
    screen.style.opacity = '0';
    setTimeout(() => {
      screen.classList.add('hidden');
      if (app) app.classList.remove('hidden');
    }, 500);
  }
}

// ===== Monaco Loader =====
function loadMonaco() {
  return new Promise((resolve, reject) => {
    if (window.monaco) {
      resolve();
      return;
    }

    const loader = document.createElement('script');
    loader.src = 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.50.0/min/vs/loader.min.js';
    loader.onload = () => {
      require.config({
        paths: {
          vs: 'https://cdnjs.cloudflare.com/ajax/libs/monaco-editor/0.50.0/min/vs'
        }
      });
      require(['vs/editor/editor.main'], () => {
        resolve();
      }, reject);
    };
    loader.onerror = reject;
    document.head.appendChild(loader);
  });
}

// ===== Main Application =====
class App {
  constructor() {
    this.events = new EventBus();
    this.settings = new SettingsStore();
    this.workspace = new WorkspaceStore();
    this.fs = new FileSystem();
    this.downloader = new Downloader(this.fs, this.events);
    this.apiManager = new APIManager(this.events);
    this.tsService = new TypeScriptService(this.events);
    this.monacoManager = new MonacoManager(this.tsService, this.events);
    this.projectManager = new ProjectManager(this.fs, this.workspace, this.events);
    this.theme = new Theme();
  }

  async init() {
    try {
      updateLoading({ current: 1, total: 6 }, 'Inicializando sistema de arquivos...');
      await this.fs.init();

      updateLoading({ current: 2, total: 6 }, 'Carregando configurações...');
      await this.settings.init();
      await this.workspace.init();

      updateLoading({ current: 3, total: 6 }, 'Carregando Monaco Editor...');
      await loadMonaco();

      updateLoading({ current: 4, total: 6 }, 'Configurando tema...');
      this.theme.init();
      const savedTheme = this.settings.get('theme');
      this.theme.apply(savedTheme);

      updateLoading({ current: 5, total: 6 }, 'Inicializando interface...');
      await this._initUI();

      updateLoading({ current: 6, total: 6 }, 'Carregando APIs Minecraft...');
      await this._loadAPIs();

      hideLoadingScreen();

      // Restaurar projeto
      await this._restoreWorkspace();

    } catch (err) {
      console.error('Falha na inicialização:', err);
      showToast(`Erro: ${err.message}`, 'error', 5000);
    }
  }

  async _initUI() {
    const settings = this.settings.getAll();

    // Inicializar componentes UI
    this.explorer = new Explorer(
      document.getElementById('explorer-tree'),
      this.projectManager,
      this.events
    );

    this.tabs = new Tabs(
      document.getElementById('tabs-container'),
      this.projectManager,
      this.events
    );

    this.editor = new Editor(
      document.getElementById('monaco-container'),
      this.monacoManager,
      this.events
    );

    await this.editor.initialize({
      theme: settings.theme,
      fontSize: settings.fontSize,
      wordWrap: settings.wordWrap,
      minimap: settings.minimap,
      lineNumbers: settings.lineNumbers,
      renderWhitespace: settings.renderWhitespace,
      autoClosingBrackets: settings.autoClosingBrackets,
      tabSize: settings.tabSize,
      insertSpaces: settings.insertSpaces
    });

    // Configurar sidebar
    this._setupSidebar();

    // Configurar ações da top bar
    this._setupTopBar();

    // Configurar context menu
    this._setupContextMenu();

    // Configurar modal
    this._setupModal();

    // Configurar auto-save
    this._setupAutoSave();

    // Configurar atalhos
    this._setupShortcuts();
  }

  _setupSidebar() {
    const sidebar = document.getElementById('sidebar');
    const toggle = document.getElementById('menu-toggle');
    const overlay = document.createElement('div');
    overlay.id = 'sidebar-overlay';
    document.getElementById('main-area').appendChild(overlay);

    const openSidebar = () => {
      sidebar.classList.add('open');
      overlay.classList.add('visible');
      document.getElementById('editor-area').classList.add('sidebar-open');
    };

    const closeSidebar = () => {
      sidebar.classList.remove('open');
      overlay.classList.remove('visible');
      document.getElementById('editor-area').classList.remove('sidebar-open');
    };

    toggle.addEventListener('click', () => {
      sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
    });

    overlay.addEventListener('click', closeSidebar);

    // Em desktop, sidebar sempre visível
    if (window.innerWidth >= 768) {
      openSidebar();
    }
  }

  _setupTopBar() {
    // Save
    document.getElementById('action-save')?.addEventListener('click', async () => {
      const active = this.monacoManager.currentFile;
      if (active) {
        const content = this.monacoManager.getCurrentContent();
        await this.projectManager.saveFile(active, content);
        showToast('Arquivo salvo!', 'success');
      }
    });

    // Settings
    document.getElementById('action-settings')?.addEventListener('click', () => {
      this._showSettingsModal();
    });
  }

  _setupContextMenu() {
    const menu = document.getElementById('context-menu');
    menu.querySelectorAll('.context-item').forEach(item => {
      item.addEventListener('click', async (e) => {
        const action = e.target.dataset.action;
        const target = this.explorer._contextTarget;
        if (!target) return;

        switch (action) {
          case 'rename':
            await this._handleRename(target);
            break;
          case 'delete':
            await this._handleDelete(target);
            break;
          case 'new-file':
            this.explorer._showCreateDialog('file');
            break;
          case 'new-folder':
            this.explorer._showCreateDialog('folder');
            break;
        }
        menu.classList.add('hidden');
      });
    });
  }

  async _handleRename(path) {
    const name = prompt('Novo nome:', path.split('/').pop());
    if (!name) return;
    const dir = path.substring(0, path.lastIndexOf('/'));
    const newPath = `${dir}/${name}`;
    await this.projectManager.renameFile(path, newPath);
  }

  async _handleDelete(path) {
    if (confirm(`Excluir "${path.split('/').pop()}"?`)) {
      await this.projectManager.deleteFile(path);
      showToast('Excluído', 'info');
    }
  }

  _setupModal() {
    document.getElementById('modal-close')?.addEventListener('click', () => {
      document.getElementById('modal-overlay').classList.add('hidden');
    });
    document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
      if (e.target.id === 'modal-overlay') {
        document.getElementById('modal-overlay').classList.add('hidden');
      }
    });
  }

  _showSettingsModal() {
    const settings = this.settings.getAll();
    const themes = this.theme.getAvailableThemes();

    const body = `
      <div class="settings-group">
        <label>Tema
          <select id="setting-theme" class="modal-input">
            ${themes.map(t => `<option value="${t.id}" ${t.id === settings.theme ? 'selected' : ''}>${t.name}</option>`).join('')}
          </select>
        </label>
        <label>Tamanho da Fonte
          <input type="number" id="setting-fontSize" class="modal-input" value="${settings.fontSize}" min="8" max="32" />
        </label>
        <label>Tab Size
          <input type="number" id="setting-tabSize" class="modal-input" value="${settings.tabSize}" min="2" max="8" />
        </label>
        <label>Word Wrap <input type="checkbox" id="setting-wordWrap" ${settings.wordWrap ? 'checked' : ''} /></label>
        <label>Minimap <input type="checkbox" id="setting-minimap" ${settings.minimap ? 'checked' : ''} /></label>
        <label>Números de Linha <input type="checkbox" id="setting-lineNumbers" ${settings.lineNumbers ? 'checked' : ''} /></label>
        <label>Auto Closing Brackets <input type="checkbox" id="setting-autoClosingBrackets" ${settings.autoClosingBrackets ? 'checked' : ''} /></label>
        <label>Auto-Save <input type="checkbox" id="setting-autoSaveEnabled" ${settings.autoSaveEnabled ? 'checked' : ''} /></label>
      </div>
    `;

    this.explorer._showModal('Configurações', body, [
      { text: 'Cancelar', class: 'secondary', action: () => {} },
      { text: 'Aplicar', class: 'primary', action: () => {
        const newSettings = {
          theme: document.getElementById('setting-theme').value,
          fontSize: parseInt(document.getElementById('setting-fontSize').value),
          tabSize: parseInt(document.getElementById('setting-tabSize').value),
          wordWrap: document.getElementById('setting-wordWrap').checked,
          minimap: document.getElementById('setting-minimap').checked,
          lineNumbers: document.getElementById('setting-lineNumbers').checked,
          autoClosingBrackets: document.getElementById('setting-autoClosingBrackets').checked,
          autoSaveEnabled: document.getElementById('setting-autoSaveEnabled').checked
        };

        for (const [k, v] of Object.entries(newSettings)) {
          this.settings.set(k, v);
        }

        this.theme.apply(newSettings.theme);
        this.monacoManager.updateOptions({
          theme: newSettings.theme,
          fontSize: newSettings.fontSize,
          tabSize: newSettings.tabSize,
          wordWrap: newSettings.wordWrap ? 'on' : 'off',
          minimap: { enabled: newSettings.minimap },
          lineNumbers: newSettings.lineNumbers ? 'on' : 'off',
          autoClosingBrackets: newSettings.autoClosingBrackets ? 'always' : 'never'
        });

        this._setupAutoSave();
        showToast('Configurações aplicadas', 'success');
      }}
    ]);
  }

  _setupAutoSave() {
    if (this._autoSaveInterval) {
      clearInterval(this._autoSaveInterval);
    }

    const enabled = this.settings.get('autoSaveEnabled');
    if (!enabled) return;

    const interval = (this.settings.get('autoSaveInterval') || 30) * 1000;

    this._autoSaveInterval = setInterval(() => {
      const active = this.monacoManager.currentFile;
      if (active) {
        const content = this.monacoManager.getCurrentContent();
        this.projectManager.saveFile(active, content).catch(() => {});
      }
    }, interval);
  }

  _setupShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+S / Cmd+S
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        const active = this.monacoManager.currentFile;
        if (active) {
          const content = this.monacoManager.getCurrentContent();
          this.projectManager.saveFile(active, content);
          showToast('Salvo!', 'success');
        }
      }

      // Ctrl+Shift+P / Cmd+Shift+P (format)
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'p') {
        e.preventDefault();
        this.monacoManager.formatDocument();
      }
    });
  }

  async _loadAPIs() {
    const results = await this.apiManager.loadAllDefinitions(this.tsService);
    const successCount = results.filter(r => r.success).length;
    console.log(`APIs carregadas: ${successCount}/${results.length}`);
  }

  async _restoreWorkspace() {
    const lastProject = this.workspace.getLastProject();

    if (lastProject) {
      try {
        await this.projectManager.openProject(lastProject);
        document.getElementById('project-title').textContent = this.projectManager.projectName;

        // Abrir arquivos do workspace
        const state = this.workspace.getWorkspaceState(lastProject);
        for (const file of state.openFiles) {
          try {
            const content = await this.projectManager.getFileContent(file);
            this.monacoManager.openFile(file, content);
          } catch (err) {
            console.warn(`Não foi possível abrir ${file}:`, err);
          }
        }

        if (state.activeFile) {
          this.projectManager.setActiveFile(state.activeFile);
          const content = await this.projectManager.getFileContent(state.activeFile);
          this.monacoManager.setActiveFile(state.activeFile);
        }

        showToast(`Projeto "${this.projectManager.projectName}" carregado`, 'success');
      } catch (err) {
        console.error('Erro ao restaurar workspace:', err);
        showToast('Erro ao carregar projeto anterior', 'warning');
      }
    } else {
      // Criar projeto demo
      await this._createDemoProject();
    }
  }

  async _createDemoProject() {
    const demoPath = '/projects/demo';
    try {
      await this.fs.createDirectory(demoPath);

      const mainJs = `// Minecraft scripting with full autocomplete capabilities
import { world, ItemStack } from '@minecraft/server';
import { ActionFormData } from '@minecraft/server-ui';

world.beforeEvents.itemUse.subscribe((event) => {
    const { source, itemStack } = event;
    if (itemStack.typeId !== "minecraft:stick") return;
    new ActionFormData()
        .title("Special Offer!")
        .body("Do you want a free diamond?")
        .button("Yes!")
        .button("No")
        .show(source)
        .then(({ selection }) => {
            if (selection !== 0) return;
            source.getComponent("minecraft:inventory")?.container?.addItem(new ItemStack("minecraft:diamond", 1));
            source.sendMessage("You received a free diamond!");
        })
});`;

      await this.fs.writeFile(`${demoPath}/main.js`, mainJs);
      await this.projectManager.openProject(demoPath);
      document.getElementById('project-title').textContent = 'Demo';

      const content = await this.projectManager.getFileContent(`${demoPath}/main.js`);
      this.monacoManager.openFile(`${demoPath}/main.js`, content);
      this.projectManager.setActiveFile(`${demoPath}/main.js`);

      showToast('Projeto demo criado', 'info');
    } catch (err) {
      console.error('Erro ao criar projeto demo:', err);
    }
  }
}

// Inicializar app quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
