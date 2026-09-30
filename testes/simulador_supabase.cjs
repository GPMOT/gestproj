// Simulador local da API da Supabase — SOMENTE PARA TESTES.
// Implementa o subconjunto do PostgREST (/rest/v1) e do Supabase Auth (/auth/v1) que o programa usa,
// executando tudo num PostgreSQL real com o papel "authenticated" e o id do usuário no JWT,
// para que permissões (GRANT), políticas (RLS), gatilhos e visões do gpmot_schema.sql valham de verdade.
// Uso: iniciado pelo online.cjs (ou: node simulador_supabase.cjs)  (PGHOST/PGPORT/PGUSER/PGDATABASE; porta HTTP em SB_PORT, padrão 54321)
const http = require('http'), crypto = require('crypto'), { Pool } = require('pg');
const PORT = +(process.env.SB_PORT || 54321);
const SECRET = 'segredo-de-teste-local-com-pelo-menos-32-caracteres';
const pool = new Pool({ max: 8 });
const b64u = b => Buffer.from(b).toString('base64').replace(/=+$/, '').replace(/\+/g, '-').replace(/\//g, '_');
const sign = p => { const h = b64u(JSON.stringify({ alg: 'HS256', typ: 'JWT' })), b = b64u(JSON.stringify(p)); return `${h}.${b}.${b64u(crypto.createHmac('sha256', SECRET).update(h + '.' + b).digest())}`; };
const verify = t => { try { const [h, b, s] = t.split('.'); if (b64u(crypto.createHmac('sha256', SECRET).update(h + '.' + b).digest()) !== s) return null; const p = JSON.parse(Buffer.from(b.replace(/-/g, '+').replace(/_/g, '/'), 'base64')); return p.exp && p.exp < Date.now() / 1000 ? null : p; } catch { return null; } };
const ANON = sign({ role: 'anon', iss: 'supabase-local', iat: 1, exp: 4102444800 });
const SERVICE = sign({ role: 'service_role', iss: 'supabase-local', iat: 1, exp: 4102444800 });
const OTP = {}, REFRESH = {}, LOG = [];

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,POST,PATCH,PUT,DELETE,OPTIONS', 'Access-Control-Allow-Headers': 'authorization,apikey,content-type,prefer,range,range-unit,accept-profile,content-profile,x-client-info,x-supabase-api-version,x-retry-count', 'Access-Control-Expose-Headers': 'Content-Range,X-Total-Count' };
const send = (res, st, body, h = {}) => { res.writeHead(st, { 'Content-Type': 'application/json', ...cors, ...h }); res.end(body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body)); };
const qi = s => { if (!/^[a-z_][a-z0-9_]*$/.test(s)) throw Object.assign(new Error('nome inválido: ' + s), { code: 'PGRST100', st: 400 }); return '"' + s + '"'; };

function userObj(u) { return { id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email, email_confirmed_at: new Date().toISOString(), phone: '', app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: {}, identities: [], created_at: new Date().toISOString(), updated_at: new Date().toISOString() }; }
function session(u) {
  const now = Math.floor(Date.now() / 1000), rt = crypto.randomBytes(16).toString('hex'); REFRESH[rt] = u;
  return { access_token: sign({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + 3600 }), token_type: 'bearer', expires_in: 3600, expires_at: now + 3600, refresh_token: rt, user: userObj(u) };
}

async function auth(req, res, path, q, body) {
  if (path === '/otp' && req.method === 'POST') {
    const email = String(body.email || '').trim().toLowerCase(); if (!/^\S+@\S+\.\S+$/.test(email)) return send(res, 400, { code: 400, error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
    let r = await pool.query('select id, email from auth.users where lower(email) = $1', [email]);
    if (!r.rows.length) r = await pool.query('insert into auth.users(id, email) values (gen_random_uuid(), $1) returning id, email', [email]);
    OTP[email] = { code: String(crypto.randomInt(0, 1e6)).padStart(6, '0'), user: r.rows[0], ate: Date.now() + 3600e3 };
    LOG.push(['otp', email]); return send(res, 200, {});
  }
  if (path === '/verify' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase(), o = OTP[email];
    if (!o || o.code !== String(body.token) || o.ate < Date.now()) return send(res, 403, { code: 403, error_code: 'otp_expired', msg: 'Token has expired or is invalid' });
    delete OTP[email]; return send(res, 200, session(o.user));
  }
  if (path === '/token' && q.get('grant_type') === 'refresh_token') { const u = REFRESH[body.refresh_token]; if (!u) return send(res, 400, { error: 'invalid_grant', error_description: 'Invalid Refresh Token' }); delete REFRESH[body.refresh_token]; return send(res, 200, session(u)); }
  if (path === '/user' && req.method === 'GET') { const p = verify(String(req.headers.authorization || '').replace(/^Bearer /i, '')); if (!p || !p.sub) return send(res, 401, { code: 401, msg: 'invalid JWT' }); return send(res, 200, userObj({ id: p.sub, email: p.email })); }
  if (path === '/logout') return send(res, 204);
  return send(res, 404, { msg: 'rota de auth não simulada: ' + path });
}

function filtros(q, params) {
  const w = [];
  for (const [k, v] of q) {
    if (['select', 'order', 'limit', 'offset', 'columns', 'on_conflict'].includes(k)) continue;
    const m = v.match(/^(not\.)?(eq|neq|is|in|gt|gte|lt|lte)\.(.*)$/s); if (!m) throw Object.assign(new Error('filtro não simulado: ' + k + '=' + v), { st: 400, code: 'PGRST100' });
    const [, not, op, val] = m, col = qi(k); let e;
    if (op === 'is') e = `${col} is ${val === 'null' ? 'null' : val === 'true' ? 'true' : 'false'}`;
    else if (op === 'in') { const items = val.replace(/^\(|\)$/g, '').split(',').map(s => s.replace(/^"|"$/g, '')); params.push(items); e = `${col}::text = any($${params.length})`; }
    else { params.push(val); e = `${col} ${{ eq: '=', neq: '<>', gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]} $${params.length}`; }
    w.push(not ? `not (${e})` : e);
  }
  return w.length ? ' where ' + w.join(' and ') : '';
}

async function rest(req, res, table, q, body, claims) {
  if (table.startsWith('rpc/')) {   // funções do banco (supabase.rpc)
    const fn = qi(table.slice(4)), c = await pool.connect();
    try { await c.query('begin'); await c.query(`set local role ${claims.role === 'authenticated' ? 'authenticated' : 'anon'}`);
      await c.query(`select set_config('request.jwt.claim.sub', $1, true)`, [claims.sub || '']);
      const r = await c.query(`select to_json(public.${fn}()) as j`); await c.query('commit'); return send(res, 200, r.rows[0].j);
    } catch (e) { await c.query('rollback').catch(() => { }); return send(res, e.code === '42501' ? 401 : 404, { code: e.code, message: e.message }); } finally { c.release(); }
  }
  const T = 'public.' + qi(table), params = [], pref = String(req.headers.prefer || '');
  const retRep = /return=representation/.test(pref);
  let sql;
  if (req.method === 'GET') {
    let order = ''; if (q.get('order')) order = ' order by ' + q.get('order').split(',').map(o => { const [c, d, n] = o.split('.'); return qi(c) + (d === 'desc' ? ' desc' : ' asc') + (n === 'nullsfirst' ? ' nulls first' : n === 'nullslast' ? ' nulls last' : ''); }).join(',');
    const lim = q.get('limit') ? ` limit ${+q.get('limit')}` : '', off = q.get('offset') ? ` offset ${+q.get('offset')}` : '';
    sql = `select coalesce(json_agg(_r), '[]'::json) as j from (select * from ${T}${filtros(q, params)}${order}${lim}${off}) _r`;
  } else if (req.method === 'POST') {
    const rows = Array.isArray(body) ? body : [body];
    const cols = q.get('columns') ? q.get('columns').split(',').map(c => c.replace(/^"|"$/g, '')) : [...new Set(rows.flatMap(r => Object.keys(r)))];
    params.push(JSON.stringify(rows));
    const cl = cols.map(qi).join(',');
    let conflict = '';
    if (/resolution=merge-duplicates/.test(pref) || /resolution=ignore-duplicates/.test(pref)) {
      let alvo = q.get('on_conflict');
      if (!alvo) { const pk = await pool.query(`select a.attname from pg_index i join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey) where i.indrelid = $1::regclass and i.indisprimary`, [`public.${table}`]); alvo = pk.rows.map(r => r.attname).join(','); }
      const alvoCols = alvo.split(',').map(s => s.trim());
      const upd = cols.filter(c => !alvoCols.includes(c));
      conflict = ` on conflict (${alvoCols.map(qi).join(',')}) ` + (/ignore-duplicates/.test(pref) || !upd.length ? 'do nothing' : 'do update set ' + upd.map(c => `${qi(c)} = excluded.${qi(c)}`).join(','));
    }
    sql = `with _m as (insert into ${T} (${cl}) select ${cl} from json_populate_recordset(null::${T}, $1::json)${conflict} returning *) select coalesce(json_agg(_m), '[]'::json) as j from _m`;
  } else if (req.method === 'PATCH') {
    const cols = Object.keys(body); params.push(JSON.stringify(body));
    const set = cols.map(c => `${qi(c)} = _v.${qi(c)}`).join(',');
    const where = filtros(q, params);
    sql = `with _m as (update ${T} set ${set} from (select * from json_populate_record(null::${T}, $1::json)) _v${where ? where.replace(' where ', ' where ').replace(/"([a-z_0-9]+)" /g, `${T}."$1" `) : ''} returning ${T}.*) select coalesce(json_agg(_m), '[]'::json) as j from _m`;
  } else if (req.method === 'DELETE') {
    sql = `with _m as (delete from ${T}${filtros(q, params)} returning *) select coalesce(json_agg(_m), '[]'::json) as j from _m`;
  } else return send(res, 405, { message: 'método não simulado' });
  const c = await pool.connect();
  try {
    await c.query('begin');
    await c.query(`set local role ${claims.role === 'authenticated' ? 'authenticated' : claims.role === 'service_role' ? 'service_role' : 'anon'}`);
    await c.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claims', $2, true), set_config('request.jwt.claim.role', $3, true)`, [claims.sub || '', JSON.stringify(claims), claims.role]);
    const r = await c.query(sql, params);
    await c.query('commit');
    LOG.push([req.method, table]);
    if (req.method === 'GET' || retRep) return send(res, req.method === 'POST' ? 201 : 200, r.rows[0].j);
    return send(res, req.method === 'POST' ? 201 : 204);
  } catch (e) {
    await c.query('rollback').catch(() => { });
    const st = e.st || ({ '42501': claims.role === 'anon' ? 401 : 403, '23505': 409, '23503': 409, '42P01': 404 }[e.code] || 400);
    LOG.push(['ERRO', req.method, table, e.code, e.message]);
    return send(res, st, { code: e.code || 'PGRST', message: e.message, details: e.detail || null, hint: e.hint || null });
  } finally { c.release(); }
}

http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const u = new URL(req.url, 'http://x'); let body = '';
  for await (const ch of req) body += ch;
  try { body = body ? JSON.parse(body) : {}; } catch { return send(res, 400, { message: 'JSON inválido' }); }
  try {
    if (u.pathname === '/__test/otp') { const o = OTP[String(u.searchParams.get('email')).toLowerCase()]; return send(res, o ? 200 : 404, o ? { code: o.code } : {}); }
    if (u.pathname === '/__test/log') return send(res, 200, LOG.splice(0));
    if (u.pathname === '/__test/keys') return send(res, 200, { anon: ANON, service: SERVICE });
    const key = req.headers.apikey; if (key !== ANON && key !== SERVICE) return send(res, 401, { message: 'Invalid API key', hint: 'Double check your Supabase `anon` or `service_role` API key.' });
    if (u.pathname.startsWith('/auth/v1')) return await auth(req, res, u.pathname.slice(8), u.searchParams, body);
    if (u.pathname.startsWith('/rest/v1/')) {
      const tok = String(req.headers.authorization || '').replace(/^Bearer /i, '');
      const claims = tok ? verify(tok) : { role: 'anon' };
      if (!claims) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });
      return await rest(req, res, u.pathname.slice(9), u.searchParams, body, claims);
    }
    if (u.pathname.startsWith('/realtime')) return send(res, 404, {});
    return send(res, 404, { message: 'rota não simulada: ' + u.pathname });
  } catch (e) { return send(res, e.st || 500, { code: e.code || 'ERR', message: e.message }); }
}).listen(PORT, () => console.log(`supabase local em http://localhost:${PORT}  anon=${ANON.slice(0, 20)}…`));
