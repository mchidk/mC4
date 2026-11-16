# Architecture Overview (C4)

- **Status:** draft
- **Owner:** VERIFY: assign architecture owner
- **Last reviewed:** 2026-01-01
- **Scope:** Describe what this C4 record covers and what is explicitly out of scope.

This folder documents the system architecture using the C4 model: external context, runtime containers, internal components, and optional code-level notes. Statements reflect observed code unless explicitly marked `proposed` or `VERIFY:`.

## Levels

| Level | Document | Focus | Status |
|---|---|---|---|
| 1. System Context | [01-context.md](01-context.md) | Actors, system boundary, external systems | draft |
| 2. Container | [02-containers.md](02-containers.md) | Running processes, data stores, protocols | draft |
| 3. Component | [03-components.md](03-components.md) | Internal modules, contracts, source paths | draft |
| 4. Code | Optional (`04-code.md`) | Complex or security-critical internals only | not written |

## Reading Order

1. Start with [System Context](01-context.md) for actors, external dependencies, and trust boundaries.
2. Read [Containers](02-containers.md) for deployable units, data ownership, and authentication boundaries.
3. Read [Components](03-components.md) for internal modules, interfaces, failure paths, and verified `Source:` locations.
