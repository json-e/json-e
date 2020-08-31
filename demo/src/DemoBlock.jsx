import React from 'react';
import PropTypes from 'prop-types';
import { Button } from 'rebass';
import dedent from 'dedent-js';

// try to sensibly break up the example block, preserving YAML formatting
const EXAMPLE_RE = /template:([^]*)\ncontext:([^]*)\nresult:/m;

const play = (template, context) => {
  window.location.hash = `#Playground/${encodeURIComponent(dedent(context).trim())}&${encodeURIComponent(dedent(template).trim())}`;
};

/**
 * This implements a renderer for the 'code' type in ReactMarkdown.
 */
const DemoBlock = ({ value }) => {
  const match = EXAMPLE_RE.exec(value);

  return (
    <div className="demo-block">
      <pre>
        <code>
          {value}
        </code>
      </pre>
      {match && <Button onClick={() => play(match[1], match[2])}>Play in Playground</Button>}
    </div>
  );
};

DemoBlock.propTypes = {
  value: PropTypes.string.isRequired,
};

export default DemoBlock;
