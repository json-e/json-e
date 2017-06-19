import React from 'react';
import jsyaml from 'js-yaml';
import './app.css';
import jsone from '../../src';
import packageinfo from '../../package.json';
import readme from 'raw-loader!../../README.md';
import { Heading, Divider, Badge, Space, Button,
         Text, Message, Footer } from 'rebass';
import defaults from 'lodash/defaults';
import 'codemirror/mode/yaml/yaml';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/yaml-lint';
import CodeMirror from '@skidding/react-codemirror';
import sections from 'sections';
import ReactMarkdown from 'react-markdown';
import CopyToClipboard from 'react-copy-to-clipboard';

window.jsyaml = jsyaml; // Making this available to yaml linter
const codeMirrorOptions = {
  mode: 'yaml',
  lint: true,
  theme: 'ambiance',
  indentWithTabs: false,
  tabSize: 2,
  gutters: [ 'CodeMirror-lint-markers', ],
};

class Jsone extends React.Component {
  constructor(props) {
    super(props);
    this.cmOptions = defaults({
      readOnly: 'nocursor',
      mode: {name: "javascript", json: true},
      gutters: []
    }, codeMirrorOptions);
  }

  render() {
    try {
      const res = jsone(
        jsyaml.safeLoad(this.props.template),
        jsyaml.safeLoad(this.props.context)
      );
      return (
        <CodeMirror value={JSON.stringify(res, null, 2)} options={this.cmOptions} />
      );
    } catch (err) {
      return (
        <Message theme="error">
          {err.message}
        </Message>
      );
    }
  }
}

class DemoBlock extends React.Component {
  constructor(props) {
    super(props);
    this.demo = true;
    if (props.language === 'yaml') {
      const literal = jsyaml.safeLoad(props.literal);
      if (literal.context && literal.template) {
        this.state = {
          context: jsyaml.safeDump(literal.context),
          template: jsyaml.safeDump(literal.template),
          copied: false,
          changed: false,
        }
      } else {
        this.demo = false;
      }
    } else {
      this.demo = false;
    }
  }

  updateContext(context) {
    try {
      // Only update if valid yaml. lint will warn user.
      jsyaml.safeLoad(context);
      this.setState({
        context,
        changed: true,
      });
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
      this.setState({
        template,
        changed: true,
      });
    } catch (err) {
      if (err.name !== 'YAMLException') {
        throw err;
      }
    }
  }

  render() {
    if (!this.demo) {
      return (
        <pre>
          <code>
            {this.props.literal}
          </code>
        </pre>
      );
    }
    const playgroundLink = `
${document.location.origin}${document.location.pathname}?template=${encodeURIComponent(this.state.template)}&context=${encodeURIComponent(this.state.context)}#playground
`.trim();
    return (
      <div>
        <div className="codeblocks">
          <div>
            <Heading level={5}>Template</Heading>
            <CodeMirror value={this.state.template} onChange={template => this.updateTemplate(template)} options={codeMirrorOptions} />
          </div>
          <div>
            <Heading level={5}>Context</Heading>
            <CodeMirror value={this.state.context} onChange={context => this.updateContext(context)} options={codeMirrorOptions} />
          </div>
          <div>
            <Heading level={5}>Results</Heading>
            <Jsone context={this.state.context} template={this.state.template} />
          </div>
        </div>
        <div className='notes'>
          { this.state.changed &&
            <CopyToClipboard text={playgroundLink}
              onCopy={() => this.setState({copied: true})}
            >
              <span className="clicky">copy link to this example</span>
            </CopyToClipboard>
          }
          <Space width={1}/>
          { this.state.copied && <span>copied to clipboard!</span> }
        </div>
      </div>
    );
  }
}

class SidebarLink extends React.Component {
  constructor(props) {
    super(props);
  }
  render() {
    return (
      <li>
        <a href={'#' + this.props.section.anchor}>
          <ReactMarkdown source={this.props.section.title}/>
        </a>
      </li>
    );
  }
}

class Section extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div id={this.props.section.anchor} className="demo">
        <Divider width={50} />
        <ReactMarkdown source={this.props.section.heading}/>
        <ReactMarkdown
          source={this.props.section.body}
          renderers={{
            CodeBlock: DemoBlock,
          }}
        />
      </div>
    );
  }
}

export default class App extends React.Component {
  constructor(props) {
    super(props);

    const parsed = sections.parse(readme);
    this.demos = [];
    this.interfaceExample;
    let active = false;
    for (let section of parsed.sections) {
      section.anchor = section.title;
      if (active) {
        if (section.level === 1) {
          break;
        }
        this.demos.push(section);
      } else if (section.heading === '# Language') {
        active = true;
      } else if (section.heading === '# Interface') {
        this.interfaceExample = section;
      }
    }

    const params = new URLSearchParams(document.location.search.substring(1));
    let tmpl = '{}';
    let ctx = '{}';
    if (params.get('template') && params.get('context')) {
      try {
        tmpl = jsyaml.safeDump(jsyaml.safeLoad(params.get('template')));
        ctx = jsyaml.safeDump(jsyaml.safeLoad(params.get('context')));
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
  }

  render() {
    return (
      <div className="wrap">
        <div className="main">
          <aside className="sidebar">
            <Heading level={1}>
              JSON-e
              <Space x={1} />
              <Badge rounded pill theme="info">v{packageinfo.version}</Badge>
            </Heading>
            <Text>
              A data-structure parameterization system for embedding context in JSON objects
            </Text>
            <Divider width={'100%'}/>
            <ul>
              <SidebarLink section={this.interfaceExample}/>
              <SidebarLink section={this.playground}/>
              {
                this.demos.map(demo => <SidebarLink key={demo.anchor} section={demo}/>)
              }
            </ul>
            <Footer>
              <Text small>
              Brought to you by the Mozillians behind <a href={'https://docs.taskcluster.net/'}>Taskcluster</a>.
              </Text>
              <Space x={1} />
            </Footer>
            <div style={{paddingBottom: '25px'}}>
              <Button rounded href={'https://www.mozilla.org/en-US/MPL/'}>
               License
              </Button>
              <Space x={1} />
              <Button rounded href={'https://github.com/taskcluster/json-e'}>
               Github
              </Button>
            </div>
          </aside>
          <div className="content">
            <div style={{paddingBottom: '25px'}}>
              <Button rounded href={'https://www.mozilla.org/en-US/MPL/'}>
               MPL License
              </Button>
              <Space x={1} />
              <Button rounded href={'https://github.com/taskcluster/json-e'}>
               Github
              </Button>
            </div>
            <p>
              JSON-e is a data-structure parameterization system written for embedding context in JSON objects.
            </p>

            <p>
              The central idea is to treat a data structure as a "template" and transform it, using another data structure as context, to produce an output data structure.
            </p>

            <p>
              There are countless libraries to do this with strings, such as mustache. What makes JSON-e unique is that it operates on data structures, not on their textual representation. This allows input to be written in a number of formats (JSON, YAML, etc.) or even generated dynamically. It also means that the output cannot be "invalid", even when including large chunks of contextual data.
            </p>

            <p>
              JSON-e is also designed to be safe for use on untrusted data. It never uses <code>eval</code> or any other function that might result in arbitrary code execution. It also disallows unbounded iteration, so any JSON-e rendering operation will finish in finite time.
            </p>
            <Section section={this.interfaceExample}/>
            <Section section={this.playground}/>
            {
              this.demos.map(demo => <Section key={demo.anchor} section={demo}/>)
            }
          </div>
        </div>
      </div>
    );
  }
}
