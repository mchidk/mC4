import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { describe, it } from "node:test";
import { checkC4Docs } from "../src/check.js";

const BASE_FILES = {
  "src/app.js": "export const app = true;\n",
  "docs/c4/README.md": [
    "# System C4 Documentation",
    "",
    "- **Status:** proposed",
    "- **Owner:** Platform Team",
    "- **Last reviewed:** 2026-11-16",
    "",
    "[Context](01-context.md) | [Containers](02-containers.md) | [Components](03-components.md)",
    "",
  ].join("\n"),
  "docs/c4/01-context.md": [
    "# System Context",
    "",
    "- **Status:** accepted",
    "- **Owner:** Platform Team",
    "- **Last reviewed:** 2026-11-16",
    "",
    "```mermaid",
    "C4Context",
    '  Person(user, "User", "Uses the system")',
    '  System(sys, "Sample System", "Processes requests")',
    '  Rel(user, sys, "Uses", "HTTPS")',
    "```",
    "",
  ].join("\n"),
  "docs/c4/02-containers.md": [
    "# Containers",
    "",
    "- **Status:** proposed",
    "- **Owner:** Platform Team",
    "- **Last reviewed:** 2026-11-16",
    "",
    "```mermaid",
    "C4Container",
    '  System_Boundary(sys, "Sample System") {',
    '    Container(api, "API", "Node.js", "Handles requests")',
    '    ContainerDb(db, "Database", "PostgreSQL", "Stores records")',
    "  }",
    '  Rel(api, db, "Reads and writes", "SQL")',
    "```",
    "",
  ].join("\n"),
  "docs/c4/03-components.md": [
    "# Components",
    "",
    "- **Status:** verified",
    "- **Owner:** Platform Team",
    "- **Last reviewed:** 2026-11-16",
    "",
    "```mermaid",
    "C4Component",
    '  Container_Boundary(api, "API") {',
    '    Component(handler, "Handler", "JS", "Handles requests")',
    '    Component(store, "Store", "JS", "Persists state")',
    "  }",
    '  Rel(handler, store, "Calls")',
    "```",
    "",
    "### Handler",
    "",
    "- **Source:** `src/app.js`",
    "",
    "### Future Worker",
    "",
    "- **Source:** `planned: src/worker.js`",
    "",
  ].join("\n"),
};

function withFixture(overrides, run) {
  const root = mkdtempSync(path.join(os.tmpdir(), "mc4-check-"));
  try {
    const merged = { ...BASE_FILES, ...overrides };
    for (const [relPath, content] of Object.entries(merged)) {
      if (content === null) continue;
      const fullPath = path.join(root, relPath);
      mkdirSync(path.dirname(fullPath), { recursive: true });
      writeFileSync(fullPath, content, "utf8");
    }
    run(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

describe("checkC4Docs", () => {
  it("passes for a complete, grounded C4 documentation set", () => {
    withFixture({}, (root) => {
      const report = checkC4Docs(root);
      assert.equal(report.ok, true, JSON.stringify(report.issues));
      assert.equal(report.checkedFiles, 4);
      assert.deepEqual(report.issues, []);
    });
  });

  it("fails when docs/c4 directory is missing", () => {
    const root = mkdtempSync(path.join(os.tmpdir(), "mc4-empty-"));
    try {
      const report = checkC4Docs(root);
      assert.equal(report.ok, false);
      assert.ok(report.issues.some((i) => i.code === "c4/missing-directory"));
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("fails when a required level file is missing", () => {
    withFixture({ "docs/c4/02-containers.md": null }, (root) => {
      const report = checkC4Docs(root);
      assert.equal(report.ok, false);
      assert.ok(report.issues.some((i) => i.code === "c4/missing-file"));
    });
  });

  it("validates Status and Last reviewed date", () => {
    withFixture(
      {
        "docs/c4/01-context.md": BASE_FILES["docs/c4/01-context.md"]
          .replace("accepted", "unknown")
          .replace("2026-11-16", "2026-02-31"),
      },
      (root) => {
        const codes = checkC4Docs(root).issues.map((i) => i.code);
        assert.ok(codes.includes("c4/invalid-status"));
        assert.ok(codes.includes("c4/invalid-date"));
      },
    );
  });

  it("fails when a mermaid diagram has no relationships", () => {
    withFixture(
      {
        "docs/c4/01-context.md": BASE_FILES["docs/c4/01-context.md"].replace(
          '  Rel(user, sys, "Uses", "HTTPS")',
          '  UpdateLayoutConfig($c4ShapeInRow="2")',
        ),
      },
      (root) => {
        const codes = checkC4Docs(root).issues.map((i) => i.code);
        assert.ok(codes.includes("c4/diagram-without-relationship"));
      },
    );
  });

  it("detects unclosed mermaid fences and unbalanced boundary braces", () => {
    withFixture(
      {
        "docs/c4/01-context.md": BASE_FILES["docs/c4/01-context.md"].replace("```\n", ""),
        "docs/c4/02-containers.md": BASE_FILES["docs/c4/02-containers.md"].replace("  }\n", ""),
      },
      (root) => {
        const codes = checkC4Docs(root).issues.map((i) => i.code);
        assert.ok(codes.includes("c4/unclosed-diagram"));
        assert.ok(codes.includes("c4/unbalanced-braces"));
      },
    );
  });

  it("fails on broken relative links and missing or escaping Source paths", () => {
    withFixture(
      {
        "docs/c4/README.md": `${BASE_FILES["docs/c4/README.md"]}\n[Missing](missing.md)\n`,
        "docs/c4/03-components.md": `${BASE_FILES["docs/c4/03-components.md"]}\n- **Source:** \`src/does-not-exist.js\`\n- **Source:** \`../outside.js\`\n`,
      },
      (root) => {
        const codes = checkC4Docs(root).issues.map((i) => i.code);
        assert.ok(codes.includes("c4/broken-link"));
        assert.ok(codes.includes("c4/source-not-found"));
      },
    );
  });

  it("supports optional 04-code.md and custom --dir", () => {
    withFixture(
      {
        "arch/c4/README.md": BASE_FILES["docs/c4/README.md"],
        "arch/c4/01-context.md": BASE_FILES["docs/c4/01-context.md"],
        "arch/c4/02-containers.md": BASE_FILES["docs/c4/02-containers.md"],
        "arch/c4/03-components.md": BASE_FILES["docs/c4/03-components.md"],
        "arch/c4/04-code.md": [
          "# Code Details",
          "",
          "- **Status:** draft",
          "- **Owner:** Platform Team",
          "- **Last reviewed:** 2026-11-16",
          "",
          "```mermaid",
          "sequenceDiagram",
          "  Caller->>App: invoke",
          "  App-->>Caller: result",
          "```",
          "",
          "- **Source:** `src/app.js`",
          "",
        ].join("\n"),
      },
      (root) => {
        const report = checkC4Docs(root, { c4Dir: "arch/c4" });
        assert.equal(report.ok, true, JSON.stringify(report.issues));
        assert.equal(report.checkedFiles, 5);
      },
    );
  });

  it("accepts BiRel as a relationship", () => {
    withFixture(
      {
        "docs/c4/01-context.md": BASE_FILES["docs/c4/01-context.md"].replace(
          '  Rel(user, sys, "Uses", "HTTPS")',
          '  BiRel(user, sys, "Talks with")',
        ),
      },
      (root) => {
        const report = checkC4Docs(root);
        assert.equal(report.ok, true, JSON.stringify(report.issues));
      },
    );
  });

  it("does not let an apostrophe in unquoted text hide unbalanced braces", () => {
    withFixture(
      {
        "docs/c4/02-containers.md": BASE_FILES["docs/c4/02-containers.md"]
          .replace("C4Container\n", "C4Container\n  title Bob's System\n")
          .replace("  }\n", ""),
      },
      (root) => {
        const codes = checkC4Docs(root).issues.map((i) => i.code);
        assert.ok(codes.includes("c4/unbalanced-braces"));
      },
    );
  });

  it("ignores external schemes and inline-code examples, and decodes encoded paths", () => {
    withFixture(
      {
        "src/my app.js": "",
        "docs/c4/README.md": [
          BASE_FILES["docs/c4/README.md"],
          "[FTP](ftp://example.com/x) [Tel](tel:+4512345678) [Proto](//example.com/x)",
          "[Spaced](../../src/my%20app.js) [Query](01-context.md?plain=1#top)",
          "Use `[label](missing.md)` syntax for links.",
          "",
        ].join("\n"),
      },
      (root) => {
        const report = checkC4Docs(root);
        assert.equal(report.ok, true, JSON.stringify(report.issues));
      },
    );
  });
});
