import { icon, hydrateIcons } from './icons.js';
import {
  getBills, saveBills, getSettings, saveSettings, validateBill,
  parseDate, dateKey, today, monthlyEquivalent, chargesBetween, nextDateFor, categories
} from './bills.js';

let bills = getBills();
let settings = getSettings();
let activeFilter = 'all';
let selectedDay = today();
let displayedMonth = new Date().getMonth();
let displayedYear = new Date().getFullYear();
let lastFocus = null;
let toastTimer;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];
const format = (value) => new Intl.NumberFormat('en-US', { style: 'currency', currency: settings.currency }).format(value);
const prettyDate = (value, options = { month: 'short', day: 'numeric' }) => parseDate(value).toLocaleDateString('en-US', options);
const escapeHTML = (str) => String(str).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);

function notify(message) {
  const toast = $('#toast');
  toast.textContent = message;
  toast.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove('show'), 2700);
}

function applyTheme() {
  const dark = settings.theme === 'dark' ||
    (settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
  $('#theme-select').value = settings.theme;
  $('#currency-select').value = settings.currency;
}

function navigate() {
  const page = location.hash.slice(1) || 'overview';
  const allowed = ['overview', 'subscriptions', 'calendar', 'insights', 'settings'];
  const target = allowed.includes(page) ? page : 'overview';
  $$('.page').forEach((element) => element.classList.toggle('active', element.id === `page-${target}`));
  $$('.nav-link').forEach((element) => {
    const selected = element.dataset.page === target;
    element.classList.toggle('active', selected);
    selected ? element.setAttribute('aria-current', 'page') : element.removeAttribute('aria-current');
  });
  $('#breadcrumb').textContent = target;
  document.title = `${target} — billguard`;
  document.body.classList.remove('menu-open');
  render();
}

function empty(message = 'nothing here yet', details = 'add a bill to get started.') {
  return `<div class="empty">${icon('inbox')}<strong>${escapeHTML(message)}</strong>${escapeHTML(details)}</div>`;
}

function logo(name) {
  return `<span class="bill-logo" aria-hidden="true">${escapeHTML(name.charAt(0))}</span>`;
}

function listItem(bill, date = bill.nextDate) {
  return `<div class="bill-item">
    ${logo(bill.name)}
    <div class="bill-info"><div class="bill-title">${escapeHTML(bill.name)}</div>
    <div class="bill-sub">${prettyDate(date)} · ${escapeHTML(bill.cycle)}${bill.status === 'trial' ? ' · trial ends' : ''}</div></div>
    <div class="bill-amount">${format(bill.amount)}<small>per ${bill.cycle === 'yearly' ? 'year' : bill.cycle === 'weekly' ? 'week' : 'month'}</small></div>
  </div>`;
}

function upcoming(days = 30) {
  const start = parseDate(today());
  const end = parseDate(today());
  end.setDate(end.getDate() + days);
  return bills.flatMap((bill) => chargesBetween(bill, start, end))
    .sort((a, b) => a.chargeDate.localeCompare(b.chargeDate));
}

function totals() {
  return bills.reduce((sum, bill) => sum + monthlyEquivalent(bill), 0);
}

function categoryTotals() {
  const out = new Map();
  for (const bill of bills) {
    const amount = monthlyEquivalent(bill);
    if (amount) out.set(bill.category, (out.get(bill.category) || 0) + amount);
  }
  return [...out].sort((a, b) => b[1] - a[1]);
}

function breakdownMarkup() {
  const values = categoryTotals();
  if (!values.length) return empty('no spending yet', 'your category breakdown will appear here.');
  const max = values[0][1];
  return values.map(([name, value]) => `<div class="breakdown-row"><div class="breakdown-top"><span>${escapeHTML(name)}</span><span>${format(value)}</span></div><div class="track"><div class="fill" style="width:${Math.max(2, value / max * 100)}%"></div></div></div>`).join('');
}

function renderOverview() {
  const upcomingBills = upcoming();
  const total = totals();
  $('#monthly-total').textContent = format(total);
  $('#yearly-total').textContent = format(total * 12);
  $('#upcoming-total').textContent = format(upcomingBills.reduce((sum, bill) => sum + bill.amount, 0));
  $('#upcoming-count').textContent = `${upcomingBills.length} upcoming charge${upcomingBills.length === 1 ? '' : 's'}`;
  $('#active-total').textContent = bills.filter((bill) => bill.status !== 'paused').length;
  const trials = bills.filter((bill) => bill.status === 'trial');
  $('#trial-count').textContent = `${trials.length} free trial${trials.length === 1 ? '' : 's'}`;
  $('#upcoming-list').innerHTML = upcomingBills.length
    ? upcomingBills.slice(0, 6).map((bill) => listItem(bill, bill.chargeDate)).join('')
    : empty('all clear for now', 'no upcoming charges in the next 30 days.');
  $('#category-breakdown').innerHTML = breakdownMarkup();
  const trialSoon = upcomingBills.filter((bill) => bill.status === 'trial');
  $('#trial-banner').hidden = !trialSoon.length;
  if (trialSoon.length) {
    const next = trialSoon[0];
    $('#trial-banner-text').textContent = `${next.name} starts charging ${format(next.amount)} on ${prettyDate(next.chargeDate)}.`;
  }
}

function renderSubscriptions() {
  const query = $('#bill-search').value.trim().toLowerCase();
  const filtered = bills.filter((bill) =>
    (activeFilter === 'all' || bill.status === activeFilter) &&
    (bill.name.toLowerCase().includes(query) || bill.category.toLowerCase().includes(query))
  ).sort((a, b) => (nextDateFor(a)?.getTime() ?? Infinity) - (nextDateFor(b)?.getTime() ?? Infinity));
  $('#subscription-rows').innerHTML = filtered.length ? filtered.map((bill) => {
    const date = nextDateFor(bill);
    return `<tr><td><div class="bill-item">${logo(bill.name)}<div class="bill-info"><div class="bill-title">${escapeHTML(bill.name)}</div><div class="bill-sub">${escapeHTML(bill.category)} · ${escapeHTML(bill.cycle)}</div></div></div></td>
      <td>${format(bill.amount)}</td><td>${date ? prettyDate(dateKey(date)) : '—'}</td>
      <td><span class="status ${bill.status}">${bill.status === 'trial' ? 'free trial' : bill.status}</span></td>
      <td><div class="row-actions"><button class="action-btn" data-edit="${bill.id}" aria-label="Edit ${escapeHTML(bill.name)}">${icon('pencil')}</button><button class="action-btn" data-delete="${bill.id}" aria-label="Delete ${escapeHTML(bill.name)}">${icon('trash')}</button></div></td></tr>`;
  }).join('') : `<tr><td colspan="5">${empty('no subscriptions found', 'add a bill or change your filters.')}</td></tr>`;
}

function renderCalendar() {
  const monthStart = new Date(displayedYear, displayedMonth, 1, 12);
  $('#calendar-title').textContent = monthStart.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }).toLowerCase();
  const first = new Date(displayedYear, displayedMonth, 1 - monthStart.getDay(), 12);
  let markup = '';
  for (let i = 0; i < 42; i++) {
    const day = new Date(first);
    day.setDate(first.getDate() + i);
    const key = dateKey(day);
    const charges = bills.flatMap((bill) => chargesBetween(bill, day, day));
    markup += `<button class="calendar-day ${day.getMonth() !== displayedMonth ? 'outside' : ''} ${key === today() ? 'is-today' : ''} ${key === selectedDay ? 'selected' : ''}" data-day="${key}" aria-label="${prettyDate(key, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}, ${charges.length} charges"><span class="day-number">${day.getDate()}</span>${charges.slice(0, 2).map((bill) => `<span class="calendar-pill">${escapeHTML(bill.name)} · ${format(bill.amount)}</span>`).join('')}${charges.length > 2 ? `<span class="calendar-pill">+${charges.length - 2} more</span>` : ''}</button>`;
  }
  $('#calendar-grid').innerHTML = markup;
  const chosen = parseDate(selectedDay);
  const selected = bills.flatMap((bill) => chargesBetween(bill, chosen, chosen));
  $('#selected-day-title').textContent = prettyDate(selectedDay, { weekday: 'long', month: 'long', day: 'numeric' }).toLowerCase();
  $('#selected-day-bills').innerHTML = selected.length ? selected.map((bill) => listItem(bill, selectedDay)).join('') : empty('no bills due', 'nothing is scheduled for this day.');
}

function renderInsights() {
  const total = totals();
  const sorted = bills.filter((bill) => bill.status !== 'paused').sort((a, b) => monthlyEquivalent(b) - monthlyEquivalent(a));
  $('#insights-monthly').textContent = format(total);
  $('#insights-yearly').textContent = format(total * 12);
  $('#insights-largest').textContent = sorted[0]?.name || '—';
  $('#insights-categories').innerHTML = breakdownMarkup();
  $('#insights-top').innerHTML = sorted.length ? sorted.slice(0, 6).map((bill) => listItem(bill, dateKey(nextDateFor(bill)))).join('') : empty('no subscriptions yet', 'add your first subscription to see insights.');
}

function render() {
  renderOverview();
  renderSubscriptions();
  renderCalendar();
  renderInsights();
}

function openModal(bill = null) {
  lastFocus = document.activeElement;
  const form = $('#bill-form');
  form.reset();
  form.elements.id.value = bill?.id || '';
  form.elements.name.value = bill?.name || '';
  form.elements.amount.value = bill?.amount ?? '';
  form.elements.cycle.value = bill?.cycle || 'monthly';
  form.elements.nextDate.value = bill?.nextDate || today();
  form.elements.category.value = bill?.category || 'entertainment';
  form.elements.status.value = bill?.status || 'active';
  $('#modal-title').textContent = bill ? 'edit bill' : 'add a bill';
  $('#bill-modal').hidden = false;
  form.elements.name.focus();
}

function closeModal() {
  $('#bill-modal').hidden = true;
  lastFocus?.focus();
}

function handleSave(event) {
  event.preventDefault();
  const data = Object.fromEntries(new FormData(event.currentTarget));
  try {
    const bill = validateBill(data);
    const editing = bills.some((entry) => entry.id === bill.id);
    bills = editing ? bills.map((entry) => entry.id === bill.id ? bill : entry) : [...bills, bill];
    saveBills(bills);
    closeModal();
    render();
    notify(editing ? 'bill updated' : 'bill added');
  } catch (error) {
    notify(error.message);
  }
}

function downloadBackup() {
  const content = JSON.stringify({ version: 1, exportedAt: new Date().toISOString(), bills, settings }, null, 2);
  const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `billguard-backup-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  notify('backup downloaded');
}

async function importBackup(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 2_000_000) throw new Error('file is too large');
    const data = JSON.parse(await file.text());
    if (data.version !== 1 || !Array.isArray(data.bills) || data.bills.length > 5000) throw new Error('invalid backup file');
    const incoming = data.bills.map(validateBill);
    if (!confirm(`replace your ${bills.length} current bill(s) with ${incoming.length} from this backup?`)) return;
    saveBills(incoming);
    bills = incoming;
    if (data.settings && typeof data.settings === 'object') {
      settings = {
        theme: ['light', 'dark', 'system'].includes(data.settings.theme) ? data.settings.theme : 'light',
        currency: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(data.settings.currency) ? data.settings.currency : 'USD'
      };
      saveSettings(settings);
      applyTheme();
    }
    render();
    notify('backup imported');
  } catch {
    notify('could not import this backup');
  } finally {
    event.target.value = '';
  }
}

hydrateIcons();
applyTheme();
$('#today-label').textContent = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }).toLowerCase();
$$('[data-open-add]').forEach((button) => button.addEventListener('click', () => openModal()));
$('#close-modal').addEventListener('click', closeModal);
$('#cancel-modal').addEventListener('click', closeModal);
$('#bill-modal').addEventListener('click', (event) => { if (event.target.id === 'bill-modal') closeModal(); });
$('#bill-form').addEventListener('submit', handleSave);
$('#bill-search').addEventListener('input', renderSubscriptions);
$('#status-filters').addEventListener('click', (event) => {
  const button = event.target.closest('[data-status]');
  if (!button) return;
  activeFilter = button.dataset.status;
  $$('.filter').forEach((element) => element.classList.toggle('active', element === button));
  renderSubscriptions();
});
$('#subscription-rows').addEventListener('click', (event) => {
  const edit = event.target.closest('[data-edit]');
  const del = event.target.closest('[data-delete]');
  if (edit) openModal(bills.find((bill) => bill.id === edit.dataset.edit));
  if (del) {
    const bill = bills.find((item) => item.id === del.dataset.delete);
    if (bill && confirm(`remove ${bill.name}?`)) {
      bills = bills.filter((item) => item.id !== bill.id);
      saveBills(bills);
      render();
      notify('bill removed');
    }
  }
});
$('#previous-month').addEventListener('click', () => changeMonth(-1));
$('#next-month').addEventListener('click', () => changeMonth(1));
$('#calendar-today').addEventListener('click', () => {
  const date = new Date();
  displayedMonth = date.getMonth();
  displayedYear = date.getFullYear();
  selectedDay = today();
  renderCalendar();
});
function changeMonth(amount) {
  const date = new Date(displayedYear, displayedMonth + amount, 1);
  displayedMonth = date.getMonth();
  displayedYear = date.getFullYear();
  selectedDay = dateKey(date);
  renderCalendar();
}
$('#calendar-grid').addEventListener('click', (event) => {
  const day = event.target.closest('[data-day]');
  if (!day) return;
  selectedDay = day.dataset.day;
  const date = parseDate(selectedDay);
  displayedMonth = date.getMonth();
  displayedYear = date.getFullYear();
  renderCalendar();
});
$('#theme-select').addEventListener('change', (event) => {
  settings.theme = event.target.value;
  saveSettings(settings);
  applyTheme();
});
$('#currency-select').addEventListener('change', (event) => {
  if (bills.length && !confirm('this changes only the displayed currency, not bill amounts. continue?')) {
    event.target.value = settings.currency;
    return;
  }
  settings.currency = event.target.value;
  saveSettings(settings);
  render();
});
$('#export-data').addEventListener('click', downloadBackup);
$('#import-data').addEventListener('click', () => $('#import-file').click());
$('#import-file').addEventListener('change', importBackup);
$('#clear-data').addEventListener('click', () => {
  if (!confirm('delete all saved bills from this browser? this cannot be undone.')) return;
  bills = [];
  saveBills(bills);
  render();
  notify('all bills cleared');
});
$('#menu-toggle').addEventListener('click', () => document.body.classList.toggle('menu-open'));
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    if (!$('#bill-modal').hidden) closeModal();
    document.body.classList.remove('menu-open');
  }
  if (event.key === 'Tab' && !$('#bill-modal').hidden) {
    const focusable = $$('#bill-modal button, #bill-modal input, #bill-modal select').filter((item) => !item.disabled);
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }
});
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
window.addEventListener('hashchange', navigate);
navigate();
