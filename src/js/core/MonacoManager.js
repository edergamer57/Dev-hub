/**
 * MonacoManager - Gerenciamento do Monaco Editor, modelos e sincronização
 */
import { getLanguageId } from '../services/Utils.js';

export class MonacoManager {
  constructor(tsService, eventBus) {
    this.tsService = tsService;
    this.events = eventBus;
    this.editor = null;
    this.models = new Map(); // path -> ITextModel
    this.uris = new Map();   // path -> monaco.Uri
    this.currentFile = null;
    this._ignoreChange = false;
    this._disposables = [];
  }

  async init(container, options = {}) {
    if (!window.monaco) {
      throw new Error('Monaco Editor não carregado');
    }

    // Configurar TypeScript Service
    this.tsService.init();

    // Criar editor
    this.editor = monaco.editor.create(container, {
      automaticLayout: true,
      theme: options.theme || 'vs-dark',
      fontSize: options.fontSize || 13,
      wordWrap: options.wordWrap ? 'on' : 'off',
      minimap: { enabled: options.minimap || false },
      lineNumbers: options.lineNumbers !== false ? 'on' : 'off',
      renderWhitespace: options.renderWhitespace ? 'all' : 'none',
      autoClosingBrackets: options.autoClosingBrackets !== false ? 'always' : 'never',
      tabSize: options.tabSize || 2,
      insertSpaces: options.insertSpaces !== false,
      scrollBeyondLastLine: false,
      smoothScrolling: true,
      fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
      fontLigatures: true,
      quickSuggestions: true,
      suggestOnTriggerCharacters: true,
      acceptSuggestionOnEnter: 'on',
      snippetSuggestions: 'inline',
      formatOnType: true,
      formatOnPaste: true,
      folding: true,
      foldingStrategy: 'auto',
      showFoldingControls: 'always',
      dragAndDrop: true,
      links: true,
      contextmenu: false, // Desabilitar menu nativo para usar custom
      ...options
    });

    // Eventos do editor
    this._disposables.push(
      this.editor.onDidChangeModelContent((e) => {
        if (this._ignoreChange) return;
        const path = this.currentFile;
        if (path) {
          this.events.emit('editor:contentChanged', { path, changes: e.changes });
        }
      })
    );

    this._disposables.push(
      this.editor.onDidChangeCursorPosition((e) => {
        this.events.emit('editor:cursorChanged', {
          path: this.currentFile,
          position: e.position
        });
      })
    );

    this._disposables.push(
      this.editor.onDidBlurEditorWidget(() => {
        this.events.emit('editor:blur', { path: this.currentFile });
      })
    );

    // Configurar resolução de módulos
    this._setupModuleResolution();

    this.events.emit('monaco:ready', {});
  }

  _setupModuleResolution() {
    // O Monaco resolve imports automaticamente se os models existirem
    // com URIs correspondentes. Não precisamos de hook customizado
    // se criarmos os models corretamente com monaco.Uri.file()
  }

  openFile(path, content = '') {
    if (!this.editor) return null;

    let model = this.models.get(path);
    if (!model) {
      const uri = monaco.Uri.file(path);
      this.uris.set(path, uri);

      const language = getLanguageId(path);
      model = monaco.editor.createModel(content, language, uri);

      this.models.set(path, model);

      // Escutar mudanças no model para sincronização
      model.onDidChangeContent(() => {
        this.events.emit('model:changed', { path });
      });
    }

    this.editor.setModel(model);
    this.currentFile = path;

    // Focar editor
    this.editor.focus();

    this.events.emit('file:opened', { path, model });
    return model;
  }

  closeFile(path) {
    const model = this.models.get(path);
    if (model) {
      // Se for o arquivo atual, limpar
      if (this.currentFile === path) {
        this.editor.setModel(null);
        this.currentFile = null;
      }

      // Só dispose se não estiver dirty (salvo)
      // Na prática, mantemos o model em cache para reabrir rápido
      // model.dispose();
      // this.models.delete(path);
    }
  }

  getModel(path) {
    return this.models.get(path);
  }

  getOrCreateModel(path, content = '') {
    let model = this.models.get(path);
    if (!model) {
      model = this.openFile(path, content);
    }
    return model;
  }

  updateModelContent(path, content) {
    const model = this.models.get(path);
    if (model && model.getValue() !== content) {
      this._ignoreChange = true;
      model.setValue(content);
      this._ignoreChange = false;
    }
  }

  setActiveFile(path) {
    const model = this.models.get(path);
    if (model && this.editor) {
      this.editor.setModel(model);
      this.currentFile = path;
      this.editor.focus();
    }
  }

  getContent(path) {
    const model = this.models.get(path);
    return model ? model.getValue() : '';
  }

  getCurrentContent() {
    return this.editor ? this.editor.getValue() : '';
  }

  async formatDocument() {
    if (!this.editor) return;
    await this.editor.getAction('editor.action.formatDocument').run();
  }

  async formatSelection() {
    if (!this.editor) return;
    await this.editor.getAction('editor.action.formatSelection').run();
  }

  setTheme(theme) {
    if (!window.monaco) return;
    monaco.editor.setTheme(theme);
  }

  updateOptions(options) {
    if (!this.editor) return;
    this.editor.updateOptions(options);
  }

  setCursorPosition(path, position) {
    if (!this.editor) return;
    const model = this.models.get(path);
    if (model && this.currentFile === path) {
      this.editor.setPosition(position);
      this.editor.revealPositionInCenterIfOutsideViewport(position);
    }
  }

  revealLine(path, lineNumber) {
    if (!this.editor) return;
    if (this.currentFile === path) {
      this.editor.revealLineInCenterIfOutsideViewport(lineNumber);
    }
  }

  dispose() {
    this._disposables.forEach(d => d.dispose());
    this._disposables = [];

    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
    this.uris.clear();

    if (this.editor) {
      this.editor.dispose();
      this.editor = null;
    }
  }
}
