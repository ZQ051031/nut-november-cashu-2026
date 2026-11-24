import { Mint, Wallet, getEncodedToken, getTokenMetadata, setGlobalRequestOptions } from '@cashu/cashu-ts';
import { WalletNotice } from './wallet.js';

export const TEST_MINT = 'https://testnut.cashu.space';

setGlobalRequestOptions({ credentials: 'omit', redirect: 'error', requestTimeout: 10_000 });

export function createCashuAdapter() {
  const mint = new Mint(TEST_MINT);
  const wallet = new Wallet(mint, { unit: 'sat' });
  let ready;

  function load() {
    ready ??= wallet.loadMint().catch((error) => {
      ready = undefined;
      throw error;
    });
    return ready;
  }

  return {
    async mint(amount) {
      const info = await mint.getInfo();
      if (!info.description_long?.includes('FakeWallet')) {
        throw new WalletNotice('The mint no longer advertises FakeWallet. No quote was requested.');
      }
      await load();
      let quote = await wallet.createMintQuoteBolt11(amount);
      for (let attempt = 0; quote.state === 'UNPAID' && attempt < 8; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, 750));
        quote = await wallet.checkMintQuoteBolt11(quote.quote);
      }
      if (quote.state !== 'PAID') {
        throw new WalletNotice('The test quote was not automatically paid. No payment is needed or accepted here.');
      }
      return wallet.mintProofsBolt11(amount, quote);
    },

    async send(amount, proofs) {
      await load();
      const { keep, send } = await wallet.send(amount, proofs, { includeFees: true });
      return { keep, token: getEncodedToken({ mint: TEST_MINT, unit: 'sat', proofs: send }) };
    },

    async receive(token) {
      let metadata;
      try {
        metadata = getTokenMetadata(token);
      } catch {
        throw new WalletNotice('Paste a valid Cashu token.');
      }
      if (metadata.mint.replace(/\/+$/, '') !== TEST_MINT || metadata.unit !== 'sat') {
        throw new WalletNotice('Only sat tokens from Testnut are accepted. Never paste a real-funds token.');
      }
      await load();
      return wallet.receive(token);
    },
  };
}
