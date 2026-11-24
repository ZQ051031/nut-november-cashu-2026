import assert from 'node:assert/strict';
import test from 'node:test';
import { balance, createWallet, parseAmount, STORAGE_KEY } from '../src/wallet.js';

function fixture() {
  const data = new Map();
  const storage = { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) };
  let queue = Promise.resolve();
  const lock = (_, operation) => {
    const next = queue.then(operation);
    queue = next.catch(() => {});
    return next;
  };
  const adapter = {
    async mint(amount) { return [{ amount: String(amount), secret: 'minted-fixture' }]; },
    async send(amount, proofs) { return { keep: [{ amount: balance(proofs) - amount - 1 }], token: 'cashuBfixture' }; },
    async receive(token) {
      assert.equal(token, 'cashuBfixture');
      return [{ amount: 16, secret: 'received-fixture' }];
    },
  };
  const open = () => createWallet({ storage, lock, adapter, now: () => 12345 });
  return { data, storage, adapter, open };
}

test('amounts must be whole test sats within the supported range', () => {
  assert.equal(parseAmount(' 64 '), 64);
  assert.equal(parseAmount('500000'), 500_000);
  for (const invalid of ['', '0', '-1', '0.5', '1e2', '500001', 'Infinity']) {
    assert.throws(() => parseAmount(invalid), /whole amount/);
  }
});

test('mint, fee-aware send and receive persist balance, token and newest-first activity', async () => {
  const { open } = fixture();
  const wallet = open();
  assert.deepEqual(wallet.read(), { proofs: [], history: [] });
  await wallet.mint('64');
  const sent = await wallet.send('16');
  assert.equal(balance(open().read().proofs), 47);
  await wallet.receive(`  ${sent.token}\n`);
  const restored = open().read();
  assert.equal(balance(restored.proofs), 63);
  assert.deepEqual(restored.history, [
    { kind: 'receive', amount: 16, at: 12345 },
    { kind: 'send', amount: 16, debit: 17, token: 'cashuBfixture', at: 12345 },
    { kind: 'mint', amount: 64, at: 12345 },
  ]);
});

test('invalid actions and failed mint requests do not change proofs or activity', async () => {
  const { adapter, open } = fixture();
  const wallet = open();
  await wallet.mint('8');
  const before = wallet.read();
  await assert.rejects(wallet.send('9'), /Not enough test sats/);
  await assert.rejects(wallet.receive('not a token'), /valid Cashu token/);
  await assert.rejects(wallet.receive('cashuA' + 'A'.repeat(65_536)), /valid Cashu token/);
  adapter.receive = async () => { throw new Error('already spent'); };
  await assert.rejects(wallet.receive('cashuAfixture'), /already spent/);
  assert.deepEqual(wallet.read(), before);
});

test('serialized operations read the newest balance across wallet instances', async () => {
  const { open } = fixture();
  const first = open();
  const second = open();
  await Promise.all([first.mint('10'), second.mint('22')]);
  assert.equal(balance(first.read().proofs), 32);
  assert.equal(second.read().history.length, 2);
});

test('unwritable or unreadable storage prevents requests to the mint', async () => {
  const { storage, data, adapter, open } = fixture();
  adapter.mint = async () => assert.fail('must not request ecash without writable storage');
  data.set(STORAGE_KEY, 'broken');
  await assert.rejects(open().mint('8'), SyntaxError);
  assert.equal(data.get(STORAGE_KEY), 'broken');
  data.delete(STORAGE_KEY);
  storage.setItem = () => { throw new Error('storage denied'); };
  await assert.rejects(open().mint('8'), /storage denied/);
});
