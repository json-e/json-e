from __future__ import absolute_import, print_function, unicode_literals

import re
import datetime


class DeleteMarker:
    pass


class JSONTemplateError(Exception):
    def __init__(self, message):
        super(JSONTemplateError, self).__init__(message)
        self.location = []

    def add_location(self, loc):
        self.location.insert(0, loc)

    def __str__(self):
        location = " at template" + "".join(self.location)
        return "{}{}: {}".format(
            self.__class__.__name__, location if self.location else "", self.args[0]
        )


class TemplateError(JSONTemplateError):
    pass


class InterpreterError(JSONTemplateError):
    pass


# Regular expression matching: X days Y hours Z minutes
FROMNOW_RE = re.compile(
    "".join(
        [
            r"^(\s*(?P<years>\d+)\s*(years|year|yr|y))?",
            r"(\s*(?P<months>\d+)\s*(months|month|mo))?",
            r"(\s*(?P<weeks>\d+)\s*(weeks|week|wk|w))?",
            r"(\s*(?P<days>\d+)\s*(days|day|d))?",
            r"(\s*(?P<hours>\d+)\s*(hours|hour|hr|h))?",
            r"(\s*(?P<minutes>\d+)\s*(minutes|minute|min|m))?",
            r"(\s*(?P<seconds>\d+)\s*(seconds|second|sec|s))?\s*$",
        ]
    )
)


def fromNow(offset, reference):
    # copied from taskcluster-client.py
    # We want to handle past dates as well as future
    future = True
    offset = offset.lstrip()
    if offset.startswith("-"):
        future = False
        offset = offset[1:].lstrip()
    if offset.startswith("+"):
        offset = offset[1:].lstrip()

    # Parse offset
    m = FROMNOW_RE.match(offset)
    if m is None:
        raise TemplateError("offset string: '%s' does not parse" % offset)

    # In order to calculate years and months we need to calculate how many days
    # to offset the offset by, since timedelta only goes as high as weeks
    days = 0
    hours = 0
    minutes = 0
    seconds = 0
    if m.group("years"):
        # forget leap years, a year is 365 days
        years = int(m.group("years"))
        days += 365 * years
    if m.group("months"):
        # assume "month" means 30 days
        months = int(m.group("months"))
        days += 30 * months
    days += int(m.group("days") or 0)
    hours += int(m.group("hours") or 0)
    minutes += int(m.group("minutes") or 0)
    seconds += int(m.group("seconds") or 0)

    # Offset datetime from utc
    delta = datetime.timedelta(
        weeks=int(m.group("weeks") or 0),
        days=days,
        hours=hours,
        minutes=minutes,
        seconds=seconds,
    )

    if isinstance(reference, string):
        reference = datetime.datetime.strptime(reference, "%Y-%m-%dT%H:%M:%S.%fZ")
    elif reference is None:
        reference = datetime.datetime.utcnow()
    return stringDate(reference + delta if future else reference - delta)


datefmt_re = re.compile(r"(\.[0-9]{3})[0-9]*(\+00:00)?")


def to_str(v):
    if isinstance(v, bool):
        return {True: "true", False: "false"}[v]
    elif isinstance(v, list):
        return ",".join(to_str(e) for e in v)
    elif v is None:
        return "null"
    elif isinstance(v, string):
        return v
    else:
        return str(v)


def stringDate(date):
    # Convert to isoFormat
    try:
        string = date.isoformat(timespec="microseconds")
    # py2.7 to py3.5 does not have timespec
    except TypeError as e:
        string = date.isoformat()
        if string.find(".") == -1:
            string += ".000"
    string = datefmt_re.sub(r"\1Z", string)
    return string


# the base class for strings, regardless of python version
try:
    string = basestring
except NameError:
    string = str
