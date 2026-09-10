// Server-side Postgres access. Each location's app state is one JSONB row
// keyed by tenant, which keeps reads and writes as simple as the single-shop
// version they grew out of.

import { neon } from "@neondatabase/serverless";
import { hashPassword } from "./passwords";

// The single-shop era wrote its state under this id. It becomes the first
// tenant so nothing is lost.
export const LEGACY_TENANT_ID = "default";

let schemaReady = null;

function connect() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  return neon(url);
}

// Cached per lambda instance. A rejection clears the cache so a transient
// failure doesn't poison every later request.
function ensureSchema(sql) {
  if (!schemaReady) {
    schemaReady = Promise.all([
      sql`
        create table if not exists app_state (
          id text primary key,
          data jsonb not null,
          updated_at timestamptz not null default now()
        )
      `,
      sql`
        create table if not exists auth_throttle (
          id text primary key,
          fails integer not null default 0,
          locked_until timestamptz
        )
      `,
      sql`
        create table if not exists tenants (
          id text primary key,
          name text not null,
          created_at timestamptz not null default now()
        )
      `,
      sql`
        create table if not exists owners (
          id text primary key,
          tenant_id text,
          email text not null unique,
          password_hash text not null,
          role text not null default 'owner',
          created_at timestamptz not null default now()
        )
      `,
    ])
      .then(() => migrateLegacyTenant(sql))
      .then(() => seedFranchisor(sql))
      .catch((err) => {
        schemaReady = null;
        throw err;
      });
  }
  return schemaReady;
}

// Adopt the pre-multi-tenant state row as the first location, taking its name
// from whatever the shop was already called.
async function migrateLegacyTenant(sql) {
  const rows = await sql`
    select data->'settings'->>'shopName' as name
    from app_state where id = ${LEGACY_TENANT_ID}
  `;
  if (!rows.length) return;
  await sql`
    insert into tenants (id, name)
    values (${LEGACY_TENANT_ID}, ${rows[0].name || "My kiosk"})
    on conflict (id) do nothing
  `;
}

// One franchisor, configured by environment rather than self-serve signup.
async function seedFranchisor(sql) {
  const email = (process.env.FRANCHISOR_EMAIL || "").trim().toLowerCase();
  const password = process.env.APP_PASSWORD;
  if (!email || !password) return;

  const existing = await sql`select id from owners where role = 'franchisor' limit 1`;
  if (existing.length) return;

  await sql`
    insert into owners (id, tenant_id, email, password_hash, role)
    values (${`owner-franchisor`}, null, ${email}, ${await hashPassword(password)}, 'franchisor')
    on conflict (email) do nothing
  `;
}

// ---------------------------------------------------------------------------
// Tenants and owners
// ---------------------------------------------------------------------------

export async function createTenantWithOwner({ tenantId, name, ownerId, email, passwordHash }) {
  const sql = connect();
  await ensureSchema(sql);
  const existing = await sql`select id from owners where email = ${email}`;
  if (existing.length) return { error: "taken" };

  await sql`insert into tenants (id, name) values (${tenantId}, ${name})`;
  await sql`
    insert into owners (id, tenant_id, email, password_hash, role)
    values (${ownerId}, ${tenantId}, ${email}, ${passwordHash}, 'owner')
  `;
  return { ok: true };
}

export async function findOwnerByEmail(email) {
  const sql = connect();
  await ensureSchema(sql);
  const rows = await sql`
    select id, tenant_id, email, password_hash, role
    from owners where email = ${email}
  `;
  return rows.length ? rows[0] : null;
}

export async function listTenants() {
  const sql = connect();
  await ensureSchema(sql);
  return sql`select id, name, created_at from tenants order by name asc`;
}

export async function tenantExists(tenantId) {
  const sql = connect();
  await ensureSchema(sql);
  const rows = await sql`select id from tenants where id = ${tenantId}`;
  return rows.length > 0;
}

export async function readAllStates() {
  const sql = connect();
  await ensureSchema(sql);
  return sql`
    select t.id, t.name, s.data
    from tenants t left join app_state s on s.id = t.id
    order by t.name asc
  `;
}

// Staff sign in with a PIN alone, so it has to be unique across every
// location. Both of these look across all tenants for that reason.
export async function findTenantsWithPin(pin) {
  const sql = connect();
  await ensureSchema(sql);
  const rows = await sql`
    select id, data from app_state
    where data->'settings'->'staff' @> ${JSON.stringify([{ pin }])}::jsonb
  `;
  return rows;
}

export async function collectUsedPins() {
  const sql = connect();
  await ensureSchema(sql);
  const rows = await sql`
    select jsonb_array_elements(data->'settings'->'staff')->>'pin' as pin
    from app_state
  `;
  return new Set(rows.map((r) => r.pin).filter(Boolean));
}

export async function readState(tenantId) {
  const sql = connect();
  await ensureSchema(sql);
  const rows = await sql`select data from app_state where id = ${tenantId}`;
  return rows.length ? rows[0].data : null;
}

export async function writeState(tenantId, data) {
  const sql = connect();
  await ensureSchema(sql);
  await sql`
    insert into app_state (id, data, updated_at)
    values (${tenantId}, ${JSON.stringify(data)}::jsonb, now())
    on conflict (id) do update set data = excluded.data, updated_at = now()
  `;
}

// ---------------------------------------------------------------------------
// Login throttling
// ---------------------------------------------------------------------------
//
// A 5-digit PIN is only 90,000 possibilities, so guessing has to be made
// expensive in wall-clock time. Counters live in Postgres because serverless
// instances don't share memory.

const FAILS_BEFORE_LOCK = 5;
const LOCK_STEP_MINUTES = 5;
const MAX_LOCK_MINUTES = 15;

export async function getLockRemainingSeconds(key) {
  const sql = connect();
  await ensureSchema(sql);
  const rows = await sql`
    select greatest(0, ceil(extract(epoch from (locked_until - now()))))::int as seconds
    from auth_throttle
    where id = ${key} and locked_until is not null and locked_until > now()
  `;
  return rows.length ? rows[0].seconds : 0;
}

export async function registerFailedAttempt(key) {
  const sql = connect();
  await ensureSchema(sql);
  const rows = await sql`
    insert into auth_throttle (id, fails) values (${key}, 1)
    on conflict (id) do update set fails = auth_throttle.fails + 1
    returning fails
  `;
  const fails = rows[0].fails;
  if (fails % FAILS_BEFORE_LOCK !== 0) return 0;

  const minutes = Math.min(MAX_LOCK_MINUTES, (fails / FAILS_BEFORE_LOCK) * LOCK_STEP_MINUTES);
  await sql`
    update auth_throttle
    set locked_until = now() + (${minutes} * interval '1 minute')
    where id = ${key}
  `;
  return minutes * 60;
}

export async function clearFailedAttempts(key) {
  const sql = connect();
  await ensureSchema(sql);
  await sql`delete from auth_throttle where id = ${key}`;
}
