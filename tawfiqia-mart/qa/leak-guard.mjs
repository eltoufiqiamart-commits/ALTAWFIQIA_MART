#!/usr/bin/env node
/**
 * STATIC PRIVATE-DATA LEAK GUARD
 *
 * Runs without a database or a browser, so it can gate every build.
 *
 * It enforces the invariants from sections 12, 23, 30 and 33 of the hardening
 * task by reading the source tree:
 *
 *  1. No customer-facing query may use `select("*")` on a table that carries
 *     admin-only columns (order_items, payments, returns, products, suppliers).
 *  2. No private identifier (supplier cost/phone/address, receipt_path,
 *     cost_amount) may appear in a customer-facing component or page.
 *  3. The publicly executable rate-limit RPC must not accept caller-chosen
 *     limits (`check_rate_limit` must stay revoked).
 *  4. Every SECURITY DEFINER function must pin `search_path`.
 *
 * Exit code 0 = clean, 1 = findings.
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const findings = [];
const add = (sev, file, msg) => findings.push({ sev, file, msg });

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (entry === "node_modules" || entry === ".next") continue;
    if (statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

const files = walk(path.join(ROOT, "src"));
const sqlFiles = walk(path.join(ROOT, "supabase", "migrations")).filter((f) =>
  f.endsWith(".sql"),
);

// Paths that render for customers. Admin surfaces are allowed to read private data.
const isCustomerFacing = (f) =>
  (f.includes(path.join("app", "(shop)")) ||
    f.includes(path.join("components", "account")) ||
    f.includes(path.join("components", "orders")) ||
    f.includes(path.join("components", "product")) ||
    f.includes(path.join("components", "catalog")) ||
    f.includes(path.join("components", "checkout")) ||
    f.includes(path.join("components", "cart")) ||
    f.includes(path.join("lib", "server", "actions"))) &&
  !f.includes(path.join("app", "admin"));

// ---------------------------------------------------------------------------
// 1. Wildcard selects on tables with admin-only columns
// ---------------------------------------------------------------------------
const SENSITIVE_TABLES = ["order_items", "payments", "returns", "products", "suppliers"];

for (const file of files.filter((f) => /\.tsx?$/.test(f) && isCustomerFacing(f))) {
  const src = readFileSync(file, "utf8");
  const lines = src.split("\n");
  lines.forEach((line, i) => {
    for (const table of SENSITIVE_TABLES) {
      // `.from("payments")` followed by a wildcard select on the same or next lines
      if (line.includes(`from("${table}")`)) {
        const window = lines.slice(i, i + 4).join(" ");
        if (/\.select\(\s*["'`]\*/.test(window)) {
          add(
            "HIGH",
            path.relative(ROOT, file),
            `line ${i + 1}: select("*") on "${table}" in customer-facing code — list columns explicitly`,
          );
        }
      }
    }
  });
}

// ---------------------------------------------------------------------------
// 2. Private field names referenced in customer-facing code
// ---------------------------------------------------------------------------
const PRIVATE_FIELDS = [
  "cost_amount",
  "cost_amount_at_order",
  "supplier_phone_at_order",
  "supplier_address_at_order",
  "supplier_name_at_order",
  "supplier_shop_name_at_order",
  "supplier_id_at_order",
  "receipt_path",
  "admin_note",
];

for (const file of files.filter((f) => /\.tsx?$/.test(f) && isCustomerFacing(f))) {
  const src = readFileSync(file, "utf8");
  src.split("\n").forEach((line, i) => {
    // Ignore comments — several fixes document the field name on purpose.
    const code = line.replace(/\/\/.*$/, "").replace(/\/\*.*?\*\//g, "");
    if (/^\s*\*/.test(line)) return;
    for (const field of PRIVATE_FIELDS) {
      if (!code.includes(field)) continue;
      // A customer WRITING their own receipt path is legitimate (ownership is
      // validated server-side); the risk is READING private data back out.
      // `p_receipt_path:` / `receiptPath` are RPC write parameters.
      const isWriteParam = /p_receipt_path|receiptPath/.test(code);
      if (isWriteParam) continue;
      add(
        "HIGH",
        path.relative(ROOT, file),
        `line ${i + 1}: private field "${field}" referenced in customer-facing code`,
      );
    }
  });
}

// ---------------------------------------------------------------------------
// 3. The caller-controlled limiter must not be publicly executable
// ---------------------------------------------------------------------------
const allSql = sqlFiles.map((f) => readFileSync(f, "utf8")).join("\n");
const grantsLegacy = /grant\s+execute\s+on\s+function\s+public\.check_rate_limit[^;]*to[^;]*(anon|authenticated)/i;
const revokesLegacy = /revoke\s+execute\s+on\s+function\s+public\.check_rate_limit[^;]*from[^;]*(anon|authenticated)/i;
if (grantsLegacy.test(allSql) && !revokesLegacy.test(allSql)) {
  add("BLOCKER", "supabase/migrations", "check_rate_limit is granted to anon/authenticated and never revoked");
}
for (const file of files.filter((f) => /\.tsx?$/.test(f))) {
  const src = readFileSync(file, "utf8");
  if (/rpc\(\s*["'`]check_rate_limit/.test(src)) {
    add(
      "BLOCKER",
      path.relative(ROOT, file),
      "calls check_rate_limit directly — use consume_rate_limit (server-owned limits)",
    );
  }
}

// ---------------------------------------------------------------------------
// 4. SECURITY DEFINER functions must pin search_path
// ---------------------------------------------------------------------------
for (const file of sqlFiles) {
  const src = readFileSync(file, "utf8");
  const blocks = src.split(/create\s+or\s+replace\s+function/i).slice(1);
  for (const block of blocks) {
    const head = block.slice(0, block.indexOf("$$") === -1 ? 400 : block.indexOf("$$"));
    const name = (block.match(/^\s*([\w.]+)\s*\(/) ?? [, "?"])[1];
    if (/security\s+definer/i.test(head) && !/set\s+search_path/i.test(head)) {
      add(
        "BLOCKER",
        path.relative(ROOT, file),
        `function ${name} is SECURITY DEFINER without "set search_path"`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Report
// ---------------------------------------------------------------------------
const order = { BLOCKER: 0, HIGH: 1, MEDIUM: 2 };
findings.sort((a, b) => order[a.sev] - order[b.sev]);

if (findings.length === 0) {
  console.log("LEAK GUARD: 0 findings");
  console.log(`  scanned ${files.length} source files, ${sqlFiles.length} migrations`);
  process.exit(0);
}

console.log(`LEAK GUARD: ${findings.length} finding(s)\n`);
for (const f of findings) {
  console.log(`  [${f.sev}] ${f.file}\n          ${f.msg}`);
}
process.exit(1);
