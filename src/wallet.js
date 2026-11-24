export const STORAGE_KEY = 'testnut-pocket.v1';
export const MAX_AMOUNT = 500_000;
export const MAX_TOKEN_LENGTH = 65_536;

export class WalletNotice extends Error {}

export function balance(proofs) {
  return proofs.reduce((total, proof) => total + Number(proof.amount), 0);
}

export function parseAmount(value) {
  const amount = Number(value);
  if (!/^\d+$/.test(String(value).trim()) || !Number.isSafeInteger(amount) || amount < 1 || amount > MAX_AMOUNT) {
    throw new WalletNotice('Enter a whole amount from 1 to 500,000 test sats.');
  }
  return amount;
}

export function createWallet({ storage, adapter, lock, now = Date.now }) {
  function read() {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { proofs: [], history: [] };
    const data = JSON.parse(raw);
    if (!Array.isArray(data?.proofs) || !Array.isArray(data.history)) {
      throw new Error('This browser’s wallet data could not be read.');
    }
    return data;
  }

  function update(operation) {
    return lock(STORAGE_KEY, async () => {
      const current = read();
      // Check that storage is writable before making a mint request.
      storage.setItem(STORAGE_KEY, JSON.stringify(current));
      const { proofs, entry } = await operation(current.proofs);
      const history = [{ ...entry, at: now() }, ...current.history];
      storage.setItem(STORAGE_KEY, JSON.stringify({ proofs, history }));
      return history[0];
    });
  }

  return {
    read,
    mint(value) {
      return update(async (proofs) => {
        const issued = await adapter.mint(parseAmount(value));
        return { proofs: [...proofs, ...issued], entry: { kind: 'mint', amount: balance(issued) } };
      });
    },
    send(value) {
      return update(async (proofs) => {
        const amount = parseAmount(value);
        const before = balance(proofs);
        if (amount > before) throw new WalletNotice('Not enough test sats for this send.');
        const { keep, token } = await adapter.send(amount, proofs);
        return { proofs: keep, entry: { kind: 'send', amount, debit: before - balance(keep), token } };
      });
    },
    receive(value) {
      return update(async (proofs) => {
        const token = value.trim();
        if (!/^cashu[AB]/.test(token) || token.length > MAX_TOKEN_LENGTH) {
          throw new WalletNotice('Paste a valid Cashu token.');
        }
        const received = await adapter.receive(token);
        return { proofs: [...proofs, ...received], entry: { kind: 'receive', amount: balance(received) } };
      });
    },
  };
}
