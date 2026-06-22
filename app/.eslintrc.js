// https://docs.expo.dev/guides/using-eslint/
module.exports = {
  extends: ['expo', 'prettier'],
  // React Native provides browser-style timers (setInterval, setTimeout, etc.)
  // and Node-style globals; enable both so they aren't flagged as undefined.
  env: {
    browser: true,
    node: true,
  },
  ignorePatterns: ['/dist/*', '/coverage/*', '/playwright-report/*', '/test-results/*'],
  overrides: [
    {
      // Test files run under Jest, which injects describe/it/expect/jest.
      files: ['**/*.test.js', '**/__tests__/**'],
      env: { jest: true },
    },
  ],
};
