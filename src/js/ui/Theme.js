/**
 * Theme - Gerenciamento de temas visuais
 */
export class Theme {
  constructor() {
    this.currentTheme = 'vs-dark';
    this._themes = {
      'dracula': {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: '', foreground: '#f8f8f2', background: '#282a36' },
          { token: 'comment', foreground: '#6272a4' },
          { token: 'keyword', foreground: '#ff79c6' },
          { token: 'number', foreground: '#bd93f9' },
          { token: 'string', foreground: '#f1fa8c' },
          { token: 'identifier', foreground: '#50fa7b' }
        ],
        colors: {
          'editor.background': '#282a36',
          'editor.foreground': '#f8f8f2',
          'editor.lineHighlightBackground': '#44475a',
          'editorLineNumber.foreground': '#6272a4'
        }
      },
      'monokai': {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: '', foreground: '#f8f8f2', background: '#272822' },
          { token: 'comment', foreground: '#75715e' },
          { token: 'keyword', foreground: '#f92672' },
          { token: 'number', foreground: '#ae81ff' },
          { token: 'string', foreground: '#e6db74' },
          { token: 'identifier', foreground: '#a6e22e' }
        ],
        colors: {
          'editor.background': '#272822',
          'editor.foreground': '#f8f8f2',
          'editor.lineHighlightBackground': '#3e3d32',
          'editorLineNumber.foreground': '#75715e'
        }
      },
      'nord': {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: '', foreground: '#d8dee9', background: '#2e3440' },
          { token: 'comment', foreground: '#4c566a' },
          { token: 'keyword', foreground: '#81a1c1' },
          { token: 'number', foreground: '#b48ead' },
          { token: 'string', foreground: '#a3be8c' },
          { token: 'identifier', foreground: '#ebcb8b' }
        ],
        colors: {
          'editor.background': '#2e3440',
          'editor.foreground': '#d8dee9',
          'editor.lineHighlightBackground': '#3b4252',
          'editorLineNumber.foreground': '#4c566a'
        }
      },
      'gruvbox': {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: '', foreground: '#ebdbb2', background: '#282828' },
          { token: 'comment', foreground: '#665c54' },
          { token: 'keyword', foreground: '#fb4934' },
          { token: 'number', foreground: '#d3869b' },
          { token: 'string', foreground: '#b8bb26' },
          { token: 'identifier', foreground: '#fabd2f' }
        ],
        colors: {
          'editor.background': '#282828',
          'editor.foreground': '#ebdbb2',
          'editor.lineHighlightBackground': '#3c3836',
          'editorLineNumber.foreground': '#665c54'
        }
      },
      'solarized-dark': {
        base: 'vs-dark',
        inherit: true,
        rules: [
          { token: '', foreground: '#839496', background: '#002b36' },
          { token: 'comment', foreground: '#586e75' },
          { token: 'keyword', foreground: '#859900' },
          { token: 'number', foreground: '#d33682' },
          { token: 'string', foreground: '#2aa198' },
          { token: 'identifier', foreground: '#b58900' }
        ],
        colors: {
          'editor.background': '#002b36',
          'editor.foreground': '#839496',
          'editor.lineHighlightBackground': '#073642',
          'editorLineNumber.foreground': '#586e75'
        }
      },
      'solarized-light': {
        base: 'vs',
        inherit: true,
        rules: [
          { token: '', foreground: '#657b83', background: '#fdf6e3' },
          { token: 'comment', foreground: '#93a1a1' },
          { token: 'keyword', foreground: '#859900' },
          { token: 'number', foreground: '#d33682' },
          { token: 'string', foreground: '#2aa198' },
          { token: 'identifier', foreground: '#b58900' }
        ],
        colors: {
          'editor.background': '#fdf6e3',
          'editor.foreground': '#657b83',
          'editor.lineHighlightBackground': '#eee8d5',
          'editorLineNumber.foreground': '#93a1a1'
        }
      }
    };
  }

  init() {
    if (!window.monaco) return;
    for (const [name, definition] of Object.entries(this._themes)) {
      monaco.editor.defineTheme(name, definition);
    }
  }

  apply(themeName) {
    this.currentTheme = themeName;

    // Aplicar ao documento
    document.documentElement.setAttribute('data-theme', themeName);

    // Aplicar ao Monaco
    if (window.monaco) {
      monaco.editor.setTheme(themeName);
    }
  }

  getCurrent() {
    return this.currentTheme;
  }

  getAvailableThemes() {
    return [
      { id: 'vs-dark', name: 'Dark' },
      { id: 'vs', name: 'Light' },
      { id: 'hc-black', name: 'High Contrast' },
      { id: 'dracula', name: 'Dracula' },
      { id: 'monokai', name: 'Monokai' },
      { id: 'solarized-dark', name: 'Solarized Dark' },
      { id: 'solarized-light', name: 'Solarized Light' },
      { id: 'nord', name: 'Nord' },
      { id: 'gruvbox', name: 'Gruvbox' }
    ];
  }
}
