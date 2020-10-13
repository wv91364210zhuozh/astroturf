const { relative, dirname } = require('path');

const { transformAsync } = require('@babel/core');
const fs = require('fs-extra');
const prettier = require('prettier');

const loader = require('../src/loader');

const PARSER_OPTS = {
  plugins: [
    'jsx',
    'flow',
    'doExpressions',
    'objectRestSpread',
    'classProperties',
    'exportDefaultFrom',
    'exportNamespaceFrom',
    'asyncGenerators',
    'dynamicImport',
    'throwExpressions',
  ],
};

function normalizeNewLines(str) {
  return str.replace(/\n\s*?\n/g, '\n').trim();
}

export const loaderPrefix = 'astroturf/css-loader?inline!';

export const requirePath = (currentName, pathname) =>
  `${currentName === 'babel' ? '' : loaderPrefix}${pathname}`;

export function format(strings, ...values) {
  const str = strings.reduce(
    (acc, next, idx) => `${acc}${next}${values[idx] || ''}`,
    '',
  );

  return normalizeNewLines(prettier.format(str, { parser: 'babel' }));
}

export async function run(src, options, filename = 'MyStyleFile.js') {
  const { code, metadata } = await transformAsync(src, {
    filename,
    babelrc: false,
    plugins: [
      [require('../src/plugin.ts'), { ...options, writeFiles: false }],
    ],
    parserOpts: PARSER_OPTS,
    sourceType: 'unambiguous',
  });

  return [
    normalizeNewLines(prettier.format(code, { filepath: filename })),
    metadata.astroturf.styles,
  ];
}

export async function runBabel(
  src,
  { filename = 'MyStyleFile.js', ...babelConfig },
) {
  const { code, metadata } = await transformAsync(src, {
    filename,
    parserOpts: PARSER_OPTS,
    sourceType: 'unambiguous',
    babelrc: false,
    ...babelConfig,
  });

  return [
    normalizeNewLines(prettier.format(code, { filepath: filename })),
    metadata.astroturf.styles,
  ];
}

export function runLoader(src, options, filename = 'MyStyleFile.js') {
  return new Promise((resolve, reject) => {
    const meta = {};
    const loaderContext = {
      query: options,
      loaders: [{ request: '/path/css-literal-loader' }],
      loaderIndex: 0,
      context: '',
      resource: filename,
      resourcePath: filename,
      request: `babel-loader!css-literal-loader!${filename}`,
      _compiler: {},
      _compilation: {
        fileTimestamps: new Map(),
      },
      _module: {},
      resolve(request, cb) {
        cb(null, relative(dirname(filename), request));
      },
      emitVirtualFile: (_absoluteFilePath, _value) => {},
      async: () => (err, result) => {
        if (err) reject(err);
        else
          resolve([
            normalizeNewLines(prettier.format(result, { filepath: filename })),
            meta.styles,
          ]);
      },
    };

    loader.call(loaderContext, src, null, meta);
  });
}

export const fixtures = fs
  .readdirSync(`${__dirname}/fixtures`)
  .map((file) => `${__dirname}/fixtures/${file}`)
  .filter((f) => !f.endsWith('.json'));

export * from './webpack-helpers';

function testAllRunnersImpl(t, msg, testFn) {
  t.each([
    ['babel', run],
    ['webpack', runLoader],
  ])(`${msg}  (%s)`, (name, runner) =>
    testFn(runner, {
      current: name,
      requirePath: (p) => requirePath(name, p),
    }),
  );
}

export function testAllRunners(msg, testFn) {
  testAllRunnersImpl(test, msg, testFn);
}

testAllRunners.only = testAllRunnersImpl.bind(null, test.only);
