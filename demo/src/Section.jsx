import React from 'react';
import PropTypes from 'prop-types';
import ReactMarkdown from 'react-markdown';
import DemoBlock from './DemoBlock';

const Section = ({ showDemo, section }) => {
  const renderers = showDemo ? { code: DemoBlock } : {};

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
};

Section.propTypes = {
  section: PropTypes.object.isRequired,
  showDemo: PropTypes.bool.isRequired,
};

export default Section;
