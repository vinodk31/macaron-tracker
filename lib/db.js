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
    schemaReady = sql`
      create table if not exists app_state (
        id text primary key,
        data jsonb not null,
        updated_at timestamptz not null default now()
      )
    `.catch((err) => {
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
