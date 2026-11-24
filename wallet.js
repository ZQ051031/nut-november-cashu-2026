import { HttpResponseError, MintOperationError } from '@cashu/cashu-ts';

export const TEST_MINT = 'https://testnut.cashu.space';
export const STORAGE_KEY = 'testnut-pocket-v1';

export function mintUrl(input) {
  let url;
  try {
    url = new URL(input.trim());
  } catch {
    throw new Error('Enter a valid HTTPS mint URL.');
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash) {
    throw new Error('Use an HTTPS mint URL without credentials, a query, or a fragment.');
  }
  return url.href.replace(/\/+$/, '');
}

function sats(input) {
  if (!/^\d+$/.test(String(input)) || !Number.isSafeInteger(Number(input)) || Number(input) < 1) {
    throw new Error('Enter a positive whole number of sats.');
  }
  return Number(input);
}

export function balance(proofs) {
  return proofs.reduce((total, proof) => total + BigInt(proof.amount.toString()), 0n);
}

export function createWalletStore({ storage, connect, inspectToken, encodeToken, now = Date.now }) {
  function read() {
    return JSON.parse(storage.getItem(STORAGE_KEY)) ?? { mint: TEST_MINT, accounts: {} };
  }

  function save(data) {
    storage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  const account = ({ mint, accounts }) => accounts[mint] ?? { proofs: [], history: [], quote: null };

  function start() {
    const data = read();
    const current = account(data);
    data.accounts[data.mint] = current;
    save(data);
    return [data, current];
  }

  function record(data, current, kind, amount, extra = {}) {
    current.history.unshift({ kind, amount: amount.toString(), at: now(), ...extra });
    save(data);
  }

  return {
    snapshot() {
      const data = read();
      const { proofs, history, quote } = account(data);
      return { mint: data.mint, balance: balance(proofs), history, quote };
    },
    switchMint(url) {
      const data = read();
      data.mint = mintUrl(url);
      save(data);
    },
    async create(input) {
      const [data, current] = start();
      if (data.mint !== TEST_MINT) throw new Error('Free issuance is available only on Testnut.');
      const amount = current.quote?.amount ?? sats(input);
      if (amount > 500000) throw new Error('Testnut allows up to 500,000 sats per quote.');
      const wallet = await connect(data.mint);
      let quote;
      if (current.quote) {
        try {
          quote = await wallet.checkMintQuoteBolt11(current.quote.id);
        } catch (error) {
          const unknownQuote = error instanceof MintOperationError
            && /\b(?:unknown (?:mint )?quote|quote (?:was )?not found)\b/i.test(error.message);
          if (!unknownQuote && !(error instanceof HttpResponseError && error.status === 404)) throw error;
          current.quote = null;
          save(data);
          throw new Error('The mint no longer recognizes this test quote. Create a new quote.');
        }
      } else {
        quote = await wallet.createMintQuoteBolt11(amount);
        current.quote = { id: quote.quote, amount };
        save(data);
      }
      if (quote.state === 'ISSUED' || (quote.state === 'UNPAID' && quote.expiry && quote.expiry * 1000 <= now())) {
        current.quote = null;
        save(data);
        throw new Error('This test quote is expired or already claimed. Create a new quote.');
      }
      if (quote.state !== 'PAID') return false;
      const proofs = await wallet.mintProofsBolt11(amount, quote);
      current.proofs.push(...proofs);
      current.quote = null;
      record(data, current, 'Created', balance(proofs));
      return true;
    },
    async receive(input) {
      const token = input.trim();
      if (!token) throw new Error('Paste a Cashu token first.');
      const metadata = inspectToken(token);
      const [data, current] = start();
      if (mintUrl(metadata.mint) !== data.mint || metadata.unit !== 'sat') {
        throw new Error('Only sat tokens from the selected mint can be received.');
      }
      const wallet = await connect(data.mint);
      const proofs = await wallet.receive(token);
      current.proofs.push(...proofs);
      record(data, current, 'Received', balance(proofs));
    },
    async send(input) {
      const amount = sats(input);
      const [data, current] = start();
      const previousBalance = balance(current.proofs);
      if (BigInt(amount) > previousBalance) throw new Error('Not enough sats at this mint.');
      const wallet = await connect(data.mint);
      let offline;
      try {
        offline = wallet.sendOffline(amount, current.proofs);
      } catch {
        // An exact offline selection is not always possible.
      }
      const exactBearerMatch = offline && balance(offline.send) === BigInt(amount)
        && offline.send.every((proof) => !proof.secret.trimStart().startsWith('['));
      const preview = exactBearerMatch ? null : await wallet.prepareSwapToSend(amount, current.proofs);
      const outgoing = preview ? preview.sendOutputs.map(({ blindedMessage }) => blindedMessage) : offline.send;
      const fee = wallet.getFeesForProofs(outgoing);
      if (fee.greaterThanOrEqual(amount)) {
        throw new Error(`Send more than ${fee.toString()} sats so the token is worth more than the redemption fee.`);
      }
      const { keep, send } = preview ? await wallet.completeSwap(preview) : offline;
      const token = encodeToken({ mint: data.mint, unit: 'sat', proofs: send });
      current.proofs = keep;
      record(data, current, 'Sent', previousBalance - balance(keep), { token, face: balance(send).toString() });
      return token;
    },
  };
}
