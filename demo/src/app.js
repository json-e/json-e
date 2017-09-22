import React from 'react';
import './app.css';
import jsyaml from 'js-yaml';
import { find } from 'lodash';
import { Heading, Divider, Badge, Button, Link,
         Text, Message, Footer, Tabs, TabItem } from 'rebass';
import sections from 'sections';
import ReactMarkdown from 'react-markdown';
import DemoBlock from './demoblock';
import packageinfo from '../../package.json';
import readme from 'raw-loader!../../README.md';
import readmeTree from './readme';

class Section extends React.Component {
  render() {
    const { showDemo, section, key } = this.props;
    const renderers = showDemo ? { CodeBlock: DemoBlock } : {};

    if (!section) {
      return <p>No such section</p>;
    }

    return (
      <div key={key} id={section.anchor} className="demo">
        {section.heading &&
          <ReactMarkdown source={section.heading} />
        }
        {section.body && (
          <ReactMarkdown
            source={section.body}
            renderers={renderers} />
        )}
        {(section.children || []).map(child => (
         <Section showDemo={showDemo} section={child} key={child.anchor} />
        ))}
      </div>
    );
  }
}

class SidebarMenu extends React.Component {
  render() {
    const { section, title, tab } = this.props;

    return <li>
      <Link href={`#${tab}/${section.anchor}`}>{title || section.title}</Link>
      {section.children.length > 0 && (
        <ul>
          {section.children.map(child => <SidebarMenu tab={tab} key={child.anchor} section={child} />)}
        </ul>
      )}
    </li>;
  }
}

export default class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      readme: readmeTree(readme),
      activeTab: 'About'
    };

    /* TODO: fix playground links */
    /*
    const params = new URLSearchParams(document.location.search.substring(1));
    let tmpl = '{}';
    let ctx = '{}';
    if (params.get('template') && params.get('context')) {
      try {
        tmpl = JSON.stringify(jsyaml.safeLoad(params.get('template')));
        ctx = JSON.stringify(jsyaml.safeLoad(params.get('context')));
      } catch (err) {
        if (err.name !== 'YAMLException') {
          throw err;
        }
      }
    }
    this.playground = {
      anchor: 'playground',
      title: 'Playground',
      heading: '## Playground',
      body: `
You can experiment with it here and view examples of all of the language
features below!
\`\`\`yaml
template:
  ${tmpl}
context:
  ${ctx}
result: {}
\`\`\`
      `,
    };
    */
  }

  componentWillMount() {
    window.addEventListener("hashchange", () => this.hashChanged());
    // load the initial hash
    this.hashChanged();
  }

  hashChanged() {
    if (window.location.hash) {
      const hash = window.location.hash.split('/');
      this.setState({
        activeTab: hash[0].slice(1),
        activeAnchor: hash[1]
      });
    }
  }

  componentDidUpdate() {
    const { activeAnchor } = this.state;
    if (activeAnchor) {
      const elt = document.getElementById(activeAnchor);
      if (elt) {
        elt.scrollIntoView();
      }
    }
  }

  render() {
    const { readme, activeTab, activeAnchor } = this.state;

    const tabs = [
      { name: 'About', section: readme.child('JSON-e') },
      { name: 'Interface', section: readme.child('Interface') },
      { name: 'Language', section: readme.child('Language Reference'), showDemo: true },
      { name: 'Development', section: readme.child('Development and testing') }
    ];

    const activeData = find(tabs, { name: activeTab }) || tabs[0];

    return (
      <div className="wrap">
        <div className="main">
          <aside className="sidebar">
            <Heading f={3}>
              JSON-e v{packageinfo.version}
            </Heading>
            <Text>
              A data-structure parameterization system for embedding context in JSON objects
            </Text>
            <Divider width={100}/>
            <ul>
              {tabs.map(({ name, section }) =>
                <SidebarMenu key={name} tab={name} title={name} section={section} />)}
            </ul>
            <Divider width={100}/>
            <div>
              <Text f={1}>
              Brought to you by the Mozillians behind <a href={'https://docs.taskcluster.net/'}>Taskcluster</a>.
              </Text>
            </div>
          </aside>
          <div className="content">
            <Tabs>
              {tabs.map(({ name }) => (
                <TabItem
                  key={name} 
                  onClick={() => { window.location.hash = `#${name}`; }}
                  active={name === activeTab }>
                  {name}
                </TabItem>
              ))}
            </Tabs>
            <Section section={activeData.section} showDemo={activeData.showDemo} />
          </div>
        </div>
      </div>
    );
  }
}
