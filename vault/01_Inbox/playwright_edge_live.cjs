const { chromium } = require('playwright');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function run() {
  console.log("🚀 Launching visible Microsoft Edge window via Playwright...");
  const browser = await chromium.launch({
    channel: 'msedge',
    headless: false,
    slowMo: 1000 // Slows down operations by 1s so user can see every click live
  });

  const context = await browser.newContext();
  const page = await context.newPage();

  console.log("👉 1. Navigating to Login page (http://localhost:5173/#/login)...");
  await page.goto('http://localhost:5173/#/login');
  await sleep(2000);

  console.log("👉 2. Clicking HR Admin Quick Login button...");
  const hrAdminBtn = page.locator('button:has-text("HR Admin")');
  await hrAdminBtn.highlight();
  await hrAdminBtn.click();
  await sleep(2000);

  console.log("👉 3. Submitting Authenticate form...");
  const authBtn = page.locator('form button');
  await authBtn.highlight();
  await authBtn.click();
  await sleep(3000);

  console.log("👉 4. Navigating to Onboarding Checklist...");
  await page.goto('http://localhost:5173/#/checklist');
  await sleep(2000);

  console.log("👉 5. Testing Copy Slack Template button...");
  const copySlackBtn = page.locator('button:has-text("Copy Slack Template")');
  if (await copySlackBtn.count() > 0) {
    await copySlackBtn.highlight();
    await copySlackBtn.click();
  }
  await sleep(3000);

  console.log("👉 6. Navigating to Team Hybrid Scheduler...");
  await page.goto('http://localhost:5173/#/admin/scheduler');
  await sleep(2000);

  console.log("👉 7. Highlighting Save Changes and Discard controls...");
  const saveBtn = page.locator('button:has-text("Save Changes")');
  if (await saveBtn.count() > 0) {
    await saveBtn.highlight();
  }
  await sleep(4000);

  console.log("🎉 Visible Microsoft Edge walkthrough complete!");
  await browser.close();
}

run().catch(err => {
  console.error("Error running Playwright Edge live demo:", err);
  process.exit(1);
});
