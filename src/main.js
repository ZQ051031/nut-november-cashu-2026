import { createCashuAdapter } from './cashu.js';
import { balance, createWallet, STORAGE_KEY, WalletNotice } from './wallet.js';

const byId = (id) => document.getElementById(id);
const forms = [...document.querySelectorAll('.actions form')];
const submitButtons = forms.map((form) => form.querySelector('button'));
const number = new Intl.NumberFormat();
const date = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const outgoing = byId('outgoing');
const outgoingToken = byId('outgoing-token');
const labels = { mint: 'Minted', send: 'Sent', receive: 'Received' };
const errors = {
  mint: 'Minting failed. Check your connection to Testnut and try again. Never pay an invoice.',
  send: 'Could not create the token. The mint may be unavailable or your balance may not cover its fees.',
  receive: 'Could not redeem the token. It may already be spent, or Testnut may be unavailable.',
};
let wallet;
let busy = false;
let unavailable = false;

function status(message, error = false) {
  const element = byId('status');
  element.dataset.error = error;
  element.textContent = message;
}

function showToken(token) {
  outgoingToken.value = token;
  outgoing.hidden = false;
}

function makeRow(entry) {
  const row = document.createElement('li');
  const description = document.createElement('div');
  const title = document.createElement('strong');
  const timestamp = document.createElement('small');
  const amount = document.createElement('span');
  const sent = entry.kind === 'send';

  title.textContent = labels[entry.kind];
  timestamp.textContent = date.format(entry.at);
  description.append(title, timestamp);
  amount.className = 'activity-amount';
  amount.textContent = `${sent ? '−' : '+'}${number.format(sent ? entry.debit : entry.amount)} test sats`;
  if (sent && entry.debit > entry.amount) {
    const details = document.createElement('small');
    details.textContent = `Token: ${number.format(entry.amount)} test sats`;
    amount.append(details);
  }
  row.append(description, amount);

  if (sent) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'activity-token';
    button.textContent = 'Show sent token';
    button.addEventListener('click', () => {
      showToken(entry.token);
      outgoingToken.focus();
    });
    row.append(button);
  }
  return row;
}

function render() {
  const { proofs, history } = wallet.read();
  byId('history-list').replaceChildren(...history.map(makeRow));
  byId('balance').textContent = number.format(balance(proofs));
  byId('empty-history').hidden = history.length !== 0;
}

function refresh() {
  try {
    render();
  } catch {
    unavailable = true;
    updateButtons();
    status('This browser’s wallet data could not be read. No data was reset.', true);
  }
}

function updateButtons() {
  for (const button of submitButtons) button.disabled = busy || unavailable;
}

try {
  wallet = createWallet({
    storage: window.localStorage,
    adapter: createCashuAdapter(),
    lock: (name, operation) => navigator.locks.request(name, operation),
  });
  refresh();
  if (!navigator.locks) {
    unavailable = true;
    status('Wallet actions require a recent browser on a local file, localhost, or HTTPS.', true);
  }
} catch {
  unavailable = true;
  status('Browser storage is unavailable. Try running the wallet on localhost.', true);
}
updateButtons();

addEventListener('storage', (event) => {
  if (wallet && (event.key === STORAGE_KEY || event.key === null)) refresh();
});

for (const form of forms) {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (busy || unavailable) return;
    const kind = form.id;
    const field = form.elements[kind === 'receive' ? 'token' : 'amount'];
    busy = true;
    updateButtons();
    status('Working with the test mint…');
    try {
      const entry = await wallet[kind](field.value);
      if (kind === 'send') showToken(entry.token);
      if (kind === 'receive') field.value = '';
      status(`${labels[kind]} ${number.format(entry.amount)} test sats.`);
    } catch (error) {
      status(error instanceof WalletNotice ? error.message : errors[kind], true);
    } finally {
      refresh();
      busy = false;
      updateButtons();
    }
  });
}

byId('copy-token').addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText(outgoingToken.value);
    status('Test token copied.');
  } catch {
    outgoingToken.focus();
    outgoingToken.select();
    status('Token selected. Use your browser’s copy shortcut.');
  }
});
