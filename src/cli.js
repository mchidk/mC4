#!/usr/bin/env node
import { existsSync } from "node:fs";
import path from "node:path";
import { checkC4Docs, DEFAULT_C4_DIR } from "./check.js";
import {
  getSkillStatus,
  HARNESSES,
  initC4Docs,
  installSkill,
  uninstallSkill,
} from "./installer.js";

/**
 * CLI for mC4: validate C4 Markdown docs, scaffold templates, and install
 * the c4 skill across Claude Code, OpenCode, Codex, and Antigravity.
 *
 * Author: Michael Christensen
 */

function getOptionValue(args, name) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === name) {
      const next = args[i + 1];
      return next && !next.startsWith("-") ? next : "";
    }
    if (arg.startsWith(`${name}=`)) {
      return arg.slice(name.length + 1);
    }
  }
  return undefined;
}

function getPositionalArgs(args) {
  const values = [];
  const valueFlags = new Set(["--dir"]);
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (valueFlags.has(arg)) {
      i++;
      continue;
    }
    if (arg.startsWith("-")) {
      continue;
    }
    values.push(arg);
  }
  return values;
}

function parseHarnesses(args) {
  if (args.includes("--all")) {
    return [...HARNESSES];
  }
  const selected = HARNESSES.filter((harness) => args.includes(`--${harness}`));
  return selected.length > 0 ? selected : [...HARNESSES];
}

function parseScope(args) {
  if (args.includes("--global")) {
    return "global";
  }
  if (args.includes("--project")) {
    return "project";
  }
  return undefined;
}

function cmdCheck(args, cwd) {
  const positionals = getPositionalArgs(args).slice(1);
  const root = path.resolve(cwd, positionals[0] ?? ".");
  const c4Dir = getOptionValue(args, "--dir") || DEFAULT_C4_DIR;
  const json = args.includes("--json");

  const report = checkC4Docs(root, { c4Dir });
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
  return report.ok ? 0 : 1;
}

function cmdInit(args, cwd) {
  const positionals = getPositionalArgs(args).slice(1);
  const root = path.resolve(cwd, positionals[0] ?? ".");
  const c4Dir = getOptionValue(args, "--dir") || DEFAULT_C4_DIR;
  const force = args.includes("--force");

  const result = initC4Docs(root, { c4Dir, force });
  console.log(`Initialized C4 templates in ${result.destDir}:`);
  for (const file of result.created) {
    console.log(`  created  ${path.basename(file)}`);
  }
  for (const file of result.skipped) {
    console.log(`  skipped  ${path.basename(file)} (already exists; pass --force to overwrite)`);
  }
  return 0;
}

function cmdInstall(args, cwd) {
  const harnesses = parseHarnesses(args);
  const scope = parseScope(args);
  const targetDir = getOptionValue(args, "--dir");
  const effectiveCwd = targetDir ? path.resolve(cwd, targetDir) : cwd;
  const dryRun = args.includes("--dry-run");
  const force = args.includes("--force");

  const results = installSkill({ harnesses, scope, cwd: effectiveCwd, dryRun, force });
  for (const item of results) {
    const label = item.harnesses.join(", ");
    if (item.status === "skipped") {
      console.log(`Skipped [${label}] (${item.dir}): ${item.reason}`);
    } else if (item.status === "dry-run") {
      console.log(`[dry-run] Would install c4 skill for [${label}] -> ${item.dir} (${item.files.length} files)`);
    } else {
      console.log(`Installed c4 skill for [${label}] -> ${item.dir}`);
    }
  }
  return 0;
}

function cmdUninstall(args, cwd) {
  const harnesses = parseHarnesses(args);
  const scope = parseScope(args);
  const targetDir = getOptionValue(args, "--dir");
  const effectiveCwd = targetDir ? path.resolve(cwd, targetDir) : cwd;
  const dryRun = args.includes("--dry-run");

  const results = uninstallSkill({ harnesses, scope, cwd: effectiveCwd, dryRun });
  for (const item of results) {
    const label = item.harnesses.join(", ");
    if (item.status === "skipped") {
      console.log(`Skipped [${label}] (${item.dir}): ${item.reason}`);
    } else if (item.status === "not-found") {
      console.log(`Not installed [${label}] (${item.dir})`);
    } else if (item.status === "dry-run") {
      console.log(`[dry-run] Would remove c4 skill for [${label}] -> ${item.dir}`);
    } else {
      console.log(`Removed c4 skill for [${label}] -> ${item.dir}`);
    }
  }
  return 0;
}

function cmdStatus(args, cwd) {
  const targetDir = getOptionValue(args, "--dir");
  const effectiveCwd = targetDir ? path.resolve(cwd, targetDir) : cwd;
  const status = getSkillStatus(effectiveCwd);
  const docsPresent = existsSync(path.join(status.projectRoot, DEFAULT_C4_DIR));

  console.log(`mC4 status (project root: ${status.projectRoot})`);
  console.log(`  docs/c4: ${docsPresent ? "present" : "not found"}`);
  console.log("  Project skills:");
  for (const entry of status.project) {
    console.log(`    ${entry.harness.padEnd(11)} ${entry.installed ? "installed" : "not installed"} (${entry.dir})`);
  }
  console.log("  Global skills:");
  for (const entry of status.global) {
    console.log(`    ${entry.harness.padEnd(11)} ${entry.installed ? "installed" : "not installed"} (${entry.dir})`);
  }
  return 0;
}

function printHelp() {
  console.log(`Usage: mc4 <command> [options]

Commands:
  check [root]      Validate C4 markdown docs, Mermaid diagrams, links, and Source paths
  init [root]       Scaffold starter C4 .md templates under docs/c4/
  install           Install the c4 skill for Claude Code, OpenCode, Codex, and Antigravity
  uninstall         Remove the installed c4 skill from harness directories
  status            Show skill installation status and docs/c4 presence

Options:
  --claude          Target Claude Code (.claude/skills/c4)
  --opencode        Target OpenCode (.opencode/skills/c4)
  --codex           Target Codex (.agents/skills/c4)
  --antigravity     Target Antigravity (.agents/skills/c4 or ~/.gemini/antigravity/skills/c4)
  --all             Target all supported harnesses (default)
  --project         Target project-local skill directories (default inside git repos)
  --global          Target user global skill directories
  --dir <path>      Target repository root (for install/status) or C4 folder (for check/init)
  --force           Overwrite existing template files (init) or a non-mC4 c4 skill (install)
  --dry-run         Preview install/uninstall actions without writing files
  --json            Emit JSON output for check
  --help, -h        Show this help message

Author: Michael Christensen`);
}

function main() {
  const args = process.argv.slice(2);
  const command = getPositionalArgs(args)[0];
  const cwd = process.cwd();

  if (args.includes("--help") || args.includes("-h") || !command) {
    printHelp();
    return 0;
  }

  switch (command) {
    case "check":
      return cmdCheck(args, cwd);
    case "init":
      return cmdInit(args, cwd);
    case "install":
      return cmdInstall(args, cwd);
    case "uninstall":
      return cmdUninstall(args, cwd);
    case "status":
      return cmdStatus(args, cwd);
    default:
      console.error(`Unknown command: "${command}"`);
      printHelp();
      return 1;
  }
}

process.exitCode = main();
