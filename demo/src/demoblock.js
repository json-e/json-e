import React from 'react';
import jsyaml from 'js-yaml';
import jsone from '../../src';
import defaults from 'lodash/defaults';
import { Heading, Message } from 'rebass';
import CodeMirror from '@skidding/react-codemirror';
import CopyToClipboard from 'react-copy-to-clipboard';

import 'codemirror/mode/yaml/yaml';
import 'codemirror/mode/javascript/javascript';
import 'codemirror/addon/lint/lint';
import 'codemirror/addon/lint/yaml-lint';

window.jsyaml = jsyaml; // Making this available to yaml linter

const codeMirrorOptions =  {
  mode: 'yaml',
  lint: true,
  theme: 'elegant',
  indentWithTabs: false,
  tabSize: 2,
  gutters: [ 'CodeMirror-lint-markers', ],
};

class Jsone extends React.Component {
  constructor(props) {
    super(props);
    this.cmOptions = defaults({
      readOnly: 'nocursor',
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
        <CodeMirror value={jsyaml.safeDump(res)} options={this.cmOptions} />
      );
    } catch (err) {
      return (
        <Message bg="#f0b7bc">
          {err.message}
        </Message>
      );
    }
  }
}

export default class DemoBlock extends React.Component {
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
            <Heading f={2}>Template</Heading>
            <CodeMirror value={this.state.template} onChange={template => this.updateTemplate(template)} options={codeMirrorOptions} />
          </div>
          <div>
            <Heading f={2}>Context</Heading>
            <CodeMirror value={this.state.context} onChange={context => this.updateContext(context)} options={codeMirrorOptions} />
          </div>
          <div>
            <Heading f={2}>Results</Heading>
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
          { this.state.copied && <span>copied to clipboard!</span> }
        </div>
      </div>
    );
  }
}
