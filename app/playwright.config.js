const { defineConfig, devices } = require('@playwright/test');

// End-to-end / smoke tests run against a deployed web build by default (web is
// the primary target). Point them elsewhere with E2E_BASE_URL — e.g. a Netlify
// deploy preview, or a local `npx expo start --web` server.
const baseURL = process.env.E2E_BASE_URL || 'https://cozycast.jall.me';

// Locally, run `npx playwright install chromium` once and leave this unset.
// In CI / sandboxes where Chromium is pre-provisioned, set
// PLAYWRIGHT_CHROMIUM_PATH to the browser binary so no download is needed.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

module.exports = defineConfig({
  testDir: './e2e',
  // Tests within a file run serially (separate files still parallelize). The
  // signed-in/fixture tests all share one backend account and a single local
  // Supabase stack, so running them concurrently caused transient write
  // failures (e.g. two record+share flows at once); serial keeps them honest.
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  // One retry by default absorbs transient network blips (e.g. HTTP/3 resets
  // through a proxy); CI gets two.
  retries: process.env.CI ? 2 : 1,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    ignoreHTTPSErrors: true,
    trace: 'on-first-retry',
    // The web bundle is large; give first paint room to breathe.
    navigationTimeout: 30000,
    actionTimeout: 15000,
    launchOptions: {
      // QUIC/HTTP3 and ECH (discovered via HTTPS DNS records) can be flaky
      // behind intercepting proxies; disabling them forces plain HTTPS and
      // keeps runs deterministic. Harmless in normal environments.
      args: [
        '--disable-quic',
        '--disable-features=EncryptedClientHello,UseDnsHttpsSvcb,UseDnsHttpsSvcbAlpn',
        // Let the in-browser recorder capture a fake audio stream headlessly
        // (no real mic, and the permission prompt is auto-accepted).
        '--use-fake-device-for-media-stream',
        '--use-fake-ui-for-media-stream',
      ],
      ...(executablePath ? { executablePath } : {}),
    },
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
