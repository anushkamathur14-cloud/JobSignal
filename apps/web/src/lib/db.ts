import path from "path";
import fs from "fs";
import { createClient, type Client } from "@libsql/client";
import { drizzle, type LibSQLDatabase } from "drizzle-orm/libsql";
import * as schema from "@job-signal/db";

function resolveLocalDbPath() {
  const env = process.env.DATABASE_URL;
  if (env?.startsWith("file:")) {
    const p = env.slice(5);
    return path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
  }
  if (process.env.VERCEL) {
    return "/tmp/job-signal.db";
  }
  const candidates = [
    path.resolve(process.cwd(), "../../data/job-signal.db"),
    path.resolve(process.cwd(), "data/job-signal.db"),
    path.resolve(__dirname, "../../../../data/job-signal.db"),
  ];
  return candidates[0];
}

function createDbClient(): { client: Client; dbPath: string; url: string } {
  const tursoUrl = process.env.TURSO_DATABASE_URL;
  if (tursoUrl) {
    return {
      client: createClient({
        url: tursoUrl,
        authToken: process.env.TURSO_AUTH_TOKEN,
      }),
      dbPath: tursoUrl,
      url: tursoUrl,
    };
  }

  const dbPath = resolveLocalDbPath();
  if (!dbPath.startsWith("/tmp")) {
    fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  }
  const url = `file:${dbPath}`;
  return { client: createClient({ url }), dbPath, url };
}

const { client, dbPath, url } = createDbClient();

export const db = drizzle(client, { schema }) as LibSQLDatabase<typeof schema>;
export { client, dbPath, schema, url };

export type AppDb = typeof db;
