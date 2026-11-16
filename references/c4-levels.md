# C4 Levels and File Contract

## Level Overview

| Level | File | Question answered | Update when |
|---|---|---|---|
| Index | `docs/c4/README.md` | Scope, reading order, status summary | Scope, status, or level links change |
| 1. System Context | `docs/c4/01-context.md` | Who uses the system, what surrounds it, what is out of scope? | An actor, external system, scope, or trust boundary changes |
| 2. Container | `docs/c4/02-containers.md` | What runs separately or holds state, with what tech and data? | A runtime unit, database, queue, protocol, or auth boundary changes |
| 3. Component | `docs/c4/03-components.md` | What are the parts inside key containers and how do they interact? | An internal module, interface, or failure path changes |
| 4. Code | `docs/c4/04-code.md` (optional) | How does a complex or security-critical module work? | Only when code structure earns ongoing maintenance |

A **container** in C4 means a separately runnable process or data store (web app, API server, worker, CLI, SQL database, object store) — not every source folder or library package.

## Required Metadata

Every C4 `.md` file (`README.md`, `01-context.md`, `02-containers.md`, `03-components.md`, and optional `04-code.md`) must include:

- A level-1 heading (`# Title`)
- `- **Status:** draft | proposed | accepted | verified`
- `- **Owner:** <real owner or VERIFY: assign owner>`
- `- **Last reviewed:** YYYY-MM-DD`

## File Expectations

### `docs/c4/README.md`

- Scope: what the record covers and what it excludes.
- Reading order and table linking `01-context.md`, `02-containers.md`, and `03-components.md`.
- Clear note distinguishing implemented facts from proposed architecture.

### `docs/c4/01-context.md`

- One-sentence system summary.
- `C4Context` (or `flowchart`) diagram showing actors (`Person`), the system (`System`), and external dependencies (`System_Ext`).
- Concise table of external systems (what each provides, protocol/auth, owner if known).
- Explicit scope and trust boundaries.

### `docs/c4/02-containers.md`

- `C4Container` (or `flowchart`) diagram grouped by `System_Boundary` showing runnable containers (`Container`, `ContainerDb`, `ContainerQueue`) and external systems (`System_Ext`).
- Container table: responsibility, technology, owned state, identity/auth, and current status (`live`, `local-only`, `proposed`, or `VERIFY:`).
- Cross-boundary failure behavior and deployment/retention notes (or `VERIFY:` where undecided).

### `docs/c4/03-components.md`

- `C4Component` (or `flowchart`) diagram inside `Container_Boundary` for each key runtime container.
- Component sections or table covering responsibility, contract/interface, failure behavior, and grounded `Source:` paths:

```markdown
### <component-name>

- **Owner:** <owner or VERIFY: assign owner>
- **Source:** `src/path/to/module.ts`
- **Interface:** <public API, CLI command, event, or function boundary>
- **Failure behavior:** <how invalid input, auth denial, or dependency failure is handled>
```

- Use backticked repo-relative `Source:` paths that actually exist on disk.
- Use `` `planned: src/path/to/future-file` `` only when the file is not built yet.

### `docs/c4/04-code.md` (optional)

- Add only for tricky state machines, protocols, or security boundaries.
- Use `classDiagram`, `sequenceDiagram`, or `flowchart` plus grounded `Source:` references.
