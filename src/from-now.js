// Regular expression matching:
// A years B months C days D hours E minutes F seconds
var timeExp = new RegExp([
  '^(\\s*(-|\\+))?',
  '(\\s*(\\d+)\\s*y((ears?)|r)?)?',
  '(\\s*(\\d+)\\s*mo(nths?)?)?',
  '(\\s*(\\d+)\\s*w((eeks?)|k)?)?',
  '(\\s*(\\d+)\\s*d(ays?)?)?',
  '(\\s*(\\d+)\\s*h((ours?)|r)?)?',
  '(\\s*(\\d+)\\s*m(in(utes?)?)?)?',
  '(\\s*(\\d+)\\s*s(ec(onds?)?)?)?',
  '\\s*$',
].join(''), 'i');

/** Parse time string */
var parseTime = function(str) {
  // Parse the string
  var match = timeExp.exec(str || '');
  if (!match) {
    throw new Error('String: \'' + str + '\' isn\'t a time expression');
  }
  // Negate if needed
  var neg = match[2] === '-' ? - 1 : 1;
  // Return parsed values
  return {
    years:    parseInt(match[4]   || 0, 10) * neg,
    months:   parseInt(match[8]   || 0, 10) * neg,
    weeks:    parseInt(match[11]  || 0, 10) * neg,
    days:     parseInt(match[15]  || 0, 10) * neg,
    hours:    parseInt(match[18]  || 0, 10) * neg,
    minutes:  parseInt(match[22]  || 0, 10) * neg,
    seconds:  parseInt(match[25]  || 0, 10) * neg,
  };
};

// Render timespan fromNow as JSON timestamp
module.exports = (timespan = '', reference) => {
  let offset = parseTime(timespan);

  // represent months and years as 30 and 365 days, respectively
  offset.days += 30 * offset.months;
  offset.days += 365 * offset.years;

  if (reference) {
    reference = new Date(reference);
  } else {
    reference = new Date();
  }

  var retval = new Date(
    reference.getTime()
    + offset.weeks   * 7 * 24 * 60 * 60 * 1000
    + offset.days        * 24 * 60 * 60 * 1000
    + offset.hours            * 60 * 60 * 1000
    + offset.minutes               * 60 * 1000
    + offset.seconds                    * 1000
  );
  return retval.toJSON();
};
