import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const CLI_PATH = path.join(REPO_ROOT, "src", "cli.js");
const CHECK_SCRIPT_PATH = path.join(REPO_ROOT, "src", "check.js");

function runCli(args, cwd) {
  return execFileSync(process.execPath, [CLI_PATH, ...args], {
    cwd,
    encoding: "utf8",
    windowsHide: true,
  });
}

describe("mc4 CLI", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), "mc4-cli-"));
  });

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("prints help with author attribution", () => {
    const out = runCli(["--help"], tmpDir);
    assert.match(out, /Usage: mc4/);
    assert.match(out, /Michael Christensen/);
  });

  it("scaffolds docs/c4 templates via init and passes check", () => {
    const initOut = runCli(["init", tmpDir], REPO_ROOT);
    assert.match(initOut, /created\s+README\.md/);
    assert.match(initOut, /created\s+03-components\.md/);

    const checkOut = runCli(["check", tmpDir, "--json"], REPO_ROOT);
    const report = JSON.parse(checkOut);
    assert.equal(report.ok, true);
    assert.equal(report.checkedFiles, 4);
  });

  it("supports dry-run install without writing files", () => {
    const out = runCli(["install", "--project", "--dir", tmpDir, "--dry-run"], REPO_ROOT);
    assert.match(out, /\[dry-run\] Would install c4 skill/);
    assert.equal(existsSync(path.join(tmpDir, ".claude")), false);
    assert.equal(existsSync(path.join(tmpDir, ".opencode")), false);
    assert.equal(existsSync(path.join(tmpDir, ".agents")), false);
  });

  it("installs self-contained skill bundles to project harness dirs and uninstalls cleanly", () => {
    const installOut = runCli(["install", "--project", "--dir", tmpDir], REPO_ROOT);
    assert.match(installOut, /Installed c4 skill for \[claude\]/);
    assert.match(installOut, /Installed c4 skill for \[opencode\]/);
    assert.match(installOut, /Installed c4 skill for \[codex, antigravity\]/);

    const claudeSkill = path.join(tmpDir, ".claude", "skills", "c4", "SKILL.md");
    const opencodeCheck = path.join(tmpDir, ".opencode", "skills", "c4", "src", "check.js");
    const agentsRef = path.join(tmpDir, ".agents", "skills", "c4", "references", "c4-levels.md");

    assert.equal(existsSync(claudeSkill), true);
    assert.equal(existsSync(opencodeCheck), true);
    assert.equal(existsSync(agentsRef), true);
    assert.match(readFileSync(claudeSkill, "utf8"), /^---\r?\nname: c4\r?\n/m);

    // Installed standalone src/check.js works directly on a scaffolded project.
    runCli(["init", tmpDir], REPO_ROOT);
    const directOut = execFileSync(process.execPath, [opencodeCheck, tmpDir], {
      cwd: tmpDir,
      encoding: "utf8",
      windowsHide: true,
    });
    assert.match(directOut, /C4 check passed/);

    const uninstallOut = runCli(["uninstall", "--project", "--dir", tmpDir], REPO_ROOT);
    assert.match(uninstallOut, /Removed c4 skill/);
    assert.equal(existsSync(claudeSkill), false);
    assert.equal(existsSync(opencodeCheck), false);
    assert.equal(existsSync(agentsRef), false);
  });

  it("direct src/check.js CLI fails cleanly when docs/c4 is absent", () => {
    let failed = false;
    try {
      execFileSync(process.execPath, [CHECK_SCRIPT_PATH, tmpDir], {
        cwd: REPO_ROOT,
        encoding: "utf8",
        windowsHide: true,
      });
    } catch (err) {
      failed = true;
      assert.match(String(err.stderr), /c4\/missing-directory/);
    }
    assert.equal(failed, true);
  });

  it("refuses to overwrite mC4 repo adapters during install", () => {
    const out = runCli(["install", "--project", "--dir", REPO_ROOT], REPO_ROOT);
    assert.match(out, /Skipped \[claude\]/);
  });
});
