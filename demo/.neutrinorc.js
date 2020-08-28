const airbnb = require('@neutrinojs/airbnb');
const react = require('@neutrinojs/react');

module.exports = {
  options: {
    root: __dirname,
  },
  use: [
    // too early for this..
    //airbnb(),
    react({
      html: {
        title: 'JSON-e'
      }
    }),
  ],
};
