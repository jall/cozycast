const { test, expect } = require('@playwright/test');

// Smoke tests for the deployed web app. The public ones need no credentials and
// always run; the signed-in flow runs only when E2E_EMAIL / E2E_PASSWORD are
// set (keeps secrets out of the repo and lets CI opt in).
//
// react-native-web renders Text as <div> and TouchableOpacity as a clickable
// <div>, so we locate things by their visible text. Matching is
// case-insensitive because some headings use CSS text-transform.

test.describe('public landing', () => {
  test('shows the pitch and explains a Cozy Cast', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('cozycast').first()).toBeVisible();
    await expect(page.getByText(/no public feed/i)).toBeVisible();
    await expect(page.getByText(/what is a cozy cast/i)).toBeVisible();
  });

  test('opens the manifesto and returns to the landing page', async ({ page }) => {
    await page.goto('/');
    await page.getByText(/read the manifesto/i).click();
    await expect(page.getByText(/the manifesto/i)).toBeVisible();
    await expect(page.getByText(/stay cozy/i)).toBeVisible();
    await page
      .getByText(/^back$/i)
      .first()
      .click();
    await expect(page.getByText(/what is a cozy cast/i)).toBeVisible();
  });

  test('“Get started” leads to the sign-in screen', async ({ page }) => {
    await page.goto('/');
    await page
      .getByText(/^get started$/i)
      .first()
      .click();
    await expect(page.getByText(/welcome back|create your account/i)).toBeVisible();
    await expect(page.getByPlaceholder(/you@example\.com/i)).toBeVisible();
  });
});

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function signIn(page) {
  await page.goto('/');
  await page
    .getByText(/^get started$/i)
    .first()
    .click();
  await page.getByPlaceholder(/you@example\.com/i).fill(email);
  await page.getByPlaceholder(/your password/i).fill(password);
  await page.getByText(/^log in$/i).click();
  // The authenticated shell shows the bottom tab bar (Feed / Record / Profile).
  await expect(page.getByText(/^record$/i).first()).toBeVisible({ timeout: 20000 });
}

test.describe('signed in', () => {
  test.skip(!email || !password, 'set E2E_EMAIL and E2E_PASSWORD to run the signed-in smoke test');

  test('signs in and lands on the feed', async ({ page }) => {
    await signIn(page);
    await expect(page.getByText(/^profile$/i).first()).toBeVisible();
  });

  // Exercises the in-browser recording path end to end (getUserMedia +
  // MediaRecorder via expo-av) using a fake audio device. We stop and cancel
  // rather than submit, so nothing is uploaded to the backend.
  test('can record a cast and reach the details step', async ({ page }) => {
    await signIn(page);

    await page
      .getByText(/^record$/i)
      .first()
      .click();
    await expect(page.getByText(/new cast/i)).toBeVisible();
    // The "soft game" conversation prompt is shown on the record screen.
    await expect(page.getByTestId('conversation-tip')).toBeVisible();

    // Start capturing.
    await page.getByTestId('record-start').click();
    await expect(page.getByText(/recording/i)).toBeVisible();

    // Stop, and confirm we advance to the details (summary/participants) form.
    await page.getByTestId('record-stop').click();
    await expect(page.getByText(/add some details/i)).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(/audio ready/i)).toBeVisible();

    // Submitting with no title surfaces a (non-blocking) toast — and writes
    // nothing to the backend.
    await page.getByText(/continue to sharing/i).click();
    await expect(page.getByText(/give your cast a title/i)).toBeVisible();

    // Back out without creating anything.
    await page.getByText(/^cancel$/i).click();
    await expect(page.getByText(/new cast/i)).toBeVisible();
  });
});
