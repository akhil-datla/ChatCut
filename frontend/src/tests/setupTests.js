/**
 * Jest setup file
 * Runs before each test file
 */
import '@testing-library/jest-dom';

// Mock UXP modules that aren't available in test environment
jest.mock('uxp', () => ({
  entrypoints: {
    setup: jest.fn(),
  },
}), { virtual: true });

jest.mock('premierepro', () => ({
  Project: {
    getActiveProject: jest.fn(),
  },
  Constants: {
    TrackItemType: { CLIP: 1 },
  },
  TickTime: {
    createWithSeconds: jest.fn(),
  },
}), { virtual: true });

// Suppress console errors during tests (optional)
// const originalError = console.error;
// beforeAll(() => {
//   console.error = (...args) => {
//     if (args[0]?.includes?.('Warning:')) return;
//     originalError.call(console, ...args);
//   };
// });
// afterAll(() => {
//   console.error = originalError;
// });


