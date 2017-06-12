from setuptools import setup, find_packages
import os

def make_test_suite():
    import unittest
    import yaml
    import jsone

    def todo(test, reason):
        "Wrap a test that should not pass yet"
        def wrap():
            try:
                test()
            except Exception:
                raise unittest.SkipTest(reason)
            raise AssertionError("test passed unexpectedly")
        return wrap

    def spec_test(spec):
        "Make a test function for a case from specification.yml"
        def test():
            exc, res = None, None
            try:
                res = jsone.render(spec['template'], spec['context'])
            except Exception as e:
                exc = e
            if 'error' in spec:
                assert exc, "expected exception"
            else:
                assert res == spec['result']
        return test

    # we have a temporary blacklist of tests expected to fail for Python; this
    # will go away once the Python implementation is complete.
    with open("python-blacklist.txt") as f:
        blacklist = set(l.strip() for l in f)

    class Case(unittest.FunctionTestCase):
        def __init__(self, func, name):
            unittest.FunctionTestCase.__init__(self, func)
            self.name = name

        def __str__(self):
            return self.name

    suite = unittest.TestSuite()
    subsuite = None
    section = None
    with open(os.path.join(os.path.dirname(__file__), 'specification.yml')) as f:
        for spec in yaml.load_all(f):
            if 'section' in spec:
                subsuite = unittest.TestSuite()
                section = spec['section']
                suite.addTest(subsuite)
                continue

            name = '{}: {}'.format(section, spec['title'])
            t = spec_test(spec)
            if name in blacklist:
                t = todo(t, 'blacklist')
            elif 'todo' in spec:
                t = todo(t, spec['todo'])
            test = Case(t, name)
            subsuite.addTest(test)
    return suite


if __name__ == "__main__":
    setup(name='json-e',
        version='1.0.0', ## TODO: extract from package.json
        description='A data-structure parameterization system written for embedding context in JSON objects',
        author='Dustin J. Mitchell',
        url='https://github.com/mozilla/build-fwunit',
        author_email='dustin@mozilla.com',
        packages=find_packages(),
        test_suite='setup.make_test_suite',
        license='MPL2',
        tests_require=[
            "PyYAML",
        ]
    )
