import { test, expect } from '@playwright/test';

test.describe('Meridian Onboarding Platform E2E Suite', () => {
  test('Page HTML contains correct title tag', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/Pathway|Onboarding|Meridian/i);
  });

  test('HybridScheduler is operable keyboard-only (no drag-and-drop)', async ({ page }) => {
    // Use "localhost" (not the "127.0.0.1" baseURL) for this test: the dev
    // API origin is configured as http://localhost:8090, and the session
    // cookie it sets doesn't stick when the page itself is served from
    // 127.0.0.1 -- browsers treat the two hosts as distinct even though they
    // resolve to the same loopback address.
    await page.goto('http://localhost:5173/');
    await page.getByRole('button', { name: /HR Admin/i }).click();
    await page.getByRole('button', { name: /Authenticate/i }).click();

    // Navigate via the real in-app nav (a bare page.goto to a hash-only URL
    // doesn't reliably re-trigger the SPA's router once already loaded).
    await page.getByRole('button', { name: /Directory & Admin/i }).click();
    await page.getByRole('link', { name: /Team Scheduler/i }).click();

    // Pick whichever employee currently sits at the top of the Unassigned
    // pool -- avoids hardcoding a name/seed state that a prior manual test
    // run may have already moved.
    const pool = page.getByRole('group', { name: /^Unassigned pool,/ });
    await expect(pool).toBeVisible();
    const card = pool.getByRole('button').first();
    const cardName = (await card.getAttribute('aria-label'))?.split(',')[0];
    expect(cardName).toBeTruthy();
    const cardNamePattern = cardName!.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const friday = page.getByRole('group', { name: /^Friday,/ });
    const fridayLabelBefore = await friday.getAttribute('aria-label');
    const fridayCountBefore = Number(fridayLabelBefore?.match(/Friday, (\d+) of/)?.[1]);

    // Pick up the card via keyboard focus + Enter (no drag events at all).
    await card.focus();
    await page.keyboard.press('Enter');
    await expect(card).toHaveAttribute('aria-pressed', 'true');

    // Move focus to the Friday column and drop it there via Enter.
    await friday.focus();
    await page.keyboard.press('Enter');

    // The card re-renders inside Friday's column with its schedule reflected
    // in both the DOM (occupancy count, aria-label) and the group's contents.
    await expect(page.getByRole('group', { name: new RegExp(`^Friday, ${fridayCountBefore + 1} of`) })).toBeVisible();
    await expect(
      friday.getByRole('button', { name: new RegExp(`^${cardNamePattern}.*scheduled on Friday`) })
    ).toBeVisible();

    // Persist via keyboard and confirm the schedule save actually talks to
    // the API. saveScheduler POSTs once per employee (a pre-existing,
    // separate perf issue -- not something this a11y pass touches), and the
    // dev backend's rate limiter (60 req/60s) means requests can 429 under
    // repeated test runs within the same window; asserting on response
    // status would be flaky against that shared, external quota, so this
    // just confirms the client actually issued a /scheduler POST (proving
    // the keyboard-driven change reached the API) and that the app's own
    // "saved" signal (Save button disabling) fires.
    let sawSchedulerPost = false;
    page.on('request', (req) => {
      if (req.url().includes('/scheduler') && req.method() === 'POST') {
        sawSchedulerPost = true;
      }
    });

    const saveButton = page.getByRole('button', { name: /Save Changes/i });
    await saveButton.focus();
    await page.keyboard.press('Enter');

    await expect(saveButton).toBeDisabled({ timeout: 30000 });
    expect(sawSchedulerPost).toBeTruthy();
  });
});
