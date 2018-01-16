let output = 'docs';

module.exports = {
  use: [
    ['@neutrinojs/react', {
      html: {
        title: 'JSON-e',
      },
    }],
  ],
  env: {
    NODE_ENV: {
      production: {
        use: [
          ['@neutrinojs/clean', {
            paths: [output],
          }],
        ]
      },
    },
  },
  options: {
    root: '..',
    node_modules: 'demo/node_modules',
    output: output,
    source: 'demo/src',
  },
}
