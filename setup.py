from setuptools import setup, find_packages

setup(name='json-e',
    version='1.0.0', ## TODO: extract from package.json
    description='A data-structure parameterization system written for embedding context in JSON objects',
    author='Dustin J. Mitchell',
    url='https://github.com/taskcluster/json-e',
    author_email='dustin@mozilla.com',
    packages=find_packages(),
    test_suite='nose.collector',
    license='MPL2',
    tests_require=[
        "nose",
        "PyYAML",
        "python-dateutil",
    ]
)
