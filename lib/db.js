// Server-side Postgres access. The whole app state is one JSONB row, which
// keeps reads and writes as simple as the localStorage version they replaced
// while leaving room to split days/counts into real tables later.

import { neon } from "@neondatabase/serverless";

const STATE_ID = "default";

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
    ]).catch((err) => {
      schemaReady = null;
      throw err;
    });
  }
  return schemaReady;
}

export async function readState() {
  const sql = connect();
  await ensureSchema(sql);
  const rows = await sql`select data from app_state where id = ${STATE_ID}`;
  return rows.length ? rows[0].data : null;
}

export async function writeState(data) {
  const sql = connect();
  await ensureSchema(sql);
  await sql`
    insert into app_state (id, data, updated_at)
    values (${STATE_ID}, ${JSON.stringify(data)}::jsonb, now())
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
