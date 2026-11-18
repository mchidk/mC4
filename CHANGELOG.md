# Changelog

All notable changes to mC4.

**Author:** Michael Christensen

## 0.1.1 - 2026-11-18

### Fixed

- Installer: the guard protecting the mC4 source repo now compares canonical, case-folded paths, so `uninstall --dir` with a differently-cased path on Windows/macOS can no longer delete the repo's own skill adapters.
- Installer: `uninstall` only removes a c4 skill that mC4 installed (tracked via `.mc4-install.json`), deletes only mC4's own files, and keeps user-added files; `install` no longer silently overwrites a foreign c4 skill unless `--force` is passed.
- Validator: `BiRel(...)` now counts as a relationship.
- Validator: apostrophes in unquoted Mermaid text (e.g. `title Bob's System`) no longer hide unbalanced boundary braces.
- Validator: links with any URL scheme (`ftp:`, `tel:`, …) or protocol-relative `//host` are treated as external; URL-encoded paths and `?query` suffixes are resolved correctly; link examples inside inline code are ignored.
- Skill: validation step now points at the skill's bundled `src/check.js` instead of the target project's `src/`.

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
