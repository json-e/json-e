import json
import os
from setuptools import setup, find_packages

version = "4.5.3"

description='A data-structure parameterization system written for embedding context in JSON objects'

long_description = '''\
{description}.

See https://json-e.js.org for usage information.
'''.format(description=description)

setup(name='json-e',
    version=version,
    description=description,
    long_description=long_description,
    author='Dustin J. Mitchell',
    url='https://json-e.js.org',
    author_email='dustin@mozilla.com',
    packages=['jsone'],
    license='MPL2',
    extras_require={
        'release': [
            'towncrier',
        ],
    }
)
