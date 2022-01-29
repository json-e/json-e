import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';

export default {
  input: 'src/index.js',
  output: {
    dir: 'dist',
    format: 'umd',
    name: 'jsone',
  },
  plugins: [
    // handle require(..)
    commonjs(),
    // include the (minimal) node deps of this library
    resolve(),
  ]
};
