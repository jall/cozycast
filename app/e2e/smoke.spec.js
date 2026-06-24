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

  test('“Forgot password?” reveals the reset-request view', async ({ page }) => {
    await page.goto('/');
    await page
      .getByText(/^get started$/i)
      .first()
      .click();
    await page.getByText(/forgot password/i).click();
    await expect(page.getByText(/reset your password/i)).toBeVisible();
    await expect(page.getByText(/send reset link/i)).toBeVisible();
  });
});

const email = process.env.E2E_EMAIL;
const password = process.env.E2E_PASSWORD;

async function signIn(page, userEmail = email, userPassword = password) {
  await page.goto('/');
  await page
    .getByText(/^get started$/i)
    .first()
    .click();
  await page.getByPlaceholder(/you@example\.com/i).fill(userEmail);
  await page.getByPlaceholder(/your password/i).fill(userPassword);

  // The authenticated shell shows the bottom tab bar (Feed / Record / Profile).
  // The submit can hit a transient network blip ("Failed to fetch" through a
  // proxy) while the auth endpoint itself is healthy, so re-submit from the
  // still-present login screen until the shell appears rather than failing once.
  const recordTab = page.getByText(/^record$/i).first();
  const loginButton = page.getByText(/^log in$/i).first();
  for (let attempt = 1; attempt <= 3; attempt++) {
    await loginButton.click();
    try {
      await expect(recordTab).toBeVisible({ timeout: 15000 });
      return;
    } catch (err) {
      if (await recordTab.isVisible()) return;
      // Out of attempts, or we've left the login screen (a real failure).
      if (attempt === 3 || !(await loginButton.isVisible())) throw err;
    }
  }
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

  // Full round-trip for the shareable cast detail page (#11): record a real
  // cast, open it by tapping the feed card (client-side nav to /cast/:id), then
  // delete it. The test seeds and cleans up its own data — nothing permanent is
  // written — so it doesn't depend on pre-existing casts or leave any behind.
  test('records a cast, opens its detail page, and deletes it', async ({ page }) => {
    await signIn(page);

    // A unique title so we can find exactly this cast and assert it's gone.
    const title = `E2E detail ${Date.now()}`;

    await page
      .getByText(/^record$/i)
      .first()
      .click();
    await page.getByTestId('record-start').click();
    await expect(page.getByText(/recording/i)).toBeVisible();
    await page.getByTestId('record-stop').click();
    await expect(page.getByText(/add some details/i)).toBeVisible({ timeout: 15000 });

    // Title + create (uploads the audio and inserts the cast row).
    await page.getByPlaceholder(/what's this about/i).fill(title);
    await page.getByText(/continue to sharing/i).click();

    // Sharing step → skip (no recipients) → done.
    await expect(page.getByText(/share with/i)).toBeVisible({ timeout: 20000 });
    await page.getByText(/skip for now/i).click();
    await expect(page.getByText(/all set/i)).toBeVisible({ timeout: 20000 });

    // Back to the feed (refetches on focus); the new cast is on top. Open it.
    await page
      .getByText(/^feed$/i)
      .first()
      .click();
    await page.getByText(title).click();

    // We're on the shareable detail route, showing this cast.
    await expect(page).toHaveURL(/\/cast\//);
    await expect(page.getByText(title)).toBeVisible();
    await expect(page.getByText(/delete cast/i)).toBeVisible();

    // Clean up: delete it (confirm dialog → accept) and confirm it's gone from
    // the feed we land back on.
    page.on('dialog', (dialog) => dialog.accept());
    await page.getByText(/delete cast/i).click();
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 20000 });
  });

  // Deep-linking to a cast you can't access (RLS) shows a friendly state rather
  // than crashing — exercises the /cast/:id route + getCast's null path.
  test('a cast you cannot access shows a friendly not-available page', async ({ page }) => {
    await signIn(page);
    await page.goto('/cast/00000000-0000-0000-0000-000000000000');
    await expect(page.getByText(/this cast isn.t available/i)).toBeVisible({ timeout: 20000 });
  });
});

// Deterministic signed-in coverage that leans on the seeded fixtures (Alice/Ben/
// Cleo + their shared casts). Requires the local stack seeded via
// `npm run dev:seed` and the app pointed at it; opt in with E2E_FIXTURES=1 (and
// E2E_BASE_URL pointing at the local web server). These creds are local-only.
const FIXTURES = process.env.E2E_FIXTURES === '1';
const ALICE = { email: 'alice@cozycast.test', password: 'cozytest1234' };

test.describe('signed in (local fixtures)', () => {
  test.skip(
    !FIXTURES,
    'seed the local stack (npm run dev:seed) and set E2E_FIXTURES=1 to run fixture tests',
  );

  test('Alice sees her seeded casts and opens her own with its sharing details', async ({
    page,
  }) => {
    await signIn(page, ALICE.email, ALICE.password);

    // Both seeded casts appear in her feed.
    await expect(page.getByText(/late-night kitchen talk/i)).toBeVisible();
    await expect(page.getByText(/the walk we always mean to take/i)).toBeVisible();

    // Open her own cast → detail page shows participants and the recipient count.
    await page.getByText(/late-night kitchen talk/i).click();
    await expect(page).toHaveURL(/\/cast\//);
    await expect(page.getByText(/in this cast/i)).toBeVisible();
    await expect(page.getByText(/shared with 2 people/i)).toBeVisible();
    // It's hers, so she can delete it.
    await expect(page.getByText(/delete cast/i)).toBeVisible();
  });

  test('a cast shared with Alice shows who shared it (and no delete)', async ({ page }) => {
    await signIn(page, ALICE.email, ALICE.password);

    await page.getByText(/the walk we always mean to take/i).click();
    await expect(page).toHaveURL(/\/cast\//);
    await expect(page.getByText(/shared by/i)).toBeVisible();
    // Not hers to manage — no delete affordance.
    await expect(page.getByText(/delete cast/i)).toHaveCount(0);
  });
});
