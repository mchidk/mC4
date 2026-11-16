import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  statSync,
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

function isInsidePackageSource(targetDir) {
  const resolvedTarget = path.resolve(targetDir);
  const resolvedRoot = path.resolve(PACKAGE_ROOT);
  return (
    resolvedTarget === resolvedRoot ||
    resolvedTarget.startsWith(resolvedRoot + path.sep)
  );
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
export function installSkill({ harnesses = HARNESSES, scope, cwd, dryRun = false }) {
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

    const written = files.map((file) => path.join(target.dir, file.rel));
    if (!dryRun) {
      for (const file of files) {
        const dest = path.join(target.dir, file.rel);
        mkdirSync(path.dirname(dest), { recursive: true });
        copyFileSync(file.src, dest);
      }
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

    if (!dryRun) {
      rmSync(target.dir, { recursive: true, force: true });
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
