import { defineConfig } from "drizzle-kit";

// `drizzle-kit generate` works offline from the schema; only commands that
// talk to the database (migrate, push, studio) need DATABASE_URL.
const connectionString = process.env.DATABASE_URL;

export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  ...(connectionString ? { dbCredentials: { url: connectionString } } : {}),
});
