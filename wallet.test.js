import assert from 'node:assert/strict';
import test from 'node:test';
import { Amount, getEncodedToken, getTokenMetadata, MintOperationError } from '@cashu/cashu-ts';
import { createWalletStore, TEST_MINT } from './wallet.js';

const OTHER_MINT = 'https://other.example/mint';
const proof = (amount, secret) => ({
  amount: Amount.from(amount),
  id: '0000000000000001',
  C: '0279be667ef9dcbbac55a06295ce870b07029bfcdb2dce28d959f2815b16f81798',
  secret,
});

function harness() {
  const data = new Map();
  const redeemed = new Set();
  const connected = [];
  const quote = { quote: 'mock-id', state: 'PAID' };
  const mint = {
    async createMintQuoteBolt11(amount) {
      assert.equal(amount, 16);
      return quote;
    },
    async checkMintQuoteBolt11(id) {
      assert.equal(id, quote.quote);
      return { ...quote, state: 'PAID' };
    },
    async mintProofsBolt11(amount, response) {
      assert.equal(response.state, 'PAID');
      return [proof(amount, 'minted')];
    },
    sendOffline() {
      return { send: [] };
    },
    async prepareSwapToSend(amount, proofs) {
      assert.equal(amount, 6);
      assert.equal(proofs[0].secret, 'minted');
      assert.equal(Number(proofs[0].amount), 16);
      return { sendOutputs: [{ blindedMessage: { id: proof(6, 'outgoing').id } }] };
    },
    getFeesForProofs(proofs) {
      assert.equal(proofs[0].id, proof(6, 'outgoing').id);
      return Amount.from(1);
    },
    async completeSwap() {
      return { keep: [proof(9, 'change')], send: [proof(6, 'outgoing')] };
    },
    async receive(token) {
      if (redeemed.has(token)) throw new Error('Token already spent');
      redeemed.add(token);
      return [proof(5, 'redeemed')];
    },
  };
  const open = () => createWalletStore({
    storage: { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) },
    connect: async (url) => {
      connected.push(url);
      return mint;
    },
    inspectToken: getTokenMetadata,
    encodeToken: getEncodedToken,
    now: () => 10000,
  });
  return { open, mint, quote, connected };
}

test('creates, sends, receives, records fees and persists proofs and history', async () => {
  const { open } = harness();
  const first = open();
  assert.equal(first.snapshot().balance, 0n);
  assert.equal(await first.create('16'), true);
  const second = open();
  assert.equal(second.snapshot().balance, 16n);
  const token = await second.send('6');
  assert.equal(getTokenMetadata(token).amount.toNumber(), 6);
  assert.equal(second.snapshot().balance, 9n);
  await second.receive(token);
  await assert.rejects(second.receive(token), /already spent/);
  const { balance, history } = open().snapshot();
  assert.equal(balance, 14n);
  assert.deepEqual(history, [
    { kind: 'Received', amount: '5', at: 10000 },
    { kind: 'Sent', amount: '7', face: '6', at: 10000, token },
    { kind: 'Created', amount: '16', at: 10000 },
  ]);
});

test('resumes an unpaid quote from local storage without creating a second one', async () => {
  const { open, quote } = harness();
  quote.state = 'UNPAID';
  const first = open();
  assert.equal(await first.create('16'), false);
  assert.deepEqual(first.snapshot().quote, { id: 'mock-id', amount: 16 });
  const second = open();
  assert.equal(await second.create(''), true);
  assert.equal(second.snapshot().quote, null);
  assert.equal(second.snapshot().balance, 16n);
});

test('clears a missing quote but keeps it when the quote check has a transient error', async () => {
  const { open, mint, quote } = harness();
  quote.state = 'UNPAID';
  const store = open();
  assert.equal(await store.create('16'), false);
  mint.checkMintQuoteBolt11 = async () => { throw new Error('Network unavailable'); };
  await assert.rejects(store.create(''), /Network unavailable/);
  assert.equal(open().snapshot().quote.id, 'mock-id');
  mint.checkMintQuoteBolt11 = async () => { throw new MintOperationError(50000, 'Unknown quote'); };
  await assert.rejects(store.create(''), /Create a new quote/);
  assert.equal(open().snapshot().quote, null);
  quote.state = 'PAID';
  assert.equal(await store.create('16'), true);
});

test('rejects sends at or below the redemption fee before changing any proofs', async () => {
  const { open, mint } = harness();
  const store = open();
  await store.create('16');
  const before = store.snapshot();
  mint.getFeesForProofs = () => Amount.from(16);
  mint.sendOffline = (amount) => ({ keep: [], send: [proof(amount, 'offline')] });
  mint.prepareSwapToSend = () => assert.fail('Exact match should not need a swap');
  await assert.rejects(store.send('16'), /Send more than 16 sats/);
  assert.deepEqual(store.snapshot(), before);

  mint.sendOffline = () => ({ send: [] });
  mint.prepareSwapToSend = async () => ({ sendOutputs: [{ blindedMessage: { id: 'mock-output' } }] });
  mint.getFeesForProofs = (outputs) => {
    assert.deepEqual(outputs, [{ id: 'mock-output' }]);
    return Amount.from(7);
  };
  mint.completeSwap = () => assert.fail('A worthless token should not be swapped');
  await assert.rejects(store.send('6'), /Send more than 7 sats/);
  assert.deepEqual(store.snapshot(), before);
});

test('keeps balances separate and does not contact token-supplied mints', async () => {
  const { open, connected } = harness();
  const store = open();
  await store.create('16');
  assert.throws(() => store.switchMint('http://example.com'), /HTTPS/);
  store.switchMint(OTHER_MINT + '/');
  assert.equal(store.snapshot().mint, OTHER_MINT);
  assert.equal(store.snapshot().balance, 0n);
  assert.deepEqual(store.snapshot().history, []);
  await assert.rejects(store.create('16'), /only on Testnut/);
  const token = getEncodedToken({ mint: TEST_MINT, unit: 'sat', proofs: [proof(2, 'wrong-mint')] });
  await assert.rejects(store.receive(token), /selected mint/);
  assert.deepEqual(connected, [TEST_MINT]);
  store.switchMint(TEST_MINT);
  assert.equal(store.snapshot().balance, 16n);
});

test('rejects mint URLs cashu-ts would not connect to without saving them', () => {
  const { open } = harness();
  const store = open();
  assert.throws(() => store.switchMint(OTHER_MINT + '?'), /query/);
  assert.throws(() => store.switchMint(OTHER_MINT + '#'), /fragment/);
  assert.throws(() => store.switchMint(OTHER_MINT + '/a%20b'), /percent-encoded/);
  assert.equal(open().snapshot().mint, TEST_MINT);
});

test('rejects invalid amounts, overspending, and non-sat tokens before connecting', async () => {
  const { open, connected } = harness();
  const store = open();
  await assert.rejects(store.create('1.5'), /positive whole number/);
  await assert.rejects(store.create('500001'), /500,000/);
  await assert.rejects(store.send('1'), /Not enough/);
  const token = getEncodedToken({ mint: TEST_MINT, unit: 'usd', proofs: [proof(2, 'wrong-unit')] });
  await assert.rejects(store.receive(token), /Only sat tokens/);
  assert.deepEqual(connected, []);
  assert.deepEqual(store.snapshot().history, []);
});
