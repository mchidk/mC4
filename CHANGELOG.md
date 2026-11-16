# Changelog

All notable changes to mC4.

**Author:** Michael Christensen

## 0.1.0 - 2026-11-16

### Skill

- Created the generalized, fast `c4` architecture documentation skill (`SKILL.md`) for any language, stack, or repository layout.
- Added concise guides in `references/` for C4 levels, Mermaid diagram conventions, and fact-vs-proposed grounding rules.
- Added ready-to-use `.md` starter templates in `templates/` for `README.md`, `01-context.md`, `02-containers.md`, `03-components.md`, and optional `04-code.md`.
- Added harness-local skill entrypoints under `.claude/skills/c4/`, `.opencode/skills/c4/`, and `.agents/skills/c4/`.

### CLI and Validator

- Added `mc4 check` (`src/check.js`) for fast structural, Mermaid fence/brace, relative link, and `Source:` path validation with zero external dependencies.
- Added `mc4 init` to scaffold `docs/c4/` `.md` files from `templates/`.
- Added `mc4 install`, `mc4 uninstall`, and `mc4 status` (`src/installer.js`) with `--project`, `--global`, `--dry-run`, and per-harness flags (`--claude`, `--opencode`, `--codex`, `--antigravity`, `--all`).
- Added unit and CLI tests under `test/` using `node:test`.
