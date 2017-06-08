from __future__ import absolute_import, print_function, unicode_literals

import re

from .constructs import constructs
from .shared import JSONTemplateError, DeleteMarker

_context_re = re.compile(r'[a-zA-Z_][a-zA-Z0-9_]*$')


def render(template, context):
    if not all(_context_re.match(c) for c in context):
        raise JSONTemplateError('top level keys of context must follow /[a-zA-Z_][a-zA-Z0-9_]*/')

    def recur(template, context):
        if isinstance(template, basestring):
            # TODO: interpolate
            return template

        elif isinstance(template, dict):
            matches = [k for k in template if k in constructs]
            if not matches:
                return template
            if len(matches) > 1:
                raise JSONTemplateError("only one construct allowed")
            return constructs[matches[0]](template, basestring)

        elif isinstance(template, list):
            rendered = (recur(e, context) for e in template)
            return [e for e in rendered if e is not DeleteMarker]

        else:
            return template

    return recur(template, context)
