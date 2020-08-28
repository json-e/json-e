import React from 'react';
import { hot } from 'react-hot-loader';
import './App.css';
import { Heading, Text } from 'rebass';
import rawReadme from '../../README.md';
import packageinfo from '../../package.json';
import readmeTree from './readme';
import Section from './Section';
import SidebarMenu from './SidebarMenu';
import Playground from './Playground';

const readme = readmeTree(rawReadme);

class App extends React.Component {
  static hashChanged() {
    const hash = window.location.hash.split('/');
    const activeAnchor = hash[1];
    if (activeAnchor) {
      const elt = document.getElementById(activeAnchor);
      if (elt) {
        elt.scrollIntoView();
      }
    }
  }

  /* eslint-disable react/no-deprecated */
  componentWillMount() {
    window.addEventListener('hashchange', () => App.hashChanged());
    // load the initial hash
    App.hashChanged();
  }
  /* eslint-enable react/no-deprecated */

  render() {
    const tabs = [
      { name: 'About', section: readme.child('JSON-e') },
      { name: 'Playground' },
      { name: 'Interface', section: readme.child('Interface') },
      { name: 'Language', section: readme.child('Language Reference'), showDemo: true },
    ];

    return (
      <div className="wrap">
        <div className="main">
          <aside className="sidebar">
            <Heading f={3}>
              JSON-e v
              {packageinfo.version}
            </Heading>
            <Text>
              A data-structure parameterization system for embedding context in JSON objects
            </Text>
            <hr />
            <ul>
              {tabs.map(
                ({ name, section }) => (
                  <SidebarMenu
                    key={name}
                    title={name}
                    tab={name}
                    section={section}
                  />
                ),
              )}
            </ul>
            <hr />
            <div>
              <Text f={1}>
                Brought to you by the Mozillians behind
                {' '}
                <a href="https://docs.taskcluster.net/">Taskcluster</a>
                .
              </Text>
            </div>
          </aside>
          <div className="content">
            {tabs.map(({ name, section, showDemo }) => (name === 'Playground'
              ? <Playground key={name} />
              : <Section section={section} showDemo={Boolean(showDemo)} key={name} />))}
          </div>
        </div>
      </div>
    );
  }
}

export default hot(module)(App);
