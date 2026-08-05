/**
 * Tabs - Gerenciamento de abas de arquivos abertos
 */
import { getFilename } from '../services/Utils.js';

export class Tabs {
  constructor(container, projectManager, eventBus) {
    this.container = container;
    this.pm = projectManager;
    this.events = eventBus;
    this._tabs = new Map(); // path -> element
    this._dirty = new Set();
    this._initListeners();
  }

  _initListeners() {
    this.events.on('file:opened', ({ path, fromRestore }) => {
      this.addTab(path);
    });

    this.events.on('file:activated', ({ path }) => {
      this.setActiveTab(path);
    });

    this.events.on('file:closed', ({ path }) => {
      this.removeTab(path);
    });

    this.events.on('file:renamed', ({ oldPath, newPath }) => {
      this.renameTab(oldPath, newPath);
    });

    this.events.on('file:deleted', ({ path }) => {
      this.removeTab(path);
    });

    this.events.on('editor:contentChanged', ({ path }) => {
      this.markDirty(path);
    });

    this.events.on('file:saved', ({ path }) => {
      this.clearDirty(path);
    });
  }

  addTab(path) {
    if (this._tabs.has(path)) {
      this.setActiveTab(path);
      return;
    }

    const tab = document.createElement('div');
    tab.className = 'tab';
    tab.dataset.path = path;
    tab.innerHTML = `
      <span class="tab-name">${this._escapeHtml(getFilename(path))}</span>
      <span class="tab-dirty hidden"></span>
      <span class="tab-close">&times;</span>
    `;

    tab.addEventListener('click', (e) => {
      if (e.target.classList.contains('tab-close')) {
        e.stopPropagation();
        this.pm.closeFile(path);
      } else {
        this.pm.setActiveFile(path);
      }
    });

    // Swipe to close (touch)
    let startX = 0;
    tab.addEventListener('touchstart', (e) => {
      startX = e.touches[0].clientX;
    }, { passive: true });

    tab.addEventListener('touchend', (e) => {
      const endX = e.changedTouches[0].clientX;
      if (startX - endX > 80) { // swipe left
        this.pm.closeFile(path);
      }
    }, { passive: true });

    this.container.appendChild(tab);
    this._tabs.set(path, tab);
    this.setActiveTab(path);
    this._scrollToTab(tab);
  }

  removeTab(path) {
    const tab = this._tabs.get(path);
    if (tab) {
      tab.remove();
      this._tabs.delete(path);
      this._dirty.delete(path);
    }
  }

  renameTab(oldPath, newPath) {
    const tab = this._tabs.get(oldPath);
    if (tab) {
      tab.dataset.path = newPath;
      tab.querySelector('.tab-name').textContent = getFilename(newPath);
      this._tabs.delete(oldPath);
      this._tabs.set(newPath, tab);

      if (this._dirty.has(oldPath)) {
        this._dirty.delete(oldPath);
        this._dirty.add(newPath);
      }
    }
  }

  setActiveTab(path) {
    for (const [p, tab] of this._tabs) {
      tab.classList.toggle('active', p === path);
    }
    const active = this._tabs.get(path);
    if (active) {
      this._scrollToTab(active);
    }
  }

  markDirty(path) {
    this._dirty.add(path);
    const tab = this._tabs.get(path);
    if (tab) {
      tab.querySelector('.tab-dirty').classList.remove('hidden');
    }
  }

  clearDirty(path) {
    this._dirty.delete(path);
    const tab = this._tabs.get(path);
    if (tab) {
      tab.querySelector('.tab-dirty').classList.add('hidden');
    }
  }

  _scrollToTab(tab) {
    tab.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  _escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}
