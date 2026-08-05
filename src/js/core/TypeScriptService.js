/**
 * TypeScriptService - Configuração do Language Service do Monaco
 */
export class TypeScriptService {
  constructor(eventBus) {
    this.events = eventBus;
    this._definitions = new Map(); // moduleName -> { jsLib, tsLib, content }
    this._compilerOptions = {
      allowNonTsExtensions: true,
      moduleResolution: 2, // NodeJs
      target: 2, // ES2020
      allowJs: true,
      checkJs: true,
      strict: true,
      noEmit: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      baseUrl: '/',
      paths: {
        '*': ['*', '*.js', '*.ts']
      }
    };
  }

  init() {
    if (!window.monaco) return;

    const jsDefaults = monaco.languages.typescript.javascriptDefaults;
    const tsDefaults = monaco.languages.typescript.typescriptDefaults;

    jsDefaults.setCompilerOptions(this._compilerOptions);
    tsDefaults.setCompilerOptions({
      ...this._compilerOptions,
      strict: true,
      jsx: 1 // React
    });

    jsDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      diagnosticCodesToIgnore: [1108, 2307] // Ignora erros comuns de módulos não encontrados inicialmente
    });

    tsDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false
    });

    // Configurar sugestões
    jsDefaults.setSuggestOptions({
      completeFunctionCalls: true,
      includeAutomaticOptionalChainCompletions: true,
      includeCompletionsForModuleExports: true
    });

    tsDefaults.setSuggestOptions({
      completeFunctionCalls: true,
      includeAutomaticOptionalChainCompletions: true,
      includeCompletionsForModuleExports: true
    });
  }

  addTypeDefinitions(moduleName, dtsContent) {
    if (!window.monaco) return;

    this.removeTypeDefinitions(moduleName);

    const wrapped = `declare module "${moduleName}" {\n${dtsContent}\n}`;
    const uri = `file:///node_modules/${moduleName}/index.d.ts`;

    const jsLib = monaco.languages.typescript.javascriptDefaults.addExtraLib(wrapped, uri);
    const tsLib = monaco.languages.typescript.typescriptDefaults.addExtraLib(wrapped, uri);

    this._definitions.set(moduleName, { jsLib, tsLib, content: dtsContent });
    this.events.emit('types:loaded', { moduleName });
  }

  removeTypeDefinitions(moduleName) {
    if (!window.monaco) return;

    const defs = this._definitions.get(moduleName);
    if (defs) {
      defs.jsLib?.dispose();
      defs.tsLib?.dispose();
      this._definitions.delete(moduleName);
    }
  }

  getLoadedModules() {
    return Array.from(this._definitions.keys());
  }

  setCompilerOptions(options) {
    if (!window.monaco) return;
    this._compilerOptions = { ...this._compilerOptions, ...options };
    monaco.languages.typescript.javascriptDefaults.setCompilerOptions(this._compilerOptions);
    monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
      ...this._compilerOptions,
      strict: true
    });
  }

  async getDiagnostics(model) {
    if (!window.monaco) return [];
    const worker = await monaco.languages.typescript.getJavaScriptWorker();
    const client = await worker(model.uri);
    return await client.getSemanticDiagnostics(model.uri.toString());
  }
}
