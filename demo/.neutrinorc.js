let output = 'docs';

module.exports = {
  use: [
    ['neutrino-preset-react', {
      html: {
        title: 'JSON-e',
      },
    }],
    'neutrino-middleware-postcss',
  ],
  env: {
    NODE_ENV: {
      production: {
        use: [
          ['neutrino-middleware-clean', {
            paths: [output],
          }],
        ]
      },
    },
  },
  options: {
    root: '..',
    output: output,
    source: 'demo/src',
  },
}
