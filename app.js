import { Mint, Wallet, getEncodedToken, getTokenMetadata, setGlobalRequestOptions } from '@cashu/cashu-ts';
import { createWalletStore, STORAGE_KEY, TEST_MINT } from './wallet.js';

setGlobalRequestOptions({ requestTimeout: 12000 });
const $ = (id) => document.getElementById(id);
const controls = $('controls');
let store;
let busy = false;

function status(message, error = false) {
  $('status').textContent = message;
  $('status').classList.toggle('error', error);
}

function showToken(token) {
  $('outgoing').hidden = !token;
  $('outgoing-token').value = token;
  if (token) {
    $('outgoing-token').focus();
    $('outgoing-token').select();
  }
}

function render() {
  const { mint, balance, history, quote } = store.snapshot();
  const isTestnut = mint === TEST_MINT;
  $('active-mint').textContent = mint;
  $('mint-url').value = mint;
  $('balance').textContent = balance.toLocaleString();
  $('create-button').disabled = !isTestnut;
  $('create-amount').disabled = !isTestnut || !!quote;
  if (quote) $('create-amount').value = quote.amount;
  $('create-button').textContent = quote ? 'Check test quote' : 'Create test sats';
  $('create-hint').textContent = isTestnut
    ? 'Get free ecash from the Testnut faucet.'
    : 'Free issuance is available only on Testnut.';
  $('empty-history').hidden = history.length > 0;
  $('history').replaceChildren(...history.map(({ kind, amount, at, token, face }) => {
    const li = document.createElement('li');
    const amountLabel = document.createElement('strong');
    const time = document.createElement('time');
    amountLabel.textContent = `${kind} · ${kind === 'Sent' ? '−' : '+'}${amount} sats`;
    if (kind === 'Sent' && face !== amount) amountLabel.textContent += ` (${face} sats in token)`;
    time.dateTime = new Date(at).toISOString();
    time.textContent = new Date(at).toLocaleString();
    li.append(amountLabel, time);
    if (token) {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = 'Show sent token';
      button.addEventListener('click', () => showToken(token));
      li.append(button);
    }
    return li;
  }));
}

function action(id, handler) {
  $(id).addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    controls.disabled = true;
    status('Working…');
    let outcome;
    try {
      outcome = navigator.locks
        ? await navigator.locks.request(STORAGE_KEY, { ifAvailable: true }, (lock) => {
          if (!lock) throw new Error('Another tab is using this wallet. Try again shortly.');
          return handler();
        })
        : await handler();
      status(outcome.message);
    } catch (error) {
      status(error.message || 'The wallet operation failed.', true);
    } finally {
      busy = false;
      try {
        render();
        controls.disabled = false;
        if (outcome?.token) showToken(outcome.token);
      } catch {
        status('Wallet storage could not be read. Try opening the app on localhost.', true);
      }
    }
  });
}

try {
  store = createWalletStore({
    storage: localStorage,
    connect: async (url) => {
      const wallet = new Wallet(new Mint(url), { unit: 'sat' });
      await wallet.loadMint();
      return wallet;
    },
    inspectToken: getTokenMetadata,
    encodeToken: getEncodedToken,
  });
  render();
  controls.disabled = false;
  status('Ready. No real payments needed.');
} catch {
  status('Wallet storage is unavailable. Try opening the app on localhost.', true);
}

action('create', async () => ({
  message: await store.create($('create-amount').value)
    ? 'Test sats added to your balance.'
    : 'Waiting for the fake payment. Check the test quote again shortly; do not pay an invoice.',
}));
action('receive', async () => {
  await store.receive($('incoming').value);
  $('incoming').value = '';
  return { message: 'Token redeemed. Your balance is up to date.' };
});
action('send', async () => {
  const token = await store.send($('send-amount').value);
  $('send-amount').value = '';
  return { message: 'Token created and saved in local history.', token };
});
action('settings', () => {
  store.switchMint($('mint-url').value);
  showToken('');
  return { message: 'Mint selected. Use only test tokens from this mint.' };
});

$('copy').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText($('outgoing-token').value);
    status('Token copied.');
  } catch {
    $('outgoing-token').focus();
    $('outgoing-token').select();
    status('Token selected. Use your browser’s Copy command.');
  }
});

window.addEventListener('storage', ({ key }) => {
  if (key !== STORAGE_KEY || busy) return;
  showToken('');
  try {
    render();
  } catch {
    controls.disabled = true;
    status('Wallet storage could not be read.', true);
  }
});
