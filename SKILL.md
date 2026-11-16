---
name: c4
description: Use when creating, updating, or reviewing C4 architecture documentation in docs/c4/ (Context, Containers, Components, and optional Code .md files with Mermaid diagrams and grounded source links).
---

# C4 Architecture Documentation Skill

Produce and maintain concise, grounded C4 architecture documentation as Markdown (`.md`) files under `docs/c4/` (or the repository's existing architecture folder).

## Goals

A reader opening `docs/c4/README.md` and the numbered level files should understand in minutes:

- **Context (`01-context.md`)**: who uses the system, what external systems surround it, and what is out of scope;
- **Containers (`02-containers.md`)**: which applications and data stores run separately, their technologies, owned data, and protocols;
- **Components (`03-components.md`)**: the internal modules inside key containers, their contracts, failure behavior, and verified `Source` paths;
- **Code (`04-code.md`, optional)**: only for complex or security-critical internals that earn the maintenance cost.

## Fast 4-Step Workflow

Keep discovery and edits targeted — do not read the entire repository when a directory listing and entrypoints suffice.

### 1. Inspect existing docs and project boundaries

1. Check if `docs/c4/` already exists (`README.md`, `01-context.md`, `02-containers.md`, `03-components.md`). If missing, scaffold from [`templates/`](templates/README.md) or run `npx mc4 init`.
2. Read only what you need to establish real facts: project manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, etc.), top-level directories, entrypoints, runtime/deployment config, and external integrations.
3. Decide which C4 levels actually changed:
   - Actor, external system, or trust boundary changed -> update `01-context.md`.
   - Deployable unit, database, queue, protocol, or auth boundary changed -> update `02-containers.md`.
   - Internal module, interface, or failure path changed -> update `03-components.md`.
   - Do not rewrite unaffected levels.

### 2. Draft or update only the affected `.md` files

Follow the structure in [`references/c4-levels.md`](references/c4-levels.md) and starter files in [`templates/`](templates/README.md):

- Include `# Title`, `Status` (`draft` | `proposed` | `accepted` | `verified`), `Owner`, and `Last reviewed` (`YYYY-MM-DD`).
- Include at least one Mermaid diagram (`C4Context`, `C4Container`, `C4Component`, `flowchart`, or `graph`) with explicit relationships (`Rel(...)` or arrows).
- Keep each diagram readable (roughly 15 elements max); move details into short Markdown tables.
- Record real repo-relative `Source:` paths in backticks (or `` `planned: <path>` `` if not yet built).

### 3. Enforce strict grounding

Follow [`references/mermaid-and-grounding.md`](references/mermaid-and-grounding.md):

- **Never invent** owners, deployment targets, auth rules, external systems, or file paths.
- Separate **Facts** (verified in code/config) from **Proposed** (intended design) and **`VERIFY:`** (unconfirmed — ask or flag instead of guessing).
- Never include secrets, tokens, connection strings, personal data, or proprietary customer names.

### 4. Validate fast

Run the standalone validator in one command:

```bash
node src/check.js .
```

If `mc4` is installed or linked in the project, `npx mc4 check` runs the same check. Fix any reported structural, link, Mermaid, or `Source:` path error directly and re-run until green.

## Boundaries

- Documents observed architecture and explicit design intent; does not replace ADRs, tests, or runtime verification.
- If code and existing C4 docs contradict each other, flag the discrepancy rather than silently inventing a third claim.
- Passing structural checks confirms file layout, metadata, Mermaid blocks, relative links, and `Source:` paths — not business correctness or Mermaid visual layout.
