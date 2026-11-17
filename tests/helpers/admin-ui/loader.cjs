/* eslint-disable @typescript-eslint/no-require-imports -- Webpack synchronous test loader. */
const path = require('node:path');
const { createRequire } = require('node:module');

module.exports = function (source) {
  const { repoRoot } = this.getOptions();
  const ts = createRequire(path.join(repoRoot, 'package.json'))('typescript');
  return ts.transpileModule(source, {
    fileName: this.resourcePath,
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
      esModuleInterop: true,
    },
  }).outputText;
};
