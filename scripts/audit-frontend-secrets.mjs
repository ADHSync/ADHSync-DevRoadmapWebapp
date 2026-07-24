import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const projectRoot = process.cwd();
const scanRoots = ["src", "dist"];
const standaloneFiles = ["index.html"];
const textExtensions = new Set([
  ".css",
  ".html",
  ".js",
  ".jsx",
  ".json",
  ".map",
  ".ts",
  ".tsx",
]);
const allowedFrontendEnvironmentVariables = new Set([
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_ANON_KEY",
]);
const forbiddenPatterns = [
  {
    label: "Server-Umgebungsvariable",
    expression:
      /\b(?:PUBLISH_SECRET|ANTHROPIC_API_KEY|SUPABASE_SERVICE_ROLE_KEY)\b/g,
  },
  {
    label: "Anthropic-/OpenAI-Schlüssel",
    expression: /\bsk-(?:ant-|proj-)?[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: "Supabase-Secret-Key",
    expression: /\bsb_secret_[A-Za-z0-9_-]{20,}\b/g,
  },
  {
    label: "GitHub-Token",
    expression:
      /\b(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g,
  },
];
const jwtPattern =
  /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/g;

function jwtRole(token) {
  const payload = token.split(".")[1];

  if (!payload) {
    return undefined;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(payload, "base64url").toString("utf8"),
    );
    return typeof parsed.role === "string" ? parsed.role : undefined;
  } catch {
    return undefined;
  }
}

async function collectFiles(path) {
  const entries = await readdir(path, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const entryPath = join(path, entry.name);

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(entryPath)));
    } else if (textExtensions.has(extname(entry.name))) {
      files.push(entryPath);
    }
  }

  return files;
}

const files = [
  ...(
    await Promise.all(
      scanRoots.map((root) => collectFiles(join(projectRoot, root))),
    )
  ).flat(),
  ...standaloneFiles.map((file) => join(projectRoot, file)),
  ...(await readdir(projectRoot, { withFileTypes: true }))
    .filter(
      (entry) =>
        entry.isFile() &&
        (entry.name === ".env" || entry.name.startsWith(".env.")),
    )
    .map((entry) => join(projectRoot, entry.name)),
];
const findings = [];

for (const file of files) {
  const content = await readFile(file, "utf8");
  const displayPath = relative(projectRoot, file);

  for (const { label, expression } of forbiddenPatterns) {
    if (expression.test(content)) {
      findings.push(`${displayPath}: ${label}`);
    }

    expression.lastIndex = 0;
  }

  for (const match of content.matchAll(jwtPattern)) {
    if (match[0] && jwtRole(match[0]) !== "anon") {
      findings.push(`${displayPath}: nicht öffentlicher JWT`);
    }
  }

  if (displayPath.startsWith("src/") || displayPath.startsWith(".env")) {
    for (const match of content.matchAll(/import\.meta\.env\.([A-Z0-9_]+)/g)) {
      const variableName = match[1];

      if (
        variableName &&
        !allowedFrontendEnvironmentVariables.has(variableName)
      ) {
        findings.push(
          `${displayPath}: nicht freigegebene Frontend-Variable ${variableName}`,
        );
      }
    }
  }

  if (displayPath.startsWith(".env")) {
    for (const match of content.matchAll(
      /^\s*(?:export\s+)?(VITE_[A-Z0-9_]+)\s*=/gm,
    )) {
      const variableName = match[1];

      if (
        variableName &&
        !allowedFrontendEnvironmentVariables.has(variableName)
      ) {
        findings.push(
          `${displayPath}: nicht freigegebene Frontend-Variable ${variableName}`,
        );
      }
    }
  }
}

if (findings.length > 0) {
  console.error("Frontend-Secret-Audit fehlgeschlagen:");
  findings.forEach((finding) => console.error(`- ${finding}`));
  process.exitCode = 1;
} else {
  console.log(
    `Frontend-Secret-Audit bestanden: ${files.length} Dateien geprüft; ` +
      "nur VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY sind freigegeben.",
  );
}
