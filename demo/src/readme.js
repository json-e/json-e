import { find } from 'lodash';
import sections from 'sections';

class Section {
  constructor(content) {
    Object.assign(this, content);
    this.children = [];
  }

  child(title) {
    return _.find(this.children, { title });
  }

  get anchor() {
    return this.title.replace(' ', '-').toLowerCase();
  }
};

/**
 * Parse the README into a tree of sections.  These are similar
 * to the sections returned by the `sections` package, but with
 * `children` properties organizing them into a tree.
 *
 * Each entity has a `child` method that will find a child by title.
 */
export default function readmeTree(readme) {
  let last = [new Section()];
	sections.parse(readme).sections.forEach((section) => {
    section = new Section(section);
    last[section.level-1].children.push(section);
    last = last.slice(0, section.level).concat([section]);
  });

  return last[0];
}
