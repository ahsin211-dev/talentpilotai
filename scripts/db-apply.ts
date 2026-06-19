/**
 * db-apply — applies the local bootstrap + ordered migrations to a PostgreSQL
 * database. Used for local development and by the RLS/security test-suite.
 *
 *   npm run db:setup           # apply bootstrap + migrations
 *   npm run db:reset           # drop & recreate the `public` schema first
 *
 * Connection comes from DATABASE_URL (see .env.example). On a real Supabase
 * project you would instead use `supabase db push`; the bootstrap file is
 * skipped there because Supabase already provides the auth schema + roles.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "pg";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");
const MIGRATIONS_DIR = join(ROOT, "supabase", "migrations");
const BOOTSTRAP = join(ROOT, "supabase", "tests", "00_local_bootstrap.sql");

const DEFAULT_URL =
  "postgresql://ubuntu@/talentpilot?host=/var/run/postgresql";

export async function applyAll(
  connectionString: string = process.env.DATABASE_URL || DEFAULT_URL,
  { reset = false, bootstrap = true }: { reset?: boolean; bootstrap?: boolean } = {},
): Promise<void> {
  const client = new Client({ connectionString });
  await client.connect();
  try {
    if (reset) {
      await client.query("drop schema if exists public cascade;");
      await client.query("create schema public;");
      // Local-only: the bootstrap recreates the auth schema fresh. NEVER run
      // with reset against a real Supabase project.
      if (bootstrap) {
        await client.query("drop schema if exists auth cascade;");
      }
    }

    if (bootstrap) {
      await client.query(readFileSync(BOOTSTRAP, "utf8"));
    }

    const files = readdirSync(MIGRATIONS_DIR)
      .filter((f) => f.endsWith(".sql"))
      .sort();

    for (const file of files) {
      const sql = readFileSync(join(MIGRATIONS_DIR, file), "utf8");
      await client.query(sql);
      // eslint-disable-next-line no-console
      console.log(`applied ${file}`);
    }
  } finally {
    await client.end();
  }
}

// Run directly (not when imported by tests).
const invokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const reset = process.argv.includes("--reset");
  applyAll(undefined, { reset })
    .then(() => console.log("done"))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
