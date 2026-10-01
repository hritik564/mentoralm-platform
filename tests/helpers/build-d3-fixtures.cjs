/* eslint-disable @typescript-eslint/no-require-imports -- This test-only bundler uses Next's existing CommonJS Webpack export. */
const path = require('node:path');
const { webpack } = require('next/dist/compiled/webpack/webpack');
webpack(
  {
    mode: 'development',
    target: 'web',
    devtool: false,
    plugins: [
      new webpack.DefinePlugin({
        'process.env': JSON.stringify({ NODE_ENV: 'development' }),
      }),
    ],
    entry: path.resolve('tests/helpers/d3-fixtures.tsx'),
    output: {
      path: path.resolve('docs/reviews/d3'),
      filename: 'fixture-bundle.js',
    },
    resolve: { extensions: ['.tsx', '.ts', '.js'] },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: path.resolve('tests/helpers/d3-loader.cjs'),
        },
      ],
    },
  },
  (error, stats) => {
    if (error || stats.hasErrors()) {
      process.stderr.write(
        error ? error.message : stats.toString({ all: false, errors: true }),
      );
      process.exitCode = 1;
    }
  },
);
