import { mkdirSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { PGlite } from "@electric-sql/pglite";
import postgres from "postgres";

export type Row = Record<string, unknown>;

export interface Db {
  query<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  exec(sql: string): Promise<void>;
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
  close(): Promise<void>;
}

type PostgresClient = ReturnType<typeof postgres>;

function splitSql(script: string): string[] {
  return script
    .split(/;\s*(?:\n|$)/)
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !part.startsWith("--"));
}

export async function migrate(db: Db): Promise<string[]> {
  await db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);
  const dir = path.join(process.cwd(), "db", "migrations");
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    const existing = await db.query<{ version: string }>(
      "SELECT version FROM schema_migrations WHERE version = $1",
      [file],
    );
    if (existing.length > 0) continue;
    const script = readFileSync(path.join(dir, file), "utf8");
    const statements = splitSql(script).filter(
      (statement) => !/CREATE TABLE schema_migrations/i.test(statement),
    );
    await db.tx(async (tx) => {
      for (const statement of statements) {
        await tx.exec(statement);
      }
      await tx.query("INSERT INTO schema_migrations (version) VALUES ($1)", [file]);
    });
    applied.push(file);
  }
  return applied;
}

function wrapPostgres(sql: PostgresClient): Db {
  return {
    async query<T = Row>(text: string, params: unknown[] = []) {
      const rows = await sql.unsafe(text, params as never[]);
      return [...rows] as T[];
    },
    async exec(text) {
      const statements = splitSql(text);
      for (const statement of statements) {
        await sql.unsafe(statement);
      }
    },
    async tx(fn) {
      return sql.begin(async (transaction) => {
        const inner: Db = {
          async query<T = Row>(text: string, params: unknown[] = []) {
            const rows = await transaction.unsafe(text, params as never[]);
            return [...rows] as T[];
          },
          async exec(text) {
            for (const statement of splitSql(text)) {
              await transaction.unsafe(statement);
            }
          },
          tx: (nested) => nested(inner),
          close: async () => undefined,
        };
        return fn(inner);
      }) as Promise<Awaited<ReturnType<typeof fn>>>;
    },
    async close() {
      await sql.end({ timeout: 5 });
    },
  };
}

function wrapPglite(pg: PGlite): Db {
  return {
    async query<T = Row>(text: string, params: unknown[] = []) {
      const result = await pg.query(text, params);
      return result.rows as T[];
    },
    async exec(text) {
      await pg.exec(text);
    },
    async tx(fn) {
      return pg.transaction(async (transaction) => {
        const inner: Db = {
          async query<T = Row>(text: string, params: unknown[] = []) {
            const result = await transaction.query(text, params);
            return result.rows as T[];
          },
          async exec(text) {
            await transaction.exec(text);
          },
          tx: (nested) => nested(inner),
          close: async () => undefined,
        };
        return fn(inner);
      });
    },
    async close() {
      await pg.close();
    },
  };
}

export async function createPostgres(databaseUrl: string): Promise<Db> {
  const sql = postgres(databaseUrl, {
    max: 8,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
  });
  return wrapPostgres(sql);
}

export async function createPglite(dataDir?: string): Promise<Db> {
  const pg = dataDir ? new PGlite(dataDir) : new PGlite();
  await pg.waitReady;
  return wrapPglite(pg);
}

const globalDb = globalThis as unknown as { __smackinDb?: Promise<Db> };

export function databaseUrl(): string | undefined {
  const value = process.env.DATABASE_URL?.trim();
  return value ? value : undefined;
}

export async function getDb(): Promise<Db> {
  if (!globalDb.__smackinDb) {
    globalDb.__smackinDb = (async () => {
      const url = databaseUrl();
      if (url) return createPostgres(url);
      if (process.env.REQUIRE_POSTGRES === "true") {
        throw new Error("DATABASE_URL is required when REQUIRE_POSTGRES=true");
      }
      const dir = path.join(process.cwd(), ".data", "pglite");
      mkdirSync(dir, { recursive: true });
      return createPglite(dir);
    })();
  }
  return globalDb.__smackinDb;
}

export function jsonParam(value: unknown): string {
  return JSON.stringify(value);
}

export function asObject(value: unknown): Record<string, unknown> {
  if (typeof value === "string") {
    return JSON.parse(value) as Record<string, unknown>;
  }
  if (value && typeof value === "object") return value as Record<string, unknown>;
  return {};
}

export function asArray(value: unknown): unknown[] {
  if (typeof value === "string") return JSON.parse(value) as unknown[];
  if (Array.isArray(value)) return value;
  return [];
}

export function text(row: Row, key: string): string {
  const value = row[key];
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  throw new Error(`Missing text column ${key}`);
}

export function bool(row: Row, key: string): boolean {
  const value = row[key];
  if (typeof value === "boolean") return value;
  if (value === "t" || value === "true") return true;
  if (value === "f" || value === "false") return false;
  throw new Error(`Missing boolean column ${key}`);
}

export function nullableText(row: Row, key: string): string | null {
  const value = row[key];
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  return String(value);
}
