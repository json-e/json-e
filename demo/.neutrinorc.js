const airbnb = require('@neutrinojs/airbnb');
const react = require('@neutrinojs/react');

module.exports = {
  options: {
    root: __dirname,
    output: '../docs',
  },
  use: [
    airbnb({
      eslint: {
        rules: {
          // object props are OK here
          'react/forbid-prop-types': 'off',
          // App uses raw-loader just to load the README.md
          'import/no-webpack-loader-syntax': 'off',
        },
      },
    }),
    react({
      html: {
        title: 'JSON-e'
      }
    }),
    (neutrino) => {
		  neutrino.config.module
			  .rule('markdown')
				  .test(/\.md$/)
				  .use('raw-loader')
            .loader('raw-loader');
	  },
  ],
};
