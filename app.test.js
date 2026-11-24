import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { runInNewContext } from 'node:vm';

test('static entry point loads the checked-in bundle and enables the test wallet', () => {
  const read = (name) => readFileSync(new URL(name, import.meta.url), 'utf8');
  const html = read('index.html');
  const [, script] = html.match(/<script src="([^"]+)" defer><\/script>/);
  const [, stylesheet] = html.match(/<link rel="stylesheet" href="([^"]+)">/);
  assert.ok(read(stylesheet).includes('.balance'));
  assert.match(html, /TEST ONLY/);
  const elements = new Map([...html.matchAll(/id="([^"]+)"/g)].map(([, id]) => [id, {
    classList: { toggle() {} },
    addEventListener() {},
    replaceChildren() {},
  }]));
  runInNewContext(read(script), {
    document: { getElementById: (id) => elements.get(id) },
    window: { addEventListener() {} },
    localStorage: { getItem: () => null },
    fetch: () => assert.fail('Startup must not contact a mint'),
    TextEncoder,
    TextDecoder,
    URL,
  });
  assert.equal(elements.get('balance').textContent, '0');
  assert.equal(elements.get('active-mint').textContent, 'https://testnut.cashu.space');
  assert.equal(elements.get('controls').disabled, false);
  assert.equal(elements.get('status').textContent, 'Ready. No real payments needed.');
});
