# Testnut Pocket

Testnut Pocket is a browser-only Cashu wallet for learning how to mint, send, and receive ecash. It was built for **Nut November 2026**. There’s no backend, account, paid service, or payment step.

**TEST ONLY — do not use real funds.** This wallet is locked to [Testnut](https://testnut.cashu.space), a public Cashu mint that simulates Lightning payments. The test sats have no monetary value.

## Run it

1. Download or clone [this repository](https://github.com/ZQ051031/nut-november-cashu-2026) and open `index.html` in a recent Chromium browser. No install, build, or server is needed. An internet connection is required for mint, send, and receive operations.
2. If your browser blocks storage or wallet operations on local files, run `python3 -m http.server 8000 --bind 127.0.0.1` from the repository root and visit <http://localhost:8000/>. Keep using the same URL and browser profile to keep the same balance. A file URL and localhost do not share wallet data.

## 60-second demo

From a fresh wallet, **Mint** 64 test sats → **Send** 16 test sats → copy the token → paste it into **Receive** → **Redeem token**. In the demo run, the balance went **0 → 64 → 46 → 62** because the mint charged 2 test sats on the send. Refresh to check that the balance and activity persist. See [DEMO.md](DEMO.md) for a two-browser variation and a double-spend check.

## How it uses Cashu

- **Mint:** [`@cashu/cashu-ts`](https://github.com/cashubtc/cashu-ts) talks directly to Testnut. The app checks that the mint advertises FakeWallet, requests a simulated BOLT11 quote, waits for it to be marked paid automatically, and calls cashu-ts to mint proofs. Invoices are never displayed or paid by this app.
- **Send:** cashu-ts selects or swaps proofs, then encodes the outgoing proofs as a `cashuB` bearer token. The app keeps the remaining proofs and records the debit, including any mint fee.
- **Receive:** paste a `cashuA` or `cashuB` token from Testnut in the sat unit. cashu-ts redeems it at Testnut for fresh proofs. This mint-side swap rejects tokens that were already spent. Tokens from other mints are rejected without contacting those mints.
- **Storage:** proofs, sent tokens, and activity are stored unencrypted in this browser’s local storage. Tabs use Web Locks to serialize edits. Clearing site data or changing browsers can erase or isolate your balance. This is not a backup or recovery wallet: closing the page or losing the response during a mint or swap can lose test ecash. Anyone who gets an unspent bearer token can redeem it.

## Trying Cashu with real sats

1. **Use the test mint first.** Complete the demo here. Testnut tokens cannot be converted to real sats.
2. **Switch mints in a separate mainnet-capable Cashu wallet.** Open a wallet you trust, select **Add mint** (or its equivalent), paste the HTTPS URL of a mainnet Cashu mint you trust, verify the URL and the mint’s fees, then select that mint. Testnut Pocket deliberately has no mainnet switch; do not send money or paste real tokens here.
3. **Start small.** In the other wallet, request a small mint deposit, check the amount, and pay that wallet’s real Lightning invoice using your own Lightning wallet. Verify the balance, send a small token to a trusted recipient, and test redeeming or withdrawing before relying on the mint. Follow that wallet’s backup instructions.

Real Cashu ecash is custodial: a mint can fail, go offline, refuse redemption, or lose reserves. Bearer tokens can be stolen, and interrupted operations or lost wallet data can cost money. No real private keys, seed phrases, or real-funds tokens are included in this repository. No mainnet flow was tested here.

## Develop and test

Use Node.js 22+, npm, and Chromium:

```sh
npm ci
npx playwright install chromium
npm test
```

If Chromium is already installed, you can skip the Playwright install by setting `CHROME_PATH=/path/to/chrome` when running tests. On a minimal Linux host, use `npx playwright install --with-deps chromium` if runtime dependencies are missing.

`npm test` runs the wallet unit tests and a browser smoke test against the checked-in bundle with network requests blocked. Run `npm run test:live` separately for the full browser flow against Testnut’s FakeWallet. It requires a reachable test mint; it never pays an invoice. Set `WALLET_URL=http://localhost:8000/` to run that flow against the local server instead of the default file URL.

After editing JavaScript under `src/`, run `npm run build` and commit the updated `dist/app.js`. The checked-in bundle contains all browser code and dependencies; the app loads no CDN scripts. See [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES) for bundled dependencies and [LICENSE](LICENSE) for the project’s MIT license.
