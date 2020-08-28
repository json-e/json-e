import React from 'react';
import { Button } from 'rebass';
import dedent from 'dedent-js';

const EXAMPLE_RE = /template:([^]*)\ncontext:([^]*)\nresult:/m;

export default class DemoBlock extends React.Component {
  constructor(props) {
    super(props);

    this.state = { playable: true };
    if (!EXAMPLE_RE.exec(props.literal)) {
      this.state.playable = false;
    }
  }

  play() {
    // try to sensibly break up the example block, preserving YAML formatting
    const m = EXAMPLE_RE.exec(this.props.literal);
    const template = m[1];
    const context = m[2];
    window.location.hash = `#Playground/${encodeURIComponent(dedent(context).trim())}&${encodeURIComponent(dedent(template).trim())}`;
  }

  render() {
    const { playable } = this.state;
    return (
      <div className="demo-block">
        <pre>
          <code>
            {this.props.literal}
          </code>
        </pre>
        {playable && <Button onClick={() => this.play()}>Play in Playground</Button>}
      </div>
    );
  }
}
