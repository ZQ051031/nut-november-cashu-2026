# Testnut Pocket

A small Cashu test wallet for Nut November 2026. Create free test sats, send them
as a shareable token, or receive a token into a local balance. There is no backend,
account, analytics, or paid service. **This is a test wallet, not a place for real
sats.**

## Run it

Clone this repository and open `index.html` in a modern browser. The JavaScript
bundle is checked in; no installer or build is needed. Some browsers restrict
local storage on `file:` URLs. If so, use any static file server from the repository
root, for example:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Open <http://127.0.0.1:8000/> and stop the server with Ctrl+C when finished.
Internet access is needed to use the mint, not to open the page.

## Demo

Create 100 test sats, send 25, and redeem the token in a second browser profile.
See [DEMO.md](DEMO.md) for the steps and expected balances.

## How it uses Cashu

- The default mint is [Testnut](https://testnut.cashu.space). It simulates
  Lightning payment for BOLT11 mint quotes. Never pay an invoice; the app does
  not expose one. Use **Check test quote** if the fake payment is still pending.
- [cashu-ts](https://github.com/cashubtc/cashu-ts) handles mint discovery, blind
  signatures, swapping proofs, and token encoding/decoding. Sending takes proofs
  out of your balance; receiving swaps a same-mint, sat-denominated token for new
  proofs, so the original token cannot be redeemed again. Mint fees can make the
  amount debited or credited differ from the token's face value.
- Balances, proofs, a pending quote, and history are saved in this browser's
  local storage and separated by mint URL. Sent tokens stay in history so they
  can be copied again; they are bearer assets until redeemed. A second browser
  profile has independent storage. Use one tab if your browser lacks Web Locks.

## Real sats: what would have to change

1. Complete the demo on Testnut first. Testnut tokens have no real value and
   cannot be converted to real sats by switching mints.
2. For real sats, use a production Cashu wallet and choose an HTTPS,
   sat-denominated mint you trust. Verify the mint URL independently. In that
   wallet, select that mint, request a mint quote, pay the quote from a Lightning
   wallet, and claim the resulting ecash. Use that wallet to send and redeem
   real tokens.
3. Testnut Pocket's **Mint settings → Switch mint** selects a different issuer
   for same-mint send/receive; it does not move a balance or turn on real
   Lightning funding. Technically, a browser-compatible production mint selected
   there could redeem a matching token funded in an external wallet. That does
   not make this app safe for real funds: keep production tokens out of it. Use
   the mint switch here only with a trusted test mint that permits browser CORS.

A mint can charge fees, reset, go offline, or fail to honor its ecash. Browser
storage is unencrypted and is not a backup: clearing site data or losing the
profile loses the balance. Interrupted swaps or failed writes can also lose
tokens; this prototype does not implement transaction recovery. Anyone who sees
an unredeemed token can spend it. No real private keys, seed phrases, or funds
are required or included in this repository.

## Develop and test

With Node.js 22.4+ and npm, from a clean checkout:

```sh
npm ci
npm test
```

The Node tests use a mocked mint and make no network requests. If you change
browser source, regenerate the checked-in bundle with the single esbuild command
behind `npm run build`, then run the tests.

[MIT](LICENSE)
