"""
Test the Python source for pep8-compliance.

Adapted from http://blog.jameskyle.org/2014/05/pep8-pylint-tests-with-nose-xunit/
"""

from __future__ import absolute_import, print_function, unicode_literals

from nose.tools import ok_
import os
import re

import pep8


class CustomReport(pep8.StandardReport):
    """
    Collect report into an array of results.
    """
    results = []

    def get_file_results(self):
        if self._deferred_print:
            self._deferred_print.sort()
            for line_number, offset, code, text, _ in self._deferred_print:
                self.results.append({
                    'path': self.filename,
                    'row': self.line_offset + line_number,
                    'col': offset + 1,
                    'code': code,
                    'text': text,
                })
        return self.file_errors


def fail(msg):
    """
    Fails with message.
    """
    ok_(False, msg)


def test_pep8_conformance():
    """
    Test for pep8 conformance
    """
    pattern = re.compile(r'.*({0}.*\.py)'.format('jsone'))
    base = os.path.dirname(os.path.abspath(__file__))
    dirname = os.path.abspath(os.path.join(base, '../jsone'))

    sources = [
        os.path.join(root, pyfile) for root, _, files in os.walk(dirname)
        for pyfile in files
        if pyfile.endswith('.py')]

    pep8style = pep8.StyleGuide(reporter=CustomReport, paths=[dirname])
    report = pep8style.init_report()
    pep8style.check_files(sources)

    for error in report.results:
        msg = "{path}: {code} {row}, {col} - {text}"
        match = pattern.match(error['path'])
        if match:
            rel_path = match.group(1)
        else:
            rel_path = error['path']

        def fail():
            raise AssertionError(msg.format(
                path=rel_path,
                code=error['code'],
                row=error['row'],
                col=error['col'],
                text=error['text']
            ))
        yield fail
