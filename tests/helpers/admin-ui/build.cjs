/* eslint-disable @typescript-eslint/no-require-imports -- Test-only Next webpack integration. */
const path = require('node:path');
const { createRequire } = require('node:module');
const fs = require('node:fs');

const repoRoot = path.resolve(process.env.MENTORALM_REPO_ROOT || process.cwd());
const repoRequire = createRequire(path.join(repoRoot, 'package.json'));
const { webpack } = repoRequire('next/dist/compiled/webpack/webpack');
const output = path.resolve(
  process.env.MENTORALM_ADMIN_UI_OUTPUT ||
    path.join(repoRoot, 'docs/reviews/admin-ui'),
);
fs.mkdirSync(output, { recursive: true });

webpack(
  {
    mode: 'development',
    target: 'web',
    devtool: false,
    entry: path.join(__dirname, 'fixture.tsx'),
    output: { path: output, filename: 'fixture-bundle.js' },
    resolve: {
      extensions: ['.tsx', '.ts', '.js'],
      modules: [path.join(repoRoot, 'node_modules'), 'node_modules'],
      alias: {
        '@': path.join(repoRoot, 'src'),
        'next/link$': path.join(__dirname, 'next-link.tsx'),
        'next/navigation$': path.join(__dirname, 'runtime.tsx'),
        'next/image$': path.join(__dirname, 'next-image.tsx'),
        '@clerk/nextjs$': path.join(__dirname, 'clerk.ts'),
      },
    },
    plugins: [
      new webpack.DefinePlugin({
        'process.env': JSON.stringify({ NODE_ENV: 'development' }),
      }),
      {
        apply(compiler) {
          compiler.hooks.normalModuleFactory.tap(
            'RejectServerModules',
            (factory) => {
              factory.hooks.beforeResolve.tap(
                'RejectServerModules',
                (request) => {
                  if (!request) return;
                  if (
                    request.request === 'server-only' ||
                    /^(@prisma\/|pg$|@clerk\/backend|@clerk\/nextjs\/server)/.test(
                      request.request,
                    )
                  ) {
                    throw Error(
                      'Offline UI fixture cannot import a server/provider module.',
                    );
                  }
                },
              );
            },
          );
        },
      },
    ],
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          exclude: /node_modules/,
          use: {
            loader: path.join(__dirname, 'loader.cjs'),
            options: { repoRoot },
          },
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
