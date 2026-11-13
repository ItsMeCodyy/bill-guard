import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const SUPABASE_URL = 'https://zvskbtdhsgwizchjmrpw.supabase.co';
const PUBLIC_KEY = 'sb_publishable_GhiqWfJ91LIf7i0JUcBplg_x5bdYHPl';

function send(res, status, data) {
  res.setHeader('Cache-Control', 'no-store');
  return res.status(status).json(data);
}

function encrypt(token) {
  const key = Buffer.from(process.env.PLAID_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('encryption key is not configured');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
}

function decrypt(value) {
  const key = Buffer.from(process.env.PLAID_TOKEN_ENCRYPTION_KEY || '', 'base64');
  if (key.length !== 32) throw new Error('encryption key is not configured');
  const raw = Buffer.from(value, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([decipher.update(raw.subarray(28)), decipher.final()]).toString('utf8');
}

async function plaid(path, body) {
  const env = process.env.PLAID_ENV;
  if (!['development', 'sandbox', 'production'].includes(env)) throw new Error('Plaid environment is invalid');
  const response = await fetch(`https://${env}.plaid.com${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.PLAID_CLIENT_ID,
      secret: process.env.PLAID_SECRET,
      ...body
    }),
    signal: AbortSignal.timeout(15000)
  });
  const result = await response.json();
  if (!response.ok) {
    const error = new Error(result.error_message || 'Plaid request failed');
    error.status = response.status >= 500 ? 502 : 400;
    throw error;
  }
  return result;
}

async function supabase(path, { method = 'GET', body, token, service = false } = {}) {
  const key = service ? process.env.SUPABASE_SECRET_KEY : PUBLIC_KEY;
  const response = await fetch(`${SUPABASE_URL}${path}`, {
    method,
    headers: {
      apikey: key,
      Authorization: `Bearer ${service ? key : token}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation'
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  if (!response.ok) throw new Error('database operation failed');
  return response.status === 204 ? null : response.json();
}

async function requireUser(req) {
  const header = req.headers.authorization || '';
  const match = /^Bearer (\S+)$/.exec(header);
  if (!match) return null;
  const response = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    headers: { apikey: PUBLIC_KEY, Authorization: `Bearer ${match[1]}` }
  });
  if (!response.ok) return null;
  const user = await response.json();
  return user?.id ? user : null;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { error: 'method not allowed' });
  if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET ||
      !process.env.SUPABASE_SECRET_KEY || !process.env.PLAID_TOKEN_ENCRYPTION_KEY) {
    return send(res, 503, { error: 'bank connections are not configured yet' });
  }
  if (!['development', 'sandbox', 'production'].includes(process.env.PLAID_ENV)) {
    return send(res, 503, { error: 'invalid Plaid environment' });
  }
  const origin = req.headers.origin;
  const host = req.headers.host;
  if (origin && new URL(origin).host !== host) return send(res, 403, { error: 'origin not allowed' });
  const user = await requireUser(req);
  if (!user) return send(res, 401, { error: 'sign in first' });

  const { action, publicToken, connectionId } = req.body || {};
  try {
    if (action === 'link-token') {
      const result = await plaid('/link/token/create', {
        user: { client_user_id: user.id },
        client_name: 'BillGuard',
        products: ['transactions'],
        country_codes: ['US'],
        language: 'en'
      });
      return send(res, 200, { link_token: result.link_token });
    }

    if (action === 'exchange') {
      if (typeof publicToken !== 'string' || publicToken.length > 5000) {
        return send(res, 400, { error: 'invalid public token' });
      }
      const result = await plaid('/item/public_token/exchange', { public_token: publicToken });
      const metadata = await plaid('/item/get', { access_token: result.access_token });
      const institutionId = metadata.item?.institution_id;
      let institutionName = 'linked institution';
      if (institutionId) {
        const institution = await plaid('/institutions/get_by_id', {
          institution_id: institutionId, country_codes: ['US']
        });
        institutionName = institution.institution?.name || institutionName;
      }
      const record = await supabase('/rest/v1/bank_connections', {
        method: 'POST', service: true,
        body: {
          user_id: user.id, item_id: result.item_id,
          institution_name: institutionName,
          access_token_encrypted: encrypt(result.access_token)
        }
      });
      return send(res, 200, { id: record[0].id, institution_name: institutionName });
    }

    if (action === 'list') {
      const rows = await supabase(`/rest/v1/bank_connections?user_id=eq.${encodeURIComponent(user.id)}&select=id,institution_name,created_at`, { service: true });
      return send(res, 200, { connections: rows });
    }

    if (action === 'accounts') {
      if (typeof connectionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(connectionId)) {
        return send(res, 400, { error: 'invalid connection' });
      }
      const rows = await supabase(`/rest/v1/bank_connections?id=eq.${encodeURIComponent(connectionId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,access_token_encrypted`, { service: true });
      if (!rows.length) return send(res, 404, { error: 'connection not found' });
      const result = await plaid('/accounts/get', { access_token: decrypt(rows[0].access_token_encrypted) });
      return send(res, 200, {
        accounts: result.accounts.map(a => ({
          id: a.account_id, name: a.name, mask: a.mask || null,
          type: a.type, subtype: a.subtype
        }))
      });
    }

    if (action === 'disconnect') {
      if (typeof connectionId !== 'string' || !/^[a-f0-9-]{36}$/i.test(connectionId)) {
        return send(res, 400, { error: 'invalid connection' });
      }
      const rows = await supabase(`/rest/v1/bank_connections?id=eq.${encodeURIComponent(connectionId)}&user_id=eq.${encodeURIComponent(user.id)}&select=id,access_token_encrypted`, { service: true });
      if (!rows.length) return send(res, 404, { error: 'connection not found' });
      await plaid('/item/remove', { access_token: decrypt(rows[0].access_token_encrypted) });
      await supabase(`/rest/v1/bank_connections?id=eq.${encodeURIComponent(connectionId)}&user_id=eq.${encodeURIComponent(user.id)}`, { method: 'DELETE', service: true });
      return send(res, 200, { disconnected: true });
    }
    return send(res, 400, { error: 'unknown action' });
  } catch (error) {
    return send(res, error.status || 500, { error: error.message || 'request failed' });
  }
}
