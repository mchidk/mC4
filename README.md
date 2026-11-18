# mC4

**Fast, grounded C4 architecture documentation skill and Markdown validator for any codebase.**

mC4 provides a streamlined `c4` agent skill and zero-dependency CLI (`mc4`) that guides coding agents to produce clean, accurate C4 `.md` files (`README.md`, `01-context.md`, `02-containers.md`, `03-components.md`, and optional `04-code.md`) with Mermaid diagrams and verified `Source:` paths.

**Author:** Michael Christensen

---

## Highlights

- **Cross-harness skill layout** - works cleanly in **Claude Code**, **OpenCode**, **Codex**, and **Antigravity** via standard `SKILL.md` discovery paths (`.claude/skills/c4`, `.opencode/skills/c4`, `.agents/skills/c4`).
- **Fast 4-step workflow** - inspects entrypoints and boundaries selectively, updates only affected C4 levels, and validates in a single command.
- **Produces grounded `.md` files** - generates Context, Container, and Component Markdown records with Mermaid C4/flowchart diagrams and concise tables.
- **Strict fact-vs-proposed discipline** - distinguishes observed code from `proposed` design and `VERIFY:` gaps; never invents owners, deployments, auth rules, or file paths.
- **Zero-dependency validator (`mc4 check`)** - verifies required levels, metadata (`Status`, `Owner`, `Last reviewed`), Mermaid fences/braces/relationships, relative links, and repo-relative `Source:` paths in milliseconds.
- **Language- and stack-agnostic** - works on any repository without proprietary manifests or framework lock-in.

---

## Requirements

- **Node.js 20 or newer** (for running `mc4` CLI and `src/check.js`; no external npm dependencies required).
- Works with any language or build system in the target repository.

---

## Installation

### CLI (recommended)

Install the self-contained `c4` skill into your project's agent directories. mC4 is not published to the npm registry, so run it straight from GitHub — do not use a bare `npx mc4`, which would resolve to whatever package claims that name on npm:

```bash
npx github:mchidk/mC4 install --project
```

Options:

```bash
npx github:mchidk/mC4 install --project    # Install to .claude, .opencode, and .agents in current repo
npx github:mchidk/mC4 install --global     # Install to user-global skill directories
npx github:mchidk/mC4 install --claude --opencode  # Target specific harnesses (--claude, --opencode, --codex, --antigravity, --all)
npx github:mchidk/mC4 install --dry-run    # Preview target paths without writing files
npx github:mchidk/mC4 status               # Show installed skill status and docs/c4 presence
npx github:mchidk/mC4 uninstall --project  # Remove installed project skill directories
```

### Local checkout

```bash
node src/cli.js install --project --dir /path/to/target-repo
```

### Manual installation

Copy `SKILL.md`, `references/`, `templates/`, and `src/check.js` into your harness skill directory:

| Harness | Project path | Global path |
|---|---|---|
| **Claude Code** | `.claude/skills/c4/` | `~/.claude/skills/c4/` |
| **OpenCode** | `.opencode/skills/c4/` | `~/.config/opencode/skills/c4/` |
| **Codex** | `.agents/skills/c4/` | `~/.agents/skills/c4/` |
| **Antigravity** | `.agents/skills/c4/` | `~/.gemini/antigravity/skills/c4/` |

---

## Usage

### With an AI coding agent

Ask your agent in Claude Code, OpenCode, Codex, or Antigravity:

```text
Use the c4 skill to document the architecture of this repository in docs/c4/.
```

Or invoke `/c4` (Claude Code / OpenCode) or `$c4` (Codex) where supported.

### Scaffolding and validating from the CLI

Create starter `.md` templates in `docs/c4/`:

```bash
npx github:mchidk/mC4 init
```

Validate existing C4 documentation:

```bash
npx github:mchidk/mC4 check
npx github:mchidk/mC4 check --dir architecture/c4 --json
```

Or run the standalone validator directly without installing:

```bash
node src/check.js .
```

---

## How it works

```text
docs/c4/
  ├── README.md          # Scope, status overview, reading order, level links
  ├── 01-context.md      # Level 1: Actors, system boundary, external systems
  ├── 02-containers.md   # Level 2: Runnable apps, stores, queues, protocols
  ├── 03-components.md   # Level 3: Internal modules, interfaces, grounded Source paths
  └── 04-code.md         # Level 4 (optional): Complex or security-critical internals
```

1. **Discover** - the skill guides the agent to inspect manifests, entrypoints, runtime boundaries, and existing `docs/c4/` files rather than scanning unrelated code.
2. **Write or update `.md` files** - each level uses a concise Mermaid diagram (`C4Context`, `C4Container`, `C4Component`, `flowchart`, or `graph`) paired with short Markdown tables and `Source:` links.
3. **Validate** - `mc4 check` checks:
   - Required files (`README.md`, `01-context.md`, `02-containers.md`, `03-components.md`) and optional `04-code.md`
   - Level-1 `# Title` heading and metadata (`Status`, `Owner`, valid ISO `Last reviewed` date)
   - Relative level links in `README.md` and all relative Markdown links across `docs/c4/`
   - Closed ```` ```mermaid ```` fences, balanced `{}` boundary braces, and at least one relationship (`Rel(...)` or arrow)
   - Repo-relative backticked `Source:` paths in `03-components.md` / `04-code.md` (allowing `planned: <path>` for unbuilt modules and rejecting path escapes)

---

## Repository layout

| Path | Purpose |
|---|---|
| [SKILL.md](SKILL.md) | Canonical C4 documentation workflow and rules |
| [references/c4-levels.md](references/c4-levels.md) | Level definitions and `.md` file contract |
| [references/mermaid-and-grounding.md](references/mermaid-and-grounding.md) | Mermaid starters, grounding discipline, validator error codes |
| [templates/](templates/README.md) | Starter `.md` templates used by `mc4 init` and the skill |
| [src/check.js](src/check.js) | Zero-dependency C4 Markdown validator |
| [src/installer.js](src/installer.js) | Multi-harness skill installer and template scaffolder |
| [src/cli.js](src/cli.js) | `mc4` CLI entrypoint |
| [.claude/skills/c4/SKILL.md](.claude/skills/c4/SKILL.md) | Claude Code skill adapter |
| [.opencode/skills/c4/SKILL.md](.opencode/skills/c4/SKILL.md) | OpenCode skill adapter |
| [.agents/skills/c4/SKILL.md](.agents/skills/c4/SKILL.md) | Codex / Antigravity workspace skill adapter |

---

## Development

```bash
npm test
```

The test suite uses Node's built-in `node:test` runner and validates `checkC4Docs`, `initC4Docs`, `installSkill`, `uninstallSkill`, and the `mc4` CLI in temporary directories. See [CHANGELOG.md](CHANGELOG.md) for release notes.

---

## Author

**Michael Christensen**

## License

[MIT](LICENSE)
