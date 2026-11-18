#!/usr/bin/env node
import { existsSync, readFileSync, readdirSync, realpathSync, statSync } from "node:fs";
import { dirname, isAbsolute, join, relative, resolve, sep, win32 } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Fast, zero-dependency structural validator for C4 Markdown documentation.
 *
 * Author: Michael Christensen
 */

export const DEFAULT_C4_DIR = "docs/c4";

const REQUIRED_LEVELS = [
  { file: "01-context.md", label: "System Context" },
  { file: "02-containers.md", label: "Container" },
  { file: "03-components.md", label: "Component" },
];

const OPTIONAL_CODE_FILE = "04-code.md";

const VALID_STATUSES = new Set(["draft", "proposed", "accepted", "verified"]);

const LEVEL_DIAGRAM_KINDS = /^(C4Context|C4Container|C4Component|flowchart|graph)\b/;
const CODE_DIAGRAM_KINDS =
  /^(C4Context|C4Container|C4Component|flowchart|graph|sequenceDiagram|classDiagram|stateDiagram(?:-v2)?|erDiagram)\b/;

function readText(filePath) {
  try {
    return readFileSync(filePath, "utf8");
  } catch {
    return undefined;
  }
}

function displayPath(root, filePath) {
  return relative(root, filePath).split(sep).join("/");
}

/**
 * Returns lines outside fenced code blocks while preserving line indices.
 * @param {string} body
 * @returns {string[]}
 */
function proseLines(body) {
  let fence = null;
  return body.split(/\r?\n/).map((line) => {
    const marker = line.match(/^\s{0,3}(`{3,}|~{3,})/);
    if (marker?.[1]) {
      const token = marker[1];
      if (!fence) {
        fence = { char: token[0], length: token.length };
      } else if (
        token[0] === fence.char &&
        token.length >= fence.length &&
        /^\s*$/.test(line.slice(marker[0].length))
      ) {
        fence = null;
      }
      return "";
    }
    return fence ? "" : line;
  });
}

function firstField(body, name) {
  const plain = proseLines(body).join("\n").replace(/\*\*/g, "");
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = plain.match(
    new RegExp(`^\\s*[-*]?\\s*${escaped}\\s*:\\s*(.+?)\\s*$`, "mi"),
  );
  return match?.[1]?.trim();
}

function allFields(body, name) {
  const lines = proseLines(body);
  const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`^\\s*[-*]?\\s*${escaped}\\s*:\\s*(.*?)\\s*$`, "i");
  const values = [];
  for (const rawLine of lines) {
    const clean = rawLine.replace(/\*\*/g, "");
    const match = clean.match(pattern);
    if (match) {
      values.push((match[1] ?? "").trim());
    }
  }
  return values;
}

function extractMermaidBlocks(body) {
  const blocks = [];
  let unclosed = false;
  let inMermaid = false;
  let fenceLength = 0;
  let current = [];

  for (const line of body.split(/\r?\n/)) {
    if (!inMermaid) {
      const open = line.match(/^\s{0,3}(`{3,})mermaid(?:\s.*)?$/i);
      if (open?.[1]) {
        inMermaid = true;
        fenceLength = open[1].length;
        current = [];
      }
      continue;
    }

    const close = line.match(new RegExp(`^\\s{0,3}\`{${fenceLength},}\\s*$`));
    if (close) {
      blocks.push(current.join("\n"));
      inMermaid = false;
      fenceLength = 0;
      current = [];
    } else {
      current.push(line);
    }
  }

  if (inMermaid) {
    unclosed = true;
  }

  return { blocks, unclosed };
}

function diagramKind(diagram, pattern) {
  const first = diagram
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0 && !line.startsWith("%%"));
  return first?.match(pattern)?.[1];
}

function hasRelationship(diagram) {
  return /\b(?:Bi)?Rel(?:_[A-Za-z]+)?\s*\(/.test(diagram) || /-->|---|==>|-\.->|->>|-->>|<--/.test(diagram);
}

function hasBalancedBraces(diagram) {
  let depth = 0;

  for (const line of diagram.split(/\r?\n/)) {
    if (line.trim().startsWith("%%")) {
      continue;
    }
    // Mermaid strings are double-quoted and never span lines; an apostrophe in
    // unquoted text (e.g. `title Bob's System`) must not open a string.
    let inQuote = false;
    for (const ch of line) {
      if (ch === '"') {
        inQuote = !inQuote;
        continue;
      }
      if (inQuote) {
        continue;
      }
      if (ch === "{") {
        depth++;
      } else if (ch === "}") {
        depth--;
        if (depth < 0) {
          return false;
        }
      }
    }
  }

  return depth === 0;
}

function checkMetadata(body, shownPath, issues) {
  for (const name of ["Status", "Owner", "Last reviewed"]) {
    const value = firstField(body, name);
    if (!value) {
      issues.push({
        code: "c4/missing-metadata",
        file: shownPath,
        message: `missing "${name}"`,
      });
      continue;
    }

    if (name === "Status" && !VALID_STATUSES.has(value)) {
      issues.push({
        code: "c4/invalid-status",
        file: shownPath,
        message: `"${value}" is not one of ${Array.from(VALID_STATUSES).join(", ")}`,
      });
    }

    if (
      name === "Last reviewed" &&
      (!/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0, 10) !== value)
    ) {
      issues.push({
        code: "c4/invalid-date",
        file: shownPath,
        message: `"${value}" is not a valid YYYY-MM-DD date`,
      });
    }
  }
}

function markdownLinks(body) {
  const links = [];
  // Skip fenced blocks and inline code spans so documented link syntax is not checked.
  const prose = proseLines(body)
    .join("\n")
    .replace(/(`+)[^`]*?\1/g, "");
  const pattern = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let match;
  while ((match = pattern.exec(prose)) !== null) {
    links.push({ label: match[1] ?? "", target: match[2] ?? "" });
  }
  return links;
}

/**
 * Returns the local file part of a link target, or undefined for external
 * URLs (any scheme), protocol-relative URLs, and pure anchors. Single-letter
 * "schemes" are left alone because they are Windows drive letters.
 */
function localLinkPath(target) {
  if (/^([a-z][a-z0-9+.-]+:|\/\/|#)/i.test(target)) {
    return undefined;
  }
  const clean = target.split(/[?#]/)[0];
  if (!clean) {
    return undefined;
  }
  try {
    return decodeURIComponent(clean);
  } catch {
    return clean;
  }
}

function checkLinks(root, filePath, body, issues) {
  const shown = displayPath(root, filePath);
  for (const link of markdownLinks(body)) {
    const local = localLinkPath(link.target);
    if (local === undefined) {
      continue;
    }
    const target = resolve(dirname(filePath), local);
    if (!existsSync(target)) {
      issues.push({
        code: "c4/broken-link",
        file: shown,
        message: `"${link.label}" points to missing target ${link.target}`,
      });
    }
  }
}

function checkSources(root, filePath, body, issues) {
  const shown = displayPath(root, filePath);
  for (const rawValue of allFields(body, "Source")) {
    const paths = Array.from(rawValue.matchAll(/`([^`]+)`/g), (m) => m[1]).filter(Boolean);
    if (paths.length === 0) {
      issues.push({
        code: "c4/source-not-found",
        file: shown,
        message: `Source must use backticks: \`repo/relative/path\` or \`planned: repo/relative/path\``,
      });
      continue;
    }

    for (const entry of paths) {
      const planned = entry.startsWith("planned:");
      const sourcePath = (planned ? entry.slice("planned:".length) : entry).trim();
      const target = resolve(root, sourcePath);
      const within = relative(root, target);

      if (
        !sourcePath ||
        isAbsolute(sourcePath) ||
        win32.isAbsolute(sourcePath) ||
        within === ".." ||
        within.startsWith(`..${sep}`) ||
        isAbsolute(within)
      ) {
        issues.push({
          code: "c4/source-not-found",
          file: shown,
          message: `Source must name a path inside the repository: ${entry}`,
        });
        continue;
      }

      if (!planned && !existsSync(target)) {
        issues.push({
          code: "c4/source-not-found",
          file: shown,
          message: `Source path does not exist: ${entry} (prefix with "planned: " if unbuilt)`,
        });
      }
    }
  }
}

function checkDiagramDocument(root, filePath, kindPattern, issues, { required = true } = {}) {
  const shown = displayPath(root, filePath);
  const body = readText(filePath);
  if (body === undefined) {
    if (required) {
      issues.push({
        code: "c4/missing-file",
        file: shown,
        message: "required C4 level is missing",
      });
    }
    return;
  }

  if (!/^#\s+\S+/m.test(proseLines(body).join("\n"))) {
    issues.push({
      code: "c4/missing-title",
      file: shown,
      message: "missing a level-1 heading",
    });
  }

  checkMetadata(body, shown, issues);

  const { blocks, unclosed } = extractMermaidBlocks(body);
  if (unclosed) {
    issues.push({
      code: "c4/unclosed-diagram",
      file: shown,
      message: "unclosed ```mermaid code fence",
    });
  }

  const recognized = blocks.filter((block) => diagramKind(block, kindPattern) !== undefined);
  if (recognized.length === 0) {
    issues.push({
      code: "c4/missing-diagram",
      file: shown,
      message: "add a Mermaid diagram (C4Context, C4Container, C4Component, flowchart, or graph)",
    });
    return;
  }

  if (!recognized.some(hasRelationship)) {
    issues.push({
      code: "c4/diagram-without-relationship",
      file: shown,
      message: "diagram has no relationships; show how elements interact",
    });
  }

  for (const diagram of recognized) {
    const kind = diagramKind(diagram, kindPattern);
    if (kind?.startsWith("C4") && !hasBalancedBraces(diagram)) {
      issues.push({
        code: "c4/unbalanced-braces",
        file: shown,
        message: `unbalanced boundary braces in ${kind} diagram`,
      });
    }
  }
}

function listMarkdownFiles(dir, found = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      listMarkdownFiles(full, found);
    } else if (entry.isFile() && entry.name.endsWith(".md")) {
      found.push(full);
    }
  }
  return found;
}

/**
 * Validate C4 Markdown files under `<root>/<c4Dir>`.
 * @param {string} root Repository root path.
 * @param {{ c4Dir?: string }} [options]
 * @returns {{ ok: boolean, root: string, c4Dir: string, checkedFiles: number, issues: Array<{ code: string, file: string, message: string }> }}
 */
export function checkC4Docs(root, options = {}) {
  const resolvedRoot = resolve(root);
  const c4Dir = options.c4Dir || DEFAULT_C4_DIR;
  const c4Path = resolve(resolvedRoot, c4Dir);
  const issues = [];

  if (!existsSync(c4Path) || !statSync(c4Path).isDirectory()) {
    issues.push({
      code: "c4/missing-directory",
      file: c4Dir,
      message: `C4 documentation directory not found; run "mc4 init" to scaffold ${c4Dir}`,
    });
    return { ok: false, root: resolvedRoot, c4Dir, checkedFiles: 0, issues };
  }

  const readmePath = join(c4Path, "README.md");
  const readmeBody = readText(readmePath);
  if (readmeBody === undefined) {
    issues.push({
      code: "c4/missing-file",
      file: displayPath(resolvedRoot, readmePath),
      message: "required C4 index README.md is missing",
    });
  } else {
    const shownReadme = displayPath(resolvedRoot, readmePath);
    if (!/^#\s+\S+/m.test(proseLines(readmeBody).join("\n"))) {
      issues.push({
        code: "c4/missing-title",
        file: shownReadme,
        message: "missing a level-1 heading",
      });
    }
    checkMetadata(readmeBody, shownReadme, issues);

    const linkedTargets = new Set(
      markdownLinks(readmeBody)
        .map((link) => localLinkPath(link.target))
        .filter((local) => local !== undefined)
        .map((local) => resolve(dirname(readmePath), local).toLowerCase()),
    );
    for (const level of REQUIRED_LEVELS) {
      if (!linkedTargets.has(resolve(c4Path, level.file).toLowerCase())) {
        issues.push({
          code: "c4/readme-missing-level-link",
          file: shownReadme,
          message: `link to ${level.label} (${level.file})`,
        });
      }
    }
  }

  for (const level of REQUIRED_LEVELS) {
    checkDiagramDocument(resolvedRoot, join(c4Path, level.file), LEVEL_DIAGRAM_KINDS, issues, {
      required: true,
    });
  }

  const codePath = join(c4Path, OPTIONAL_CODE_FILE);
  if (existsSync(codePath)) {
    checkDiagramDocument(resolvedRoot, codePath, CODE_DIAGRAM_KINDS, issues, {
      required: false,
    });
  }

  const mdFiles = listMarkdownFiles(c4Path);
  for (const file of mdFiles) {
    const body = readText(file) ?? "";
    checkLinks(resolvedRoot, file, body, issues);
    if (file.endsWith("03-components.md") || file.endsWith("04-code.md")) {
      checkSources(resolvedRoot, file, body, issues);
    }
  }

  return {
    ok: issues.length === 0,
    root: resolvedRoot,
    c4Dir,
    checkedFiles: mdFiles.length,
    issues,
  };
}

function isDirectExecution() {
  const invoked = process.argv[1];
  if (!invoked) {
    return false;
  }
  try {
    return realpathSync(resolve(invoked)) === realpathSync(fileURLToPath(import.meta.url));
  } catch {
    return resolve(invoked) === fileURLToPath(import.meta.url);
  }
}

if (isDirectExecution()) {
  const args = process.argv.slice(2);
  let dir = DEFAULT_C4_DIR;
  let json = false;
  let targetRoot = ".";

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--dir" && args[i + 1]) {
      dir = args[++i];
    } else if (arg.startsWith("--dir=")) {
      dir = arg.slice("--dir=".length);
    } else if (arg === "--json") {
      json = true;
    } else if (!arg.startsWith("-")) {
      targetRoot = arg;
    }
  }

  const report = checkC4Docs(targetRoot, { c4Dir: dir });
  if (json) {
    console.log(JSON.stringify(report, null, 2));
  } else if (report.ok) {
    console.log(
      `C4 check passed (${report.checkedFiles} markdown file${report.checkedFiles === 1 ? "" : "s"} in ${report.c4Dir}).`,
    );
  } else {
    console.error(
      `C4 check failed: ${report.issues.length} issue${report.issues.length === 1 ? "" : "s"}.`,
    );
    for (const issue of report.issues) {
      console.error(`  ${issue.code}  ${issue.file}  ${issue.message}`);
    }
  }
  process.exitCode = report.ok ? 0 : 1;
}
