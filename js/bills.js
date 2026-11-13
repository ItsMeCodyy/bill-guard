const BILL_KEY = 'billguard.bills.v1';
const SETTINGS_KEY = 'billguard.settings.v1';
export const categories = ['entertainment', 'software', 'utilities', 'shopping', 'fitness', 'education', 'other'];
export const cycles = ['weekly', 'monthly', 'yearly'];
export const statuses = ['active', 'trial', 'paused'];

export function parseDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 12);
}

export function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function today() {
  return dateKey(new Date());
}

function moveMonths(date, months, anchorDay) {
  const monthStart = new Date(date.getFullYear(), date.getMonth() + months, 1, 12);
  const lastDay = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0).getDate();
  monthStart.setDate(Math.min(anchorDay, lastDay));
  return monthStart;
}

export function nextDateFor(bill, from = new Date()) {
  if (bill.status === 'paused') return null;
  const target = parseDate(bill.nextDate);
  const baseline = new Date(from.getFullYear(), from.getMonth(), from.getDate(), 12);
  if (target >= baseline) return target;
  if (bill.cycle === 'weekly') {
    const weeks = Math.max(0, Math.ceil((baseline - target) / (7 * 86400000)));
    target.setDate(target.getDate() + weeks * 7);
    return target;
  }
  const original = parseDate(bill.nextDate);
  const interval = bill.cycle === 'yearly' ? 12 : 1;
  let increments = Math.max(0, Math.floor(((baseline.getFullYear() - original.getFullYear()) * 12 + baseline.getMonth() - original.getMonth()) / interval));
  let result = moveMonths(original, increments * interval, original.getDate());
  while (result < baseline) result = moveMonths(original, (++increments) * interval, original.getDate());
  return result;
}

export function chargesBetween(bill, start, end) {
  if (bill.status === 'paused') return [];
  const items = [];
  const first = parseDate(bill.nextDate);
  const from = new Date(start.getFullYear(), start.getMonth(), start.getDate(), 12);
  const through = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 12);
  if (first > through) return items;
  if (bill.cycle === 'weekly') {
    const offset = Math.max(0, Math.ceil((from - first) / (7 * 86400000)));
    const current = parseDate(bill.nextDate);
    current.setDate(current.getDate() + offset * 7);
    for (let i = 0; i < 100 && current <= through; i++) {
      if (current >= from) items.push({ ...bill, chargeDate: dateKey(current) });
      current.setDate(current.getDate() + 7);
    }
  } else {
    const increment = bill.cycle === 'yearly' ? 12 : 1;
    for (let i = 0; i < 120; i++) {
      const current = moveMonths(first, i * increment, first.getDate());
      if (current > through) break;
      if (current >= from) items.push({ ...bill, chargeDate: dateKey(current) });
    }
  }
  return items;
}

export function monthlyEquivalent(bill) {
  if (bill.status === 'paused') return 0;
  return bill.amount * (bill.cycle === 'weekly' ? 52 / 12 : bill.cycle === 'yearly' ? 1 / 12 : 1);
}

export function validateBill(input) {
  if (!input || typeof input !== 'object') throw new Error('invalid bill');
  const name = String(input.name || '').trim().slice(0, 80);
  const amount = Number(input.amount);
  const nextDate = String(input.nextDate || '');
  if (!name || !Number.isFinite(amount) || amount < 0 || amount > 1000000 ||
    !cycles.includes(input.cycle) || !categories.includes(input.category) ||
    !statuses.includes(input.status) || !/^\d{4}-\d{2}-\d{2}$/.test(nextDate) ||
    Number.isNaN(parseDate(nextDate).getTime()) || dateKey(parseDate(nextDate)) !== nextDate) {
    throw new Error('please check the bill details');
  }
  return {
    id: typeof input.id === 'string' && input.id.length <= 100 && input.id ? input.id : crypto.randomUUID(),
    name, amount: Math.round(amount * 100) / 100,
    cycle: input.cycle, nextDate, category: input.category, status: input.status
  };
}

export function getBills() {
  try {
    const stored = JSON.parse(localStorage.getItem(BILL_KEY) || '[]');
    return Array.isArray(stored) ? stored.map(validateBill) : [];
  } catch {
    return [];
  }
}

export function saveBills(bills) {
  localStorage.setItem(BILL_KEY, JSON.stringify(bills));
}

export function getSettings() {
  try {
    const data = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return {
      theme: ['light', 'dark', 'system'].includes(data.theme) ? data.theme : 'light',
      currency: ['USD', 'EUR', 'GBP', 'CAD', 'AUD'].includes(data.currency) ? data.currency : 'USD'
    };
  } catch {
    return { theme: 'light', currency: 'USD' };
  }
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}
