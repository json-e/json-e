// Regular expression matching a timespan on the form:
// X days Y hours Z minutes
const timespanExpression = new RegExp([
  '^(?:\\s*(-|\\+))?',
  '(?:\\s*(\\d+)\\s*d(?:ays?)?)?',
  '(?:\\s*(\\d+)\\s*h(?:(?:ours?)|r)?)?',
  '(?:\\s*(\\d+)\\s*m(?:(?:in(?:utes?)?)?)?)?',
  '\\s*$',
].join(''), 'i');

// Render timespan fromNow as JSON timestamp
export default (timespan = '', reference = Date.now()) => {
  let m = timespanExpression.exec(timespan);
  if (!m) {
    throw new Error('Invalid timespan expression: ' + timespan);
  }
  let neg = m[1] === '-' ? - 1 : 1;
  let days = parseInt(m[2] || 0, 10);
  let hours = parseInt(m[3] || 0, 10);
  let minutes = parseInt(m[4] || 0, 10);
  return new Date(
    reference + neg * ((days * 24 + hours) * 60 + minutes) * 60 * 1000,
  ).toJSON();
};
