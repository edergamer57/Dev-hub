/**
 * Explorer - Árvore de arquivos estilo VS Code
 */
import { getFilename, normalizePath } from '../services/Utils.js';

export class Explorer {
  constructor(container, projectManager, eventBus) {
    this.container = container;
    this.pm = projectManager;
    this.events = eventBus;
    this._expanded = new Set();
    this._selected = null;
    this._contextTarget = null;
    this._initListeners();
    this._initActions();
  }

  _initListeners() {
    this.events.on('project:opened', () => this.render());
    this.events.on('project:refreshed', () => this.render());
    this.events.on('file:created', () => this.render());
    this.events.on('directory:created', () => this.render());
    this.events.on('file:deleted', () => this.render());
    this.events.on('file:renamed', () => this.render());
    this.events.on('file:activated', ({ path }) => {
      this._selected = path;
      this._highlightSelected();
    });
  }

  _initActions() {
    document.getElementById('btn-new-file')?.addEventListener('click', () => {
      this._showCreateDialog('file');
    });
    document.getElementById('btn-new-folder')?.addEventListener('click', () => {
      this._showCreateDialog('folder');
    });
    document.getElementById('btn-refresh')?.addEventListener('click', () => {
      this.pm.refresh();
    });
  }

  render() {
    this.container.innerHTML = '';
    const tree = this.pm.getTree();

    if (tree.length === 0) {
      this.container.innerHTML = '<div style="padding: 20px; text-align: center; color: var(--text-secondary); font-size: 13px;">Nenhum arquivo</div>';
      return;
    }

    for (const node of tree) {
      this._renderNode(node, 0);
    }
  }

  _renderNode(node, depth) {
    const el = document.createElement('div');
    const isExpanded = this._expanded.has(node.path);

    el.className = 'tree-item';
    el.style.setProperty('--indent', `${12 + depth * 16}px`);
    el.dataset.path = node.path;

    if (this._selected === node.path) {
      el.classList.add('selected');
    }

    const icon = node.isDirectory ? (isExpanded ? '📂' : '📁') : this._getFileIcon(node.name);
    const chevron = node.isDirectory ? `<span class="tree-chevron ${isExpanded ? 'expanded' : ''}">▶</span>` : '<span class="tree-chevron"></span>';

    el.innerHTML = `${chevron}<span class="tree-icon">${icon}</span><span class="tree-name">${this._escapeHtml(node.name)}</span>`;

    // Eventos
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      if (node.isDirectory) {
        this._toggleFolder(node.path);
      } else {
        this._selected = node.path;
        this.pm.setActiveFile(node.path);
      }
    });

    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      this._contextTarget = node.path;
      this._showContextMenu(e.clientX, e.clientY);
    });

    // Long press para mobile
    let longPressTimer;
    el.addEventListener('touchstart', (e) => {
      longPressTimer = setTimeout(() => {
        this._contextTarget = node.path;
        this._showContextMenu(e.touches[0].clientX, e.touches[0].clientY);
      }, 600);
    }, { passive: true });

    el.addEventListener('touchend', () => {
      clearTimeout(longPressTimer);
    }, { passive: true });

    el.addEventListener('touchmove', () => {
      clearTimeout(longPressTimer);
    }, { passive: true });

    this.container.appendChild(el);

    // Renderizar filhos se expandido
    if (node.isDirectory && isExpanded && node.children) {
      for (const child of node.children) {
        this._renderNode(child, depth + 1);
      }
    }
  }

  _toggleFolder(path) {
    if (this._expanded.has(path)) {
      this._expanded.delete(path);
    } else {
      this._expanded.add(path);
    }
    this.render();
  }

  _getFileIcon(filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    const icons = {
      js: '📜', mjs: '📜', cjs: '📜',
      ts: '🔷', tsx: '⚛️',
      json: '📋',
      md: '📝',
      html: '🌐',
      css: '🎨'
    };
    return icons[ext] || '📄';
  }

  _highlightSelected() {
    this.container.querySelectorAll('.tree-item').forEach(el => {
      el.classList.toggle('selected', el.dataset.path === this._selected);
    });
  }

  _showContextMenu(x, y) {
    const menu = document.getElementById('context-menu');
    menu.style.left = `${Math.min(x, window.innerWidth - 200)}px`;
    menu.style.top = `${Math.min(y, window.innerHeight - 250)}px`;
    menu.classList.remove('hidden');

    const closeMenu = () => {
      menu.classList.add('hidden');
      document.removeEventListener('click', closeMenu);
      document.removeEventListener('touchstart', closeMenu);
    };

    setTimeout(() => {
      document.addEventListener('click', closeMenu);
      document.addEventListener('touchstart', closeMenu);
    }, 100);
  }

  _showCreateDialog(type) {
    const isFile = type === 'file';
    const targetPath = this._contextTarget || this.pm.currentProjectPath || '/';

    this._showModal(
      isFile ? 'Novo Arquivo' : 'Nova Pasta',
      `<label>Nome:<input type="text" class="modal-input" id="create-name" placeholder="${isFile ? 'arquivo.js' : 'pasta'}" /></label>`,
      [
        { text: 'Cancelar', class: 'secondary', action: () => {} },
        { text: 'Criar', class: 'primary', action: async () => {
          const name = document.getElementById('create-name').value.trim();
          if (!name) return;
          const basePath = (await this.pm.fs.stat(targetPath)).isDirectory ? targetPath : targetPath.substring(0, targetPath.lastIndexOf('/'));
          const newPath = `${basePath}/${name}`.replace(/\/+/g, '/');
          if (isFile) {
            await this.pm.createFile(newPath, '');
          } else {
            await this.pm.createDirectory(newPath);
          }
        }}
      ]
    );
  }

  _showModal(title, bodyHtml, buttons) {
    const overlay = document.getElementById('modal-overlay');
    const titleEl = document.getElementById('modal-title');
    const bodyEl = document.getElementById('modal-body');
    const footerEl = document.getElementById('modal-footer');

    titleEl.textContent = title;
    bodyEl.innerHTML = bodyHtml;
    footerEl.innerHTML = '';

    for (const btn of buttons) {
      const b = document.createElement('button');
      b.className = `modal-btn ${btn.class}`;
      b.textContent = btn.text;
      b.addEventListener('click', async () => {
        await btn.action();
        overlay.classList.add('hidden');
      });
      footerEl.appendChild(b);
    }

    overlay.classList.remove('hidden');

    // Focar input se existir
    setTimeout(() => {
      const input = bodyEl.querySelector('input');
      if (input) input.focus();
    }, 100);
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
