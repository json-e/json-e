const fs = require("fs");
const path = require("path");

const yaml = require("js-yaml");
const assume = require("assume");
const assert = require("assert");
const tk = require("timekeeper");
const jsone = require("../src");

const readme = fs.readFileSync(path.join(__dirname, "../README.md"), {
  encoding: "utf8",
});
const TEST_DATE = new Date("2017-01-19T16:27:20.974Z");

suite("docs code examples", () => {
  const yamlCodeBlocksRegex = /(```yaml)([a-z]*\n[\s\S]*?\n)(```)/gm;
  let matches;
  const foundSpecs = [];
  while ((matches = yamlCodeBlocksRegex.exec(readme)) !== null) {
    // This is necessary to avoid infinite loops with zero-width matches
    if (matches.index === yamlCodeBlocksRegex.lastIndex) {
      yamlCodeBlocksRegex.lastIndex++;
    }

    const [, , codeblock] = matches;
    foundSpecs.push(codeblock);
  }

  const specs = yaml.loadAll(foundSpecs.join("---\n"));

  before(() => tk.freeze(TEST_DATE));
  after(() => tk.reset());

  specs
    .filter((spec) => spec && spec.template)
    .forEach((spec, i) => {
      test(JSON.stringify(spec.template), () => {
        let result;
        try {
          result = jsone(spec.template, spec.context);
        } catch (err) {
          if (!spec.error) {
            throw err;
          }
          if (spec.error === true) {
            // no specific expectation
            return;
          }
          assume(err.toString()).eql(spec.error);
          return;
        }
        assert(!spec.error, "Expected an error");
        assume(result).eql(spec.result);
      });
    });
});
