// Type definitions for json-e
// Project: https://github.com/taskcluster/json-e

declare module 'json-e' {
  function jsone(template: Record<any, any>, context: Record<any, any>): any;
  export = jsone;
}
