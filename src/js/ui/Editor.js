/**
 * Editor - Integração UI com Monaco Editor
 */
export class Editor {
  constructor(container, monacoManager, eventBus) {
    this.container = container;
    this.mm = monacoManager;
    this.events = eventBus;
    this._statusCursor = document.getElementById('status-cursor');
    this._statusLanguage = document.getElementById('status-language');
    this._initListeners();
  }

  _initListeners() {
    this.events.on('editor:cursorChanged', ({ position }) => {
      if (this._statusCursor) {
        this._statusCursor.textContent = `Ln ${position.lineNumber}, Col ${position.column}`;
      }
    });

    this.events.on('file:activated', ({ path }) => {
      if (this._statusLanguage) {
        const ext = path.split('.').pop();
        const langMap = { js: 'JavaScript', ts: 'TypeScript', json: 'JSON', md: 'Markdown' };
        this._statusLanguage.textContent = langMap[ext] || ext.toUpperCase() || 'Plain Text';
      }
    });
  }

  async initialize(options = {}) {
    await this.mm.init(this.container, options);
  }

  focus() {
    this.mm.editor?.focus();
  }
}
