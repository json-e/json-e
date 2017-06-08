from __future__ import absolute_import, print_function, unicode_literals

import re
from .render import JSONTemplateError, renderValue

_context_re = re.compile(r'[a-zA-Z_][a-zA-Z0-9_]*$')


def render(template, context):
    if not all(_context_re.match(c) for c in context):
        raise JSONTemplateError('top level keys of context must follow /[a-zA-Z_][a-zA-Z0-9_]*/')
    return renderValue(template, context)
