import { editor } from 'monaco-editor';
import * as monaco from 'monaco-editor/esm/vs/editor/editor.api';

type Monaco = typeof monaco;

export const editorOnMount = async (
  editor: editor.IStandaloneCodeEditor,
  monaco: Monaco
) => {
  // monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  //   // experimentalDecorators: false,
  // });

  // // Supress typescript import errors
  monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
    diagnosticCodesToIgnore: [2307],
    noSemanticValidation: true,
    noSyntaxValidation: true,
  });

  const keywords = [
    'impure',
    'inline',
    'global',
    'return',
    'cell',
    'slice',
    'if',
    'while',
    'method_id',
  ];

  let globalMethods = ['get_data', 'set_data', 'begin_cell', 'throw'];

  const types = ['int', 'var'];

  const messageMethods = ['recv_internal', 'recv_external'];

  monaco.languages.registerCompletionItemProvider('func', {
    provideCompletionItems: (model, position) => {
      var word = model.getWordUntilPosition(position);
      var range = {
        startLineNumber: position.lineNumber,
        endLineNumber: position.lineNumber,
        startColumn: word.startColumn,
        endColumn: word.endColumn,
      };
      const suggestions = [
        ...keywords.map((k) => {
          return {
            label: k,
            kind: monaco.languages.CompletionItemKind.Keyword,
            insertText: k,
            range,
          };
        }),
        ...globalMethods.map((k) => {
          return {
            label: k,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: k,
            range,
          };
        }),
        ...messageMethods.map((k) => {
          return {
            label: k,
            kind: monaco.languages.CompletionItemKind.Function,
            insertText: k,
            range,
          };
        }),
      ];

      return { suggestions: suggestions };
    },
    // triggerCharacters: ['/'],
  });

  let packagesRequired = [
    // {
    //   name: "ton-crypto@3.2.0",
    //   text: 
    // },
    {
      name: "@ton/core@0.54.0",
      text: await fetch('/assets/ton/types/ton-core.d.ts').then( response => response.text() ),
      filePath: 'file:///node_modules/@types/ton-core/index.d.ts'
    },
    {
      name: "@ton-community/sandbox@3.2.0",
      text: await fetch('/assets/ton/types/ton-sandbox.d.ts').then( response => response.text() ),
      filePath: 'file:///node_modules/@types/@ton-community/sandbox/index.d.ts'
    }
  ]

  packagesRequired.forEach( pkg => {
    monaco.languages.typescript.typescriptDefaults.addExtraLib(
      pkg.text,
      pkg.filePath
    )
  })
};
