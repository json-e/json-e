import React from 'react';
import PropTypes from 'prop-types';
import { Link } from 'rebass';

const SidebarMenu = ({ section, title, tab }) => (
  <li>
    <Link href={`#${tab}/${section.anchor}`}>{title}</Link>
    {section.children.length > 0 && (
    <ul>
      {section.children.map(
        (child) => <SidebarMenu key={child.anchor} tab={tab} title={child.title} section={child} />,
      )}
    </ul>
    )}
  </li>
);

SidebarMenu.propTypes = {
  section: PropTypes.object,
  title: PropTypes.string.isRequired,
  tab: PropTypes.string.isRequired,
};

SidebarMenu.defaultProps = {
  section: { children: [], anchor: '' },
};

export default SidebarMenu;
