/**
 * Babel configuration for Jest tests
 */
module.exports = {
  presets: [
    ['@babel/preset-env', { targets: { node: 'current' } }],
    ['@babel/preset-react', { runtime: 'automatic' }],
  ],
  // Optional chaining is supported natively in @babel/preset-env 7.8+
  // No plugin needed
};


