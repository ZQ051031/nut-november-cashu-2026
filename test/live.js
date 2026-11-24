import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURL, launch } from './browser.js';

test('Testnut FakeWallet: mint 64 → send 16 → receive → reload', { timeout: 90_000 }, async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage({ viewport: { width: 1220, height: 1120 } });
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(process.env.WALLET_URL || fileURL);
  const status = page.getByRole('status');
  const readBalance = async () => Number(await page.locator('#balance').textContent());
  async function action(label, expected) {
    await page.getByRole('button', { name: label }).click();
    await page.waitForFunction(() => {
      const element = document.getElementById('status');
      return element.textContent && element.textContent !== 'Working with the test mint…';
    }, null, { timeout: 65_000 });
    assert.match(await status.textContent(), expected);
  }

  assert.equal(await readBalance(), 0);
  await action('Mint test sats', /^Minted 64 test sats/);
  assert.equal(await readBalance(), 64);
  await page.locator('#send-amount').fill('16');
  await action('Create token', /^Sent 16 test sats/);
  const afterSend = await readBalance();
  assert.ok(afterSend <= 48);
  const token = await page.locator('#outgoing-token').inputValue();
  assert.ok(token.startsWith('cashuB'));
  await page.locator('#receive-token').fill(token);
  await action('Redeem token', /^Received 16 test sats/);
  assert.equal(await readBalance(), afterSend + 16);
  await page.locator('#receive-token').fill(token);
  await action('Redeem token', /^Could not redeem the token/);
  assert.equal(await readBalance(), afterSend + 16);
  await page.reload();
  assert.equal(await readBalance(), afterSend + 16);
  assert.deepEqual(await page.locator('#history-list strong').allTextContents(), ['Received', 'Sent', 'Minted']);
  if (process.env.WALLET_SCREENSHOT) {
    await page.screenshot({ path: process.env.WALLET_SCREENSHOT, fullPage: true });
  }
  await page.getByRole('button', { name: 'Show sent token' }).click();
  assert.ok(await page.locator('#outgoing').isVisible());
  assert.deepEqual(errors, []);
});
