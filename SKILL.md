---
name: c4
description: Create, update, or review C4 architecture documentation (System Context, Container, Component, optional Code) as Markdown files with Mermaid diagrams under docs/c4/, grounded in the actual codebase and checked by a bundled validator. Use when asked to document, diagram, or review a system's architecture, or to refresh C4 docs after an architectural change.
---

# C4 Architecture Documentation Skill

Produce and maintain concise, grounded C4 architecture documentation as Markdown (`.md`) files under `docs/c4/`, or under the repository's existing architecture folder if it already has one.

In this file, `<skill-dir>` means the directory containing this `SKILL.md` (for example `.claude/skills/c4`, `.opencode/skills/c4`, or `.agents/skills/c4`). The `references/`, `templates/`, and `src/check.js` files mentioned below live there.

## Goals

A reader opening `docs/c4/README.md` and the numbered level files should understand in minutes:

- **Context (`01-context.md`)**: who uses the system, what external systems surround it, and what is out of scope;
- **Containers (`02-containers.md`)**: which applications and data stores run separately, their technologies, owned data, and protocols;
- **Components (`03-components.md`)**: the internal modules inside key containers, their contracts, failure behavior, and verified `Source` paths;
- **Code (`04-code.md`, optional)**: only for complex or security-critical internals that earn the maintenance cost.

## Workflow

Keep discovery and edits targeted — do not read the entire repository when a directory listing and entrypoints suffice.

### 1. Inspect existing docs and project boundaries

1. Check whether `docs/c4/` (or an existing architecture folder) already contains `README.md`, `01-context.md`, `02-containers.md`, and `03-components.md`. If not, create the folder and copy those four starter files from `<skill-dir>/templates/`. Copy `04-code.md` only if Level 4 is warranted. Do not download packages or tools to scaffold.
2. Read only what you need to establish real facts:
   - project manifests (`package.json`, `pyproject.toml`, `Cargo.toml`, `go.mod`, `*.csproj`, etc.), top-level directories, and entrypoints;
   - runtime and deployment config (`Dockerfile`, `docker-compose.*`, Kubernetes/Helm, Terraform/Bicep/CDK, CI/CD workflows) — this is where containers, data stores, and external systems usually show up;
   - integration points (HTTP clients, SDK imports, queue/topic names, env var *names* — never copy their values);
   - ownership sources such as `CODEOWNERS`, if present.
3. When updating existing docs, change only the levels that are affected:
   - Actor, external system, or trust boundary changed -> update `01-context.md`.
   - Deployable unit, database, queue, protocol, or auth boundary changed -> update `02-containers.md`.
   - Internal module, interface, or failure path changed -> update `03-components.md`.
   - Leave unaffected levels as they are. When creating docs from scratch, write all three required levels.

### 2. Write the `.md` files

Follow [`references/c4-levels.md`](references/c4-levels.md) for what each file must contain and [`references/mermaid-and-grounding.md`](references/mermaid-and-grounding.md) for diagram syntax.

- **Replace every template placeholder** (`System Name`, `External System`, `Data Store`, example table rows, sample `planned:` paths). The untouched templates pass the validator, so a passing check does not prove the docs are filled in.
- **Metadata** on every file, as bullets under the `# Title`:
  - `Status`: use `draft` for anything you write, or `proposed` for a document describing design that is not built yet. Set `accepted` or `verified` only when the user explicitly confirms the document was reviewed — never promote your own output.
  - `Owner`: a real team or person only if stated in the repository (e.g. `CODEOWNERS`) or by the user; otherwise `VERIFY: assign owner`.
  - `Last reviewed`: today's date (`YYYY-MM-DD`) on every file you change.
- **Diagrams**: each level file needs at least one Mermaid diagram (`C4Context`, `C4Container`, `C4Component`, `flowchart`, or `graph`; `04-code.md` may also use `sequenceDiagram`, `classDiagram`, `stateDiagram`, or `erDiagram`) with explicit relationships (`Rel(...)`, `BiRel(...)`, or arrows). Keep each diagram to roughly 15 elements and move detail into short tables.
- **Sources**: in `03-components.md` and `04-code.md`, every `- **Source:**` line holds backticked repo-relative file or directory paths that exist (`` `src/server/router.ts` ``), without line-number suffixes. Use `` `planned: <path>` `` only for code that is not built yet.
- **Index**: keep the level table in `README.md` in sync with the level files, and link `04-code.md` from it if you add one.

### 3. Enforce strict grounding

- **Never invent** owners, deployment targets, auth rules, external systems, or file paths.
- Separate **facts** (verified in code/config) from **proposed** design (label it `proposed`, use `planned:` paths) and **`VERIFY:`** items (unconfirmed — write `VERIFY: <what needs confirmation>` instead of guessing).
- If code and existing C4 docs contradict each other, flag the discrepancy rather than silently picking one or inventing a third claim.
- Never include secrets, tokens, connection strings, personal data, or proprietary customer names.

### 4. Validate

From the repository root, run the validator bundled with this skill:

```bash
node <skill-dir>/src/check.js .
```

Add `--dir <folder>` when the docs live somewhere other than `docs/c4` (for example `--dir docs/architecture`). Fix every reported issue and re-run until it passes.

The validator checks structure only: file layout, metadata, Mermaid fences and braces, relationships, relative links, and `Source:` paths. It does not parse Mermaid syntax or judge correctness, so also review each diagram against the syntax rules and checklist in [`references/mermaid-and-grounding.md`](references/mermaid-and-grounding.md).

### 5. Report back

Finish with a short summary for the user:

- files created or changed, and levels left untouched (with the reason);
- every `VERIFY:` item that needs a human answer;
- any contradictions found between code and existing docs.

## Boundaries

- Documents observed architecture and explicit design intent; does not replace ADRs, tests, or runtime verification.
- A passing validator run confirms structure only — not business correctness, Mermaid render success, or visual layout.
