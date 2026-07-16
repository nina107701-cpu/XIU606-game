import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";

let databaseBinding: D1Database | undefined;

export function setDbBinding(binding: D1Database) {
  databaseBinding = binding;
}

export function getDb() {
  if (!databaseBinding) {
    throw new Error(
      "Cloudflare D1 binding `DB` is unavailable. The Worker must attach it before handling application routes."
    );
  }

  return drizzle(databaseBinding, { schema });
}
