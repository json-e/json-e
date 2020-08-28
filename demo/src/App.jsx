import React from 'react';
import { hot } from 'react-hot-loader';
import './App.css';
import jsyaml from 'js-yaml';
import { find, defaults } from 'lodash';
import {
  Heading, Button, Link,
  Text, Footer, Tabs, TabItem,
} from 'rebass';
import sections from 'sections';
import ReactMarkdown from 'react-markdown';
import readme from 'raw-loader!../../README.md';
import CodeMirror from '@skidding/react-codemirror';
import CopyToClipboard from 'react-copy-to-clipboard';
import DemoBlock from './demoblock';
import packageinfo from '../../package.json';
import readmeTree from './readme';
import jsone from '../../src';

import 'codemirror/mode/yaml/yaml';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/yaml-lint';

window.jsyaml = jsyaml; // Making this available to yaml linter

const codeMirrorOptions = {
  mode: 'yaml',
  lint: true,
  theme: 'elegant',
  indentWithTabs: false,
  tabSize: 2,
  gutters: ['CodeMirror-lint-markers'],
};

class Section extends React.Component {
  render() {
    const { showDemo, section } = this.props;
    const renderers = showDemo ? { CodeBlock: DemoBlock } : {};

    if (!section) {
      return <p>No such section</p>;
    }

    return (
      <div id={section.anchor} className="demo">
        {section.heading
          && <ReactMarkdown source={section.heading} />}
        {section.body && (
          <ReactMarkdown
            source={section.body}
            renderers={renderers}
          />
        )}
        {(section.children || []).map((child) => (
          <Section showDemo={showDemo} section={child} key={child.anchor} />
        ))}
      </div>
    );
  }
}

class SidebarMenu extends React.Component {
  render() {
    const { section, title, tab } = this.props;

    return (
      <li>
        <Link href={`#${tab}/${section ? section.anchor : ''}`}>{title}</Link>
        {section && section.children.length > 0 && (
        <ul>
          {section.children.map((child) => <SidebarMenu key={child.anchor} tab={tab} title={child.title} section={child} />)}
        </ul>
        )}
      </li>
    );
  }
}

class Jsone extends React.Component {
  constructor(props) {
    super(props);
    this.cmOptions = defaults({
      readOnly: 'nocursor',
      gutters: [],
    }, codeMirrorOptions);
  }

  render() {
    const res = jsone(
      jsyaml.safeLoad(this.props.template),
      jsyaml.safeLoad(this.props.context),
    );
    return (
      <CodeMirror value={jsyaml.safeDump(res)} options={this.cmOptions} />
    );
  }
}

class Playground extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      template: '{}',
      context: '{}',
    };
  }

  componentWillMount() {
    window.addEventListener('hashchange', () => this.hashChanged());
    // load the initial hash
    this.hashChanged();
  }

  hashChanged() {
    if (window.location.hash) {
      const m = /#Playground\/(.*)&(.*)/.exec(window.location.hash);
      if (m) {
        console.log('match', m);
        this.setState({
          context: decodeURIComponent(m[1]),
          template: decodeURIComponent(m[2]),
        });
        // zero out the link body
        history.replaceState({}, 'Playground', '#Playground');

        const elt = document.getElementById('Playground/');
        elt.scrollIntoView();
      }
    }
  }

  updateContext(context) {
    try {
      // Only update if valid yaml. lint will warn user.
      jsyaml.safeLoad(context);
      this.setState({ context });
    } catch (err) {
      if (err.name !== 'YAMLException') {
        throw err;
      }
    }
  }

  updateTemplate(template) {
    try {
      // Only update if valid yaml. lint will warn user.
      jsyaml.safeLoad(template);
      this.setState({ template });
    } catch (err) {
      if (err.name !== 'YAMLException') {
        throw err;
      }
    }
  }

  render() {
    const playgroundLink = `${document.location.origin}${document.location.pathname}#Playground/${encodeURIComponent(this.state.context)}&${encodeURIComponent(this.state.template)}`;
    return (
      <div id="Playground/">
        <Heading f={1}>Playground</Heading>
        <div className="codeblocks">
          <div>
            <Heading f={2}>Template</Heading>
            <CodeMirror value={this.state.template} onChange={(template) => this.updateTemplate(template)} options={codeMirrorOptions} />
          </div>
          <div>
            <Heading f={2}>Context</Heading>
            <CodeMirror value={this.state.context} onChange={(context) => this.updateContext(context)} options={codeMirrorOptions} />
          </div>
          <div>
            <Heading f={2}>Results</Heading>
            <Jsone context={this.state.context} template={this.state.template} />
          </div>
        </div>
        <div className="notes">
          <CopyToClipboard
            text={playgroundLink}
            onCopy={() => this.setState({ copied: true })}
          >
            <span className="clicky">copy link to this example</span>
          </CopyToClipboard>
          { this.state.copied && <span>copied to clipboard!</span> }
        </div>
      </div>
    );
  }
}

class App extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      readme: readmeTree(readme),
      activeTab: 'About',
    };
  }

  componentWillMount() {
    window.addEventListener('hashchange', () => this.hashChanged());
    // load the initial hash
    this.hashChanged();
  }

  hashChanged() {
    if (window.location.hash) {
      const hash = window.location.hash.split('/');
      this.setState({
        activeTab: hash[0].slice(1),
        activeAnchor: hash[1],
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
              {tabs.map(({ name, section }) => <SidebarMenu key={name} title={name} tab={name} section={section} />)}
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
            {tabs.map(({name, section, showDemo}) => name === 'Playground'
                ? <Playground key={name} />
                : <Section section={section} showDemo={showDemo} key={name} />)}
          </div>
        </div>
      </div>
    );
  }
}

export default hot(module)(App);
