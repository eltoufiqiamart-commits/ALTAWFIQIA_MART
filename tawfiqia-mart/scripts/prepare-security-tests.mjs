#!/usr/bin/env node
/**
 * Prepares docs/SECURITY-TESTS.sql for a live run by substituting the two
 * customer UUID placeholders. Nothing is executed here: the output file is
 * meant to be pasted into the Supabase SQL Editor (every block rolls back).
 *
 * Usage:
 *   node scripts/prepare-security-tests.mjs <CUSTOMER_A_UUID> <CUSTOMER_B_UUID>
 *
 * Output: docs/SECURITY-TESTS.ready.sql (git-ignored; contains real user ids)
 */
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-9a-f][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const [, , a, b] = process.argv;

if (!a || !b) {
  console.error(
    "Usage: node scripts/prepare-security-tests.mjs <CUSTOMER_A_UUID> <CUSTOMER_B_UUID>\n" +
      "Get them from Supabase: select id, email from auth.users order by created_at limit 5;"
  );
  process.exit(1);
}

for (const [label, value] of [
  ["CUSTOMER_A", a],
  ["CUSTOMER_B", b],
]) {
  if (!UUID_RE.test(value)) {
    console.error(`${label} is not a valid UUID: ${value}`);
    process.exit(1);
  }
}

if (a.toLowerCase() === b.toLowerCase()) {
  console.error("CUSTOMER_A and CUSTOMER_B must be two DIFFERENT users — the suite tests cross-user isolation.");
  process.exit(1);
}

const root = process.cwd();
const src = path.join(root, "docs", "SECURITY-TESTS.sql");
const out = path.join(root, "docs", "SECURITY-TESTS.ready.sql");

const original = await readFile(src, "utf8");
const filled = original
  .replaceAll("REPLACE_WITH_CUSTOMER_A_UUID", a.toLowerCase())
  .replaceAll("REPLACE_WITH_CUSTOMER_B_UUID", b.toLowerCase());

const remaining = (filled.match(/REPLACE_WITH_/g) ?? []).length;
if (remaining > 0) {
  console.error(`Still ${remaining} unresolved placeholder(s) — aborting.`);
  process.exit(1);
}

await writeFile(out, filled, "utf8");

const countA = (original.match(/REPLACE_WITH_CUSTOMER_A_UUID/g) ?? []).length;
const countB = (original.match(/REPLACE_WITH_CUSTOMER_B_UUID/g) ?? []).length;

console.log(`Wrote ${path.relative(root, out)}`);
console.log(`  customer A substitutions: ${countA}`);
console.log(`  customer B substitutions: ${countB}`);
console.log("");
console.log("Next: open Supabase Studio -> SQL Editor, paste the file, run it top to bottom.");
console.log("Every part is wrapped in a transaction that rolls back; no data is modified.");
console.log("Expected: every result row reads PASS. Any FAIL must be fixed before launch.");
console.log("Delete the .ready.sql file afterwards — it embeds real user ids.");
