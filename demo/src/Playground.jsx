import React from 'react';
import jsyaml from 'js-yaml';
import { Heading } from 'rebass';
import CodeMirror from '@skidding/react-codemirror';
import CopyToClipboard from 'react-copy-to-clipboard';
import jsone from '../..';

const codeMirrorOptions = {
  mode: 'yaml',
  lint: true,
  theme: 'elegant',
  indentWithTabs: false,
  tabSize: 2,
  gutters: ['CodeMirror-lint-markers'],
};

export default class Playground extends React.Component {
  state = {
    template: '{}',
    context: '{}',
  };

  /* eslint-disable react/no-deprecated */
  componentWillMount() {
    window.addEventListener('hashchange', () => this.hashChanged());
    // load the initial hash
    this.hashChanged();
  }
  /* eslint-enable react/no-deprecated */

  hashChanged() {
    if (window.location.hash) {
      const m = /#Playground\/(.*)&(.*)/.exec(window.location.hash);
      if (m) {
        this.setState({
          context: decodeURIComponent(m[1]),
          template: decodeURIComponent(m[2]),
        });
        // zero out the link body
        // eslint-disable-next-line no-restricted-globals
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
    const { context, template, copied } = this.state;
    const playgroundLink = `${document.location.origin}${document.location.pathname}#Playground/${encodeURIComponent(context)}&${encodeURIComponent(template)}`;

    let result; let
      error;
    try {
      result = jsyaml.safeDump(jsone(
        jsyaml.safeLoad(template) || null,
        jsyaml.safeLoad(context) || {},
      ));
    } catch (err) {
      error = err;
    }

    return (
      <div id="Playground/">
        <Heading f={1}>Playground</Heading>
        <div className="codeblocks">
          <div>
            <Heading f={2}>Template</Heading>
            <CodeMirror
              value={template}
              onChange={(t) => this.updateTemplate(t)}
              options={codeMirrorOptions}
            />
          </div>
          <div>
            <Heading f={2}>Context</Heading>
            <CodeMirror
              value={context}
              onChange={(c) => this.updateContext(c)}
              options={codeMirrorOptions}
            />
          </div>
          <div>
            <Heading f={2}>Results</Heading>
            {result ? (
              <CodeMirror
                value={result}
                options={{
                  ...codeMirrorOptions,
                  readOnly: 'nocursor',
                  gutters: [],
                }}
              />
            ) : (
              <CodeMirror
                value={`Error:\n${error.toString()}`}
                options={{
                  ...codeMirrorOptions,
                  mode: 'null',
                  readOnly: 'nocursor',
                  gutters: [],
                  css: 'background-color: "tomato"',
                }}
              />
            )}
          </div>
        </div>
        <div className="notes">
          <CopyToClipboard
            text={playgroundLink}
            onCopy={() => this.setState({ copied: true })}
          >
            <span className="clicky">copy link to this example</span>
          </CopyToClipboard>
          { copied && <span>copied to clipboard!</span> }
        </div>
      </div>
    );
  }
}
