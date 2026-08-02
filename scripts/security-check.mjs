import fs from "node:fs";
import path from "node:path";

const ignoredDirectories = new Set([
  ".git", ".vite", "assets", "dist", "node_modules", "scratch", "taxi_sabana",
]);
const extensions = new Set([
  ".css", ".example", ".html", ".js", ".json", ".jsx", ".md",
  ".mjs", ".rules", ".sql", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);
const forbiddenPathFragments = ["fire" + "base", "fire" + "store"];
const legacyRule = { name: "Legacy backend reference", pattern: /\bfire(?:base|store)\b/gi };
const browserRules = [
  { name: "Supabase secret key", pattern: /sb_secret_[A-Za-z0-9_-]+/g },
  { name: "Service role exposed to Vite", pattern: /VITE_SUPABASE_SERVICE_KEY/g },
  { name: "Admin Auth used in browser code", pattern: /auth\.admin\./g },
  { name: "Direct Gemini browser request", pattern: /generativelanguage\.googleapis\.com/g },
  { name: "Browser-side user signup", pattern: /auth\.signUp\(/g },
  { name: "Private token exposed through Vite", pattern: /VITE_[A-Z0-9_]*(TOKEN|SECRET|PASSWORD)/g },
  { name: "Gemini key exposed through Vite", pattern: /VITE_GEMINI_API_KEY/g },
  { name: "Direct Meta Graph request from browser", pattern: /graph\.facebook\.com/g },
  { name: "Public URL generated for private attachments", pattern: /from\(["']adjuntos["']\)[\s\S]{0,180}getPublicUrl\(/g },
  { name: "Client-side configurable webhook", pattern: /VITE_N8N_WEBHOOK_URL/g },
  { name: "Cross-tenant RLS bypass", pattern: /tenant_id\s+IS\s+NOT\s+NULL/gi },
  { name: "Known default password", pattern: /@OdontoCloud2026/g },
  { name: "Gemini key persisted in localStorage", pattern: /localStorage\.setItem\([^\n]*gemini/gi },
  {
    name: "Plaintext password persisted in website config",
    pattern: /password\s*:\s*formData\.password\s*\|\|\s*userDetails/gi,
  },
];

const scriptRules = [
  {
    name: "Hard-coded password in diagnostic script",
    pattern: /\b(?:password|new_password)\s*(?::|=)\s*["'][^"'\r\n]{6,}["']/gi,
  },
];
const files = [];
const failures = [];
const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    const normalizedPath = fullPath.replaceAll("\\", "/").toLowerCase();
    if (forbiddenPathFragments.some((fragment) => normalizedPath.includes(fragment))) {
      failures.push(fullPath + " - Legacy backend path");
    }
    if (entry.isDirectory()) walk(fullPath);
    else if (extensions.has(path.extname(entry.name).toLowerCase())) files.push(fullPath);
  }
};
walk(".");

const reportMatches = (file, contents, rule) => {
  rule.pattern.lastIndex = 0;
  let match;
  while ((match = rule.pattern.exec(contents)) !== null) {
    const line = contents.slice(0, match.index).split("\n").length;
    failures.push(file + ":" + line + " - " + rule.name);
  }
};

for (const file of files) {
  const contents = fs.readFileSync(file, "utf8");
  reportMatches(file, contents, legacyRule);
  const normalized = file.replaceAll("\\", "/").toLowerCase();
  const isBrowserSurface = normalized.startsWith("src/") || normalized.startsWith(".github/");
  const isSecurityMigration = normalized.endsWith("20260801_security_hardening.sql") || normalized.endsWith("20260802_agenda_rls_policies.sql") || normalized.endsWith("20260803_production_agenda_availability.sql");
  if (isBrowserSurface || isSecurityMigration) {
    browserRules.forEach((rule) => reportMatches(file, contents, rule));
  }
  if (normalized.startsWith("scripts/") && !normalized.endsWith("security-check.mjs")) {
    scriptRules.forEach((rule) => reportMatches(file, contents, rule));
  }
}

if (failures.length) {
  console.error("Security check failed:\n" + failures.join("\n"));
  process.exit(1);
}
console.log("Security check passed (" + files.length + " managed files scanned). Legacy backend guard enabled.");