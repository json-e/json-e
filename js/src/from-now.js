// Regular expression matching:
// A years B months C days D hours E minutes F seconds
var timeExp = new RegExp([
  '^(\\s*(-|\\+))?',
  '(\\s*(?<years>\\d+)\\s*(y|year|years|yr))?',
  '(\\s*(?<months>\\d+)\\s*(months|month|mo))?',
  '(\\s*(?<weeks>\\d+)\\s*(weeks|week|wk|w))?',
  '(\\s*(?<days>\\d+)\\s*(days|day|d))?',
  '(\\s*(?<hours>\\d+)\\s*(hours|hour|hr|h))?',
  '(\\s*(?<minutes>\\d+)\\s*(minutes|minute|min|m))?',
  '(\\s*(?<seconds>\\d+)\\s*(seconds|second|sec|s))?',
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
  let groups = match.groups;
  return {
    years:    parseInt(groups['years']   || 0, 10) * neg,
    months:   parseInt(groups['months']  || 0, 10) * neg,
    weeks:    parseInt(groups['weeks']   || 0, 10) * neg,
    days:     parseInt(groups['days']    || 0, 10) * neg,
    hours:    parseInt(groups['hours']   || 0, 10) * neg,
    minutes:  parseInt(groups['minutes'] || 0, 10) * neg,
    seconds:  parseInt(groups['seconds'] || 0, 10) * neg,
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
