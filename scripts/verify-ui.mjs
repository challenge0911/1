// Run inside the Codex Cloud task, after the dev server is listening.
//   APP_URL=http://127.0.0.1:3000 CHECK_SELECTOR="[data-testid=app]" node scripts/verify-ui.mjs
//
// This is a headless browser living in the cloud container. Its network egress
// is the cloud environment's egress, never the developer's machine.
import fs from 'node:fs/promises';
import path from 'node:path';

let chromium;
try {
  ({ chromium } = await import('@playwright/test'));
} catch {
  ({ chromium } = await import('playwright'));
}

const appUrl = process.env.APP_URL || 'http://127.0.0.1:3000';
const checkSelector = process.env.CHECK_SELECTOR || '';
const shotPath = process.env.SCREENSHOT_PATH || 'artifacts/ui-check.png';
const probeEgress = process.env.PROBE_EGRESS !== '0';

const report = {
  appUrl,
  status: null,
  title: null,
  consoleErrors: [],
  pageErrors: [],
  screenshot: null,
  egressIp: null,
  ok: false,
};

const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });

try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  page.on('console', (msg) => {
    if (msg.type() === 'error') report.consoleErrors.push(msg.text());
  });
  page.on('pageerror', (err) => report.pageErrors.push(String(err)));

  const response = await page.goto(appUrl, { waitUntil: 'networkidle', timeout: 30000 });
  report.status = response ? response.status() : null;
  report.title = await page.title();

  if (checkSelector) {
    await page.locator(checkSelector).first().waitFor({ state: 'visible', timeout: 10000 });
  }

  await fs.mkdir(path.dirname(shotPath), { recursive: true });
  await page.screenshot({ path: shotPath, fullPage: true });
  report.screenshot = shotPath;

  if (probeEgress) {
    const ipPage = await browser.newPage();
    try {
      await ipPage.goto('https://api.ipify.org', { waitUntil: 'domcontentloaded', timeout: 15000 });
      report.egressIp = (await ipPage.locator('body').innerText()).trim();
    } catch (err) {
      report.egressIp = `unavailable: ${err.message}`;
    }
    await ipPage.close();
  }

  report.ok =
    report.status !== null &&
    report.status >= 200 &&
    report.status < 400 &&
    report.pageErrors.length === 0;
} finally {
  await browser.close();
}

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
