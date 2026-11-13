import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';

const client = createClient(
  'https://zvskbtdhsgwizchjmrpw.supabase.co',
  'sb_publishable_GhiqWfJ91LIf7i0JUcBplg_x5bdYHPl'
);

export const auth = client.auth;

function toRow(bill, userId) {
  return {
    id: bill.id,
    user_id: userId,
    name: bill.name,
    amount: bill.amount,
    cycle: bill.cycle,
    next_date: bill.nextDate,
    category: bill.category,
    status: bill.status
  };
}

export async function fetchCloudBills(userId) {
  const { data, error } = await client.from('bills')
    .select('id,name,amount,cycle,next_date,category,status')
    .eq('user_id', userId);
  if (error) throw error;
  return data.map((row) => ({
    id: row.id, name: row.name, amount: Number(row.amount),
    cycle: row.cycle, nextDate: row.next_date,
    category: row.category, status: row.status
  }));
}

export async function upsertCloudBill(bill, userId) {
  const { error } = await client.from('bills')
    .upsert(toRow(bill, userId), { onConflict: 'id' });
  if (error) throw error;
}

export async function deleteCloudBill(id, userId) {
  const { error } = await client.from('bills')
    .delete().eq('id', id).eq('user_id', userId);
  if (error) throw error;
}

export async function importCloudBills(bills, userId) {
  for (let i = 0; i < bills.length; i += 100) {
    const { error } = await client.from('bills')
      .upsert(bills.slice(i, i + 100).map((bill) => toRow(bill, userId)));
    if (error) throw error;
  }
}

export async function clearCloudBills(userId) {
  const { error } = await client.from('bills')
    .delete().eq('user_id', userId).not('id', 'is', null);
  if (error) throw error;
}
