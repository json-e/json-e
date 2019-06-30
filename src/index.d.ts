// Type definitions for json-e
// Project: https://github.com/taskcluster/json-e
// Definitions by: siwalik <https://github.com/siwalikm>

declare module 'json-e' {
  function jsone(template: Record<any, any>, context: Record<any, any>): any;
  export = jsone;
}
