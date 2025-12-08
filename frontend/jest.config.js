/**
 * Jest configuration for ChatCut frontend tests
 */
module.exports = {
  testEnvironment: 'jsdom',
  
  // Setup file for jest-dom matchers
  setupFilesAfterEnv: ['<rootDir>/src/tests/setupTests.js'],
  
  // Handle module paths
  moduleNameMapper: {
    // Handle CSS imports (with CSS Modules)
    '\\.css$': 'identity-obj-proxy',
    // Handle image imports
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/src/tests/__mocks__/fileMock.js',
  },
  
  // Transform JS/JSX files with Babel
  transform: {
    '^.+\\.(js|jsx)$': 'babel-jest',
  },
  
  // Test file patterns
  testMatch: [
    '<rootDir>/src/**/*.test.{js,jsx}',
    '<rootDir>/src/**/*.spec.{js,jsx}',
  ],
  
  // Ignore these directories
  testPathIgnorePatterns: [
    '/node_modules/',
    '/dist/',
    '/plugin/',
  ],
  
  // Module directories
  moduleDirectories: ['node_modules', 'src'],
  
  // Coverage settings
  collectCoverageFrom: [
    'src/components/**/*.{js,jsx}',
    '!src/components/**/index.js',
  ],
};


