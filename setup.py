import json
import os
from setuptools import setup, find_packages

package_json = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'package.json')
with open(package_json) as f:
    version = json.load(f)['version']

description='A data-structure parameterization system written for embedding context in JSON objects',

long_description = '''\
{description}.

See https://taskcluster.github.io/json-e/ for usage information.
'''.format(description=description)

setup(name='json-e',
    version=version,
    description=description,
    long_description=long_description,
    author='Dustin J. Mitchell',
    url='https://taskcluster.github.io/json-e/',
    author_email='dustin@mozilla.com',
    packages=['jsone'],
    test_suite='nose.collector',
    license='MPL2',
    extras_require={
        'release': [
            'towncrier',
        ],
    },
    tests_require=[
        "freezegun",
        "hypothesis",
        "nose",
        "PyYAML",
        "python-dateutil",
        'pep8',
    ],
    python_requires='~=2.7, >=3.6'
)
