import { auth } from './cloud.js';

const $ = (selector) => document.querySelector(selector);
let linkHandler = null;
let loading = false;

function message(value) {
  $('#bank-status').textContent = value;
}

async function api(action, extra = {}) {
  const { data } = await auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('sign in to connect an account');
  const response = await fetch('/api/plaid', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action, ...extra })
  });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || 'request failed');
  return result;
}

function createElement(tag, className, value) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (value) el.textContent = value;
  return el;
}

async function refreshBanks() {
  const list = $('#bank-connections');
  list.replaceChildren();
  const { data } = await auth.getSession();
  if (!data.session) {
    message('sign in to connect a bank account.');
    return;
  }
  message('loading connections...');
  try {
    const { connections } = await api('list');
    message(connections.length ? `${connections.length} connected institution(s)` : 'no connected banks yet.');
    for (const connection of connections) {
      const card = createElement('div', 'bank-connection');
      const heading = createElement('strong', '', connection.institution_name);
      const accountList = createElement('div', 'bank-account-list', 'loading accounts...');
      const actions = createElement('div', 'bank-actions');
      const disconnect = createElement('button', 'button button-secondary button-sm', 'disconnect');
      disconnect.addEventListener('click', async () => {
        if (!confirm(`disconnect ${connection.institution_name}?`)) return;
        disconnect.disabled = true;
        try {
          await api('disconnect', { connectionId: connection.id });
          await refreshBanks();
        } catch (error) {
          message(error.message);
          disconnect.disabled = false;
        }
      });
      actions.append(disconnect);
      card.append(heading, accountList, actions);
      list.append(card);
      try {
        const { accounts } = await api('accounts', { connectionId: connection.id });
        accountList.replaceChildren();
        if (!accounts.length) accountList.textContent = 'no accounts returned';
        for (const account of accounts) {
          accountList.append(createElement(
            'div', 'bank-account',
            `${account.name}${account.mask ? ` ····${account.mask}` : ''} · ${account.subtype || account.type}`
          ));
        }
      } catch {
        accountList.textContent = 'account details temporarily unavailable';
      }
    }
  } catch (error) {
    message(error.message);
  }
}

function loadPlaidScript() {
  return new Promise((resolve, reject) => {
    if (window.Plaid) return resolve();
    const script = document.createElement('script');
    script.src = 'https://cdn.plaid.com/link/v2/stable/link-initialize.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('could not load Plaid Link'));
    document.head.append(script);
  });
}

$('#connect-bank').addEventListener('click', async () => {
  if (loading) return;
  loading = true;
  $('#connect-bank').disabled = true;
  try {
    message('preparing secure connection...');
    await loadPlaidScript();
    const { link_token } = await api('link-token');
    linkHandler?.destroy();
    linkHandler = window.Plaid.create({
      token: link_token,
      onSuccess: async (publicToken) => {
        message('saving your connection...');
        try {
          await api('exchange', { publicToken });
          await refreshBanks();
        } catch (error) {
          message(error.message);
        }
      },
      onExit: (error) => {
        if (error) message(error.display_message || 'bank connection was canceled');
        else message('bank connection closed');
      }
    });
    linkHandler.open();
  } catch (error) {
    message(error.message);
  } finally {
    loading = false;
    $('#connect-bank').disabled = false;
  }
});

auth.onAuthStateChange((event) => {
  if (['SIGNED_IN', 'SIGNED_OUT'].includes(event)) {
    queueMicrotask(refreshBanks);
  }
});
refreshBanks();
