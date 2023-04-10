/**
 * Surround the given element with
 * <div class="json-e-${label}">
 *   <h4>${Label}</h4>
 *   ..
 * </div>
 */
const label_div = (label, inner) => {
  const div = document.createElement('div');
  div.classList.add(`json-e-${label}`);
  const title_node = document.createElement('h4');
  title_node.textContent = label[0].toUpperCase() + label.slice(1);
  div.appendChild(title_node);
  div.appendChild(inner);

  return div;
}

/**
 * Generate a highlighted YAML block and return it and a function
 * to update its value.
 */
const yaml_block = (text_content) => {
  const code_node = document.createElement('code');
  code_node.textContent = text_content;
  code_node.classList.add('language-yaml');
  // mdbook sets up hljs for us
  hljs.highlightBlock(code_node);

  const pre_node = document.createElement('pre');
  pre_node.appendChild(code_node);

  return [
    pre_node,
    v => code_node.textContent = v,
  ];
};

/**
 * Generate a textarea containing the given content.
 */
const textarea_block = (text_content) => {
  const textarea_node = document.createElement('textarea');
  textarea_node.value = text_content;

  return textarea_node;
};

/**
 * Create a block for this example
 */
const example_block = (template, context, result) => {
  const div_node = document.createElement('div');
  div_node.classList.add(`json-e-triple`);
  div_node.appendChild(label_div('template', yaml_block(template)[0]));
  div_node.appendChild(label_div('context', yaml_block(context)[0]));
  div_node.appendChild(label_div('result', yaml_block(result)[0]));
  return div_node;
};

/**
 * Create a playground block
 */
const playground_block = (template, context) => {
  const div_node = document.createElement('div');
  div_node.classList.add(`json-e-triple`);

  const template_textarea = textarea_block(template);
  const context_textarea = textarea_block(context);
  const [result_block, set_result] = yaml_block('')

  const update = () => {
    let template = template_textarea.value;
    let context = context_textarea.value;

    // first, set the textareas' sizes appropriately
    template_textarea.style.height = `auto`;
    template_textarea.style.height = `${template_textarea.scrollHeight}px`;
    context_textarea.style.height = `auto`;
    context_textarea.style.height = `${context_textarea.scrollHeight}px`;

    // then render the template/context
    let error;
    if (!error) {
      try {
        template = jsyaml.load(template);
      } catch (e) {
        error = "Invalid YAML in template";
      }
    }

    if (!error) {
      try {
        context = jsyaml.load(context);
      } catch (e) {
        error = "Invalid YAML in context";
      }
    }

    let result;
    if (!error) {
      try {
        result = jsyaml.dump(jsone(template, context));
      } catch (e) {
        error = `${e}`;
      }
    }

    if (error) {
      result = `# Error:\n${error.replace(/^/m, '# ')}`;
    }
    set_result(result);
  };
  template_textarea.addEventListener('input', update);
  context_textarea.addEventListener('input', update);

  // prevent arrow keys from bubbling up to mdBook's page-flipping handler
  template_textarea.addEventListener('keydown', e => e.stopPropagation());
  context_textarea.addEventListener('keydown', e => e.stopPropagation());

  // schedule an update to occur once this node is in the DOM
  window.setTimeout(update, 0);

  div_node.appendChild(label_div('template', template_textarea));
  div_node.appendChild(label_div('context', context_textarea));
  div_node.appendChild(label_div('result', result_block));
  return div_node;
};

/**
 * Remove the given key from the given YAML.  This handles both the
 * one-line `key: <value>` and the multi-line form.
 **/
const remove_yaml_key = (key, yaml) => {
  const nl = yaml.indexOf('\n');
  if (nl != -1) {
    const match = RegExp(`(^${key}: *)([\\s\\S]*)`).exec(yaml);
    const rm_key = match[1];
    const value = match[2];
    const lines = value.split('\n');

    let dedented = [];
    if (lines[0] == "" && lines.length > 0) {
      // Value started on a new line after the key, so align to the next line.
      const first_line_indent = /^ */.exec(lines[1])[0].length;
      for (let i = 1; i < lines.length; i++) {
        dedented.push(lines[i].slice(first_line_indent));
      }
    } else {
      // Value starts on this line and may continue on the next line
      dedented = lines
    }

    return dedented.join('\n');
  } else {
    return new RegExp(`^${key}: *(.*)`).exec(yaml)[1];
  }
};

/**
 * Split the given YAML into context, template, and result
 */
const split_yaml = text => {
  try {
    // split the block textually, to keep comments as written
    const context_idx = /^context:/m.exec(text).index;
    const result_idx = /^result:/m.exec(text).index;

    const template = remove_yaml_key('template', text.slice(0, context_idx).trimEnd());
    const context = remove_yaml_key('context', text.slice(context_idx, result_idx).trimEnd());
    const result = remove_yaml_key('result', text.slice(result_idx).trimEnd());

    return {template, context, result};
  } catch (e) {
    console.error(`Invalid json-e block:\n${text}`);
    throw e;
  }
};

/**
 * Convert all json-e code blocks that contain valid YAML into example blocks
 */
Array.from(document.querySelectorAll("code.json-e")).forEach(function (block) {
  const {template, context, result} = split_yaml(block.textContent);

  const pre_block = block.parentElement;
  pre_block.parentElement.replaceChild(example_block(template, context, result), pre_block);
});

/**
 * Replace the playground element with an actual playground
 */
Array.from(document.querySelectorAll("code.jsone-playground")).forEach(function (block) {
  const {template, context} = split_yaml(block.textContent);

  const pre_block = block.parentElement;
  pre_block.parentElement.replaceChild(playground_block(template, context), pre_block);
});
