import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Multi-harness skill installer and C4 doc scaffolder for mC4.
 * Supports Claude Code, OpenCode, Codex, and Antigravity.
 *
 * Author: Michael Christensen
 */

export const SKILL_NAME = "c4";
export const HARNESSES = ["claude", "opencode", "codex", "antigravity"];

const PACKAGE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const MARKER_FILE = ".mc4-install.json";

function getXdgConfigHome() {
  return process.env.XDG_CONFIG_HOME || path.join(os.homedir(), ".config");
}

export function findProjectRoot(cwd) {
  let dir = path.resolve(cwd);
  while (true) {
    if (existsSync(path.join(dir, ".git"))) {
      return dir;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

export function detectDefaultScope(cwd) {
  return findProjectRoot(cwd) ? "project" : "global";
}

export function getHarnessSkillDir(harness, scope, projectRoot) {
  const home = os.homedir();
  switch (harness) {
    case "claude":
      return scope === "global"
        ? path.join(home, ".claude", "skills", SKILL_NAME)
        : path.join(projectRoot, ".claude", "skills", SKILL_NAME);
    case "opencode":
      return scope === "global"
        ? path.join(getXdgConfigHome(), "opencode", "skills", SKILL_NAME)
        : path.join(projectRoot, ".opencode", "skills", SKILL_NAME);
    case "codex":
      return scope === "global"
        ? path.join(home, ".agents", "skills", SKILL_NAME)
        : path.join(projectRoot, ".agents", "skills", SKILL_NAME);
    case "antigravity":
      return scope === "global"
        ? path.join(home, ".gemini", "antigravity", "skills", SKILL_NAME)
        : path.join(projectRoot, ".agents", "skills", SKILL_NAME);
    default:
      throw new Error(`Unknown harness "${harness}". Expected one of: ${HARNESSES.join(", ")}`);
  }
}

function collectSkillFiles() {
  const entries = [
    { src: path.join(PACKAGE_ROOT, "SKILL.md"), rel: "SKILL.md" },
    { src: path.join(PACKAGE_ROOT, "src", "check.js"), rel: path.join("src", "check.js") },
  ];

  for (const folder of ["references", "templates"]) {
    const dir = path.join(PACKAGE_ROOT, folder);
    if (!existsSync(dir)) {
      continue;
    }
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isFile()) {
        entries.push({ src: full, rel: path.join(folder, name) });
      }
    }
  }

  return entries;
}

/**
 * Resolve a path to its canonical on-disk form (true case, symlinks resolved)
 * even if its tail does not exist yet.
 */
function canonicalPath(target) {
  let existing = path.resolve(target);
  const rest = [];
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      return path.resolve(target);
    }
    rest.unshift(path.basename(existing));
    existing = parent;
  }
  try {
    return path.join(realpathSync.native(existing), ...rest);
  } catch {
    return path.resolve(target);
  }
}

function isInsidePackageSource(targetDir) {
  // Windows and macOS file systems are case-insensitive by default.
  const fold = (p) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);
  const resolvedTarget = fold(canonicalPath(targetDir));
  const resolvedRoot = fold(canonicalPath(PACKAGE_ROOT));
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(resolvedRoot + path.sep)
  );
}

/**
 * True when `dir` holds a c4 skill that mC4 installed (marker file present,
 * or an unmodified copy of this package's SKILL.md).
 */
function isManagedSkillDir(dir) {
  if (existsSync(path.join(dir, MARKER_FILE))) {
    return true;
  }
  try {
    return readFileSync(path.join(dir, "SKILL.md"), "utf8") === readFileSync(path.join(PACKAGE_ROOT, "SKILL.md"), "utf8");
  } catch {
    return false;
  }
}

function hasForeignSkill(dir) {
  return existsSync(dir) && readdirSync(dir).length > 0 && !isManagedSkillDir(dir);
}

function removeEmptyDirs(dir) {
  if (!existsSync(dir) || !statSync(dir).isDirectory()) {
    return;
  }
  for (const name of readdirSync(dir)) {
    removeEmptyDirs(path.join(dir, name));
  }
  if (readdirSync(dir).length === 0) {
    rmdirSync(dir);
  }
}

/**
 * Resolve deduplicated target directories for requested harnesses.
 */
export function resolveTargets({ harnesses = HARNESSES, scope, cwd }) {
  const effectiveScope = scope ?? detectDefaultScope(cwd);
  const projectRoot = findProjectRoot(cwd) ?? path.resolve(cwd);
  const byDir = new Map();

  for (const harness of harnesses) {
    const dir = getHarnessSkillDir(harness, effectiveScope, projectRoot);
    const existing = byDir.get(dir);
    if (existing) {
      existing.harnesses.push(harness);
    } else {
      byDir.set(dir, { dir, harnesses: [harness], scope: effectiveScope });
    }
  }

  return Array.from(byDir.values());
}

/**
 * Install self-contained `c4` skill files into one or more harness directories.
 */
export function installSkill({ harnesses = HARNESSES, scope, cwd, dryRun = false, force = false }) {
  const targets = resolveTargets({ harnesses, scope, cwd });
  const files = collectSkillFiles();
  const results = [];

  for (const target of targets) {
    if (isInsidePackageSource(target.dir)) {
      results.push({
        ...target,
        status: "skipped",
        reason: "Refusing to overwrite mC4 repository source adapters",
        files: [],
      });
      continue;
    }

    if (!force && hasForeignSkill(target.dir)) {
      results.push({
        ...target,
        status: "skipped",
        reason: "Existing c4 skill was not installed by mC4; pass --force to overwrite",
        files: [],
      });
      continue;
    }

    const written = files.map((file) => path.join(target.dir, file.rel));
    if (!dryRun) {
      for (const file of files) {
        const dest = path.join(target.dir, file.rel);
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(file.src, dest);
      }
      writeFileSync(path.join(target.dir, MARKER_FILE), `${JSON.stringify({ installedBy: "mc4" })}\n`);
    }

    results.push({
      ...target,
      status: dryRun ? "dry-run" : "installed",
      files: written,
    });
  }

  return results;
}

/**
 * Remove installed `c4` skill directories for the selected harnesses.
 */
export function uninstallSkill({ harnesses = HARNESSES, scope, cwd, dryRun = false }) {
  const targets = resolveTargets({ harnesses, scope, cwd });
  const results = [];

  for (const target of targets) {
    if (isInsidePackageSource(target.dir)) {
      results.push({
        ...target,
        status: "skipped",
        reason: "Refusing to remove mC4 repository source adapters",
      });
      continue;
    }

    if (!existsSync(target.dir)) {
      results.push({ ...target, status: "not-found" });
      continue;
    }

    if (!isManagedSkillDir(target.dir)) {
      results.push({
        ...target,
        status: "skipped",
        reason: "c4 skill here was not installed by mC4; leaving it untouched",
      });
      continue;
    }

    // Remove only the files mC4 installs, then prune empty folders, so any
    // user-added files in the skill directory survive.
    if (!dryRun) {
      for (const file of collectSkillFiles()) {
        rmSync(path.join(target.dir, file.rel), { force: true });
      }
      rmSync(path.join(target.dir, MARKER_FILE), { force: true });
      removeEmptyDirs(target.dir);
    }
    results.push({ ...target, status: dryRun ? "dry-run" : "removed" });
  }

  return results;
}

/**
 * Inspect installation status across project and global harness locations.
 */
export function getSkillStatus(cwd) {
  const projectRoot = findProjectRoot(cwd) ?? path.resolve(cwd);
  const report = { projectRoot, project: [], global: [] };

  for (const scope of ["project", "global"]) {
    for (const harness of HARNESSES) {
      const dir = getHarnessSkillDir(harness, scope, projectRoot);
      const installed = existsSync(path.join(dir, "SKILL.md"));
      report[scope].push({ harness, dir, installed });
    }
  }

  return report;
}

/**
 * Scaffold starter `docs/c4/` Markdown files from `templates/`.
 */
export function initC4Docs(root, { c4Dir = "docs/c4", force = false } = {}) {
  const resolvedRoot = path.resolve(root);
  const destDir = path.resolve(resolvedRoot, c4Dir);
  const templateDir = path.join(PACKAGE_ROOT, "templates");
  const starterFiles = ["README.md", "01-context.md", "02-containers.md", "03-components.md"];

  mkdirSync(destDir, { recursive: true });
  const created = [];
  const skipped = [];

  for (const name of starterFiles) {
    const src = path.join(templateDir, name);
    const dest = path.join(destDir, name);
    if (existsSync(dest) && !force) {
      skipped.push(dest);
      continue;
    }
    copyFileSync(src, dest);
    created.push(dest);
  }

  return { destDir, created, skipped };
}
