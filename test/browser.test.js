import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURL, launch } from './browser.js';

test('the committed wallet loads from disk and rejects other mints without a network request', async (t) => {
  const browser = await launch();
  t.after(() => browser.close());
  const page = await browser.newPage();
  const errors = [];
  const requests = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.route('https://**/*', async (route) => {
    requests.push(route.request().url());
    await route.abort();
  });
  await page.goto(fileURL);
  assert.equal(await page.title(), 'Testnut Pocket — Cashu test wallet');
  assert.match(await page.locator('.warning').textContent(), /Do not use real funds/);
  assert.equal(await page.locator('#balance').textContent(), '0');
  assert.ok(await page.getByRole('button', { name: 'Mint test sats' }).isEnabled());
  const foreign = Buffer.from(JSON.stringify({
    token: [{ mint: 'https://example.invalid', proofs: [{ amount: 1, id: '009a1f293253e41e', secret: 'fixture', C: 'fixture' }] }],
    unit: 'sat',
  })).toString('base64url');
  await page.locator('#receive-token').fill(`cashuA${foreign}`);
  await page.getByRole('button', { name: 'Redeem token' }).click();
  assert.match(await page.getByRole('status').textContent(), /Only sat tokens from Testnut/);
  assert.equal(await page.locator('#balance').textContent(), '0');
  assert.deepEqual(requests, []);
  assert.deepEqual(errors, []);
});
