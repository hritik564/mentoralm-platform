/* eslint-disable @typescript-eslint/no-require-imports -- This isolated CJS harness installs a synchronous TypeScript require hook for React SSR. */
// Isolated Node renderer: Playwright transforms JSX into component-test objects,
// while these tests need actual React SSR. No preview route enters the app.
const ts = require('typescript');
const fs = require('node:fs');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
for (const extension of ['.ts', '.tsx']) {
  require.extensions[extension] = (module, filename) => {
    const { outputText } = ts.transpileModule(
      fs.readFileSync(filename, 'utf8'),
      {
        compilerOptions: {
          module: ts.ModuleKind.CommonJS,
          jsx: ts.JsxEmit.ReactJSX,
          esModuleInterop: true,
        },
        fileName: filename,
      },
    );
    module._compile(outputText, filename);
  };
}
const {
  CourseCard,
} = require('../../src/components/dashboard/courses/CourseCard.tsx');
const {
  ContinueLearning,
} = require('../../src/components/dashboard/courses/ContinueLearning.tsx');
const records = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(
  renderToStaticMarkup(
    React.createElement(
      'main',
      null,
      ...records.map(({ resume, ...props }, index) =>
        React.createElement(resume ? ContinueLearning : CourseCard, {
          ...props,
          key: index,
        }),
      ),
    ),
  ),
);
